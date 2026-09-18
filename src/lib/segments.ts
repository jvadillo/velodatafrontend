import { elevationGain, haversine, type Track, type TrackPoint } from "./gpx";

export interface SegmentEffort {
  trackId: string;
  trackName: string;
  color: string;
  date: number | null;
  distance: number;
  duration: number;
  speed: number;
  elevationGain: number;
  avgGrade: number;
  /** seconds slower (+) or faster (−) than the best effort */
  delta: number;
  isBest: boolean;
  hasTime: boolean;
}

export interface CommonSegment {
  id: string;
  index: number;
  distance: number;
  elevationGain: number;
  avgGrade: number;
  path: Array<[number, number]>;
  efforts: SegmentEffort[];
}

const CELL = 0.0004; // ~44 m
const TOLERANCE = 35; // meters
const MIN_SEGMENT_LENGTH = 500; // meters
const GAP_FILL = 150; // meters of tolerated mismatch inside a segment

type Grid = Map<string, number[]>;

function buildGrid(points: TrackPoint[]): Grid {
  const grid: Grid = new Map();
  for (let i = 0; i < points.length; i++) {
    const key = `${Math.round(points[i].lat / CELL)}:${Math.round(points[i].lon / CELL)}`;
    const bucket = grid.get(key);
    if (bucket) bucket.push(i);
    else grid.set(key, [i]);
  }
  return grid;
}

function nearestIndex(grid: Grid, points: TrackPoint[], lat: number, lon: number): number {
  const gy = Math.round(lat / CELL);
  const gx = Math.round(lon / CELL);
  let best = -1;
  let bestDist = TOLERANCE;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const bucket = grid.get(`${gy + dy}:${gx + dx}`);
      if (!bucket) continue;
      for (const i of bucket) {
        const dist = haversine(lat, lon, points[i].lat, points[i].lon);
        if (dist < bestDist) {
          bestDist = dist;
          best = i;
        }
      }
    }
  }
  return best;
}

/** Fill short mismatched gaps so GPS noise doesn't split a segment in two. */
function smooth(matches: Int32Array, ref: TrackPoint[]): void {
  let i = 0;
  while (i < matches.length) {
    if (matches[i] >= 0) {
      i++;
      continue;
    }
    let j = i;
    while (j < matches.length && matches[j] < 0) j++;
    const before = i > 0 ? matches[i - 1] : -1;
    const after = j < matches.length ? matches[j] : -1;
    const gapLength = (ref[Math.min(j, ref.length - 1)]?.d ?? 0) - (ref[i]?.d ?? 0);
    if (before >= 0 && after >= 0 && gapLength <= GAP_FILL) {
      for (let k = i; k < j; k++) {
        const ratio = (k - i + 1) / (j - i + 1);
        matches[k] = Math.round(before + (after - before) * ratio);
      }
    }
    i = j;
  }
}

function effortFor(
  track: Track,
  from: number,
  to: number,
): Omit<SegmentEffort, "delta" | "isBest"> {
  const a = track.points[Math.min(from, to)];
  const b = track.points[Math.max(from, to)];
  const distance = Math.max(0, b.d - a.d);
  const hasTime = a.t > 0 && b.t > 0 && b.t > a.t;
  const duration = hasTime ? (b.t - a.t) / 1000 : 0;
  const gain = elevationGain(track.points, Math.min(from, to), Math.max(from, to));
  return {
    trackId: track.id,
    trackName: track.name,
    color: track.color,
    date: track.date,
    distance,
    duration,
    speed: hasTime && duration > 0 ? (distance / duration) * 3.6 : 0,
    elevationGain: gain,
    avgGrade: distance > 0 ? ((b.ele - a.ele) / distance) * 100 : 0,
    hasTime,
  };
}

export function findCommonSegments(tracks: Track[]): CommonSegment[] {
  if (tracks.length < 2) return [];

  // The longest track acts as the reference geometry.
  const reference = tracks.reduce((a, b) => (b.points.length > a.points.length ? b : a));
  const others = tracks.filter((t) => t.id !== reference.id);
  const ref = reference.points;

  const matchesByTrack = new Map<string, Int32Array>();
  for (const track of others) {
    const grid = buildGrid(track.points);
    const matches = new Int32Array(ref.length).fill(-1);
    for (let i = 0; i < ref.length; i++) {
      matches[i] = nearestIndex(grid, track.points, ref[i].lat, ref[i].lon);
    }
    smooth(matches, ref);
    matchesByTrack.set(track.id, matches);
  }

  // Signature per reference point: which tracks are on the same road here.
  const signatures: string[] = new Array(ref.length);
  for (let i = 0; i < ref.length; i++) {
    const ids: string[] = [];
    for (const track of others) {
      if ((matchesByTrack.get(track.id) as Int32Array)[i] >= 0) ids.push(track.id);
    }
    signatures[i] = ids.join("|");
  }

  const segments: CommonSegment[] = [];
  let start = 0;
  for (let i = 1; i <= ref.length; i++) {
    const ended = i === ref.length || signatures[i] !== signatures[start];
    if (!ended) continue;
    const end = i - 1;
    const signature = signatures[start];
    const length = ref[end].d - ref[start].d;
    if (signature && length >= MIN_SEGMENT_LENGTH) {
      const ids = signature.split("|");
      const efforts: Array<Omit<SegmentEffort, "delta" | "isBest">> = [
        effortFor(reference, start, end),
      ];
      let valid = true;
      for (const id of ids) {
        const track = others.find((t) => t.id === id)!;
        const matches = matchesByTrack.get(id) as Int32Array;
        const from = matches[start];
        const to = matches[end];
        // Opposite direction or implausible match -> discard the segment for safety.
        if (to <= from) {
          valid = false;
          break;
        }
        const effort = effortFor(track, from, to);
        if (effort.distance < length * 0.7 || effort.distance > length * 1.4) {
          valid = false;
          break;
        }
        efforts.push(effort);
      }

      if (valid && efforts.length >= 2) {
        const timed = efforts.filter((e) => e.hasTime && e.duration > 0);
        const bestTime = timed.length ? Math.min(...timed.map((e) => e.duration)) : 0;
        const path: Array<[number, number]> = [];
        const step = Math.max(1, Math.floor((end - start) / 400));
        for (let k = start; k <= end; k += step) path.push([ref[k].lat, ref[k].lon]);
        path.push([ref[end].lat, ref[end].lon]);

        segments.push({
          id: `seg-${start}-${end}`,
          index: segments.length + 1,
          distance: length,
          elevationGain: elevationGain(ref, start, end),
          avgGrade: ((ref[end].ele - ref[start].ele) / Math.max(1, length)) * 100,
          path,
          efforts: efforts
            .map((e) => ({
              ...e,
              delta: e.hasTime && bestTime ? e.duration - bestTime : 0,
              isBest: e.hasTime && bestTime > 0 && e.duration === bestTime,
            }))
            .sort((a, b) => {
              if (a.hasTime !== b.hasTime) return a.hasTime ? -1 : 1;
              return a.duration - b.duration;
            }),
        });
      }
    }
    start = i;
  }

  return segments
    .sort((a, b) => b.distance - a.distance)
    .map((segment, i) => ({ ...segment, index: i + 1 }));
}
