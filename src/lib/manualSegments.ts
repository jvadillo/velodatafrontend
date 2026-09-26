import { elevationGain, haversine, type Track } from "./gpx";
import type { SegmentEffort } from "./segments";

export interface ManualSegment {
  trackId?: string;
  id: string;
  name: string;
  start: [number, number];
  end: [number, number];
  path: Array<[number, number]>;
  distance: number;
}

const MATCH_RADIUS = 60; // meters

function nearIndices(track: Track, [lat, lon]: [number, number]): number[] {
  // Local minima within radius (a route may pass the same place several times).
  const out: number[] = [];
  let best = -1;
  let bestDist = Infinity;
  track.points.forEach((p, i) => {
    const d = haversine(lat, lon, p.lat, p.lon);
    if (d <= MATCH_RADIUS) {
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    } else if (best >= 0) {
      out.push(best);
      best = -1;
      bestDist = Infinity;
    }
  });
  if (best >= 0) out.push(best);
  return out;
}

/** Compute efforts of every track that rides the manual segment in the same direction. */
export function manualEfforts(segment: ManualSegment, tracks: Track[]): SegmentEffort[] {
  const raw: Array<Omit<SegmentEffort, "delta" | "isBest">> = [];
  for (const track of tracks) {
    const starts = nearIndices(track, segment.start);
    const ends = nearIndices(track, segment.end);
    let pick: [number, number] | null = null;
    for (const s of starts) {
      const e = ends.find((e) => e > s);
      if (e === undefined) continue;
      const dist = track.points[e]!.d - track.points[s]!.d;
      if (dist < segment.distance * 0.75 || dist > segment.distance * 1.35) continue;
      pick = [s, e];
      break;
    }
    if (!pick) continue;
    const a = track.points[pick[0]]!;
    const b = track.points[pick[1]]!;
    const distance = b.d - a.d;
    const hasTime = a.t > 0 && b.t > a.t;
    const duration = hasTime ? (b.t - a.t) / 1000 : 0;
    raw.push({
      trackId: track.id,
      trackName: track.name,
      color: track.color,
      date: track.date,
      distance,
      duration,
      speed: hasTime && duration > 0 ? (distance / duration) * 3.6 : 0,
      elevationGain: elevationGain(track.points, pick[0], pick[1]),
      avgGrade: distance > 0 ? ((b.ele - a.ele) / distance) * 100 : 0,
      hasTime,
    });
  }
  const timed = raw.filter((e) => e.hasTime && e.duration > 0);
  const best = timed.length ? Math.min(...timed.map((e) => e.duration)) : 0;
  return raw
    .map((e) => ({
      ...e,
      delta: e.hasTime && best ? e.duration - best : 0,
      isBest: e.hasTime && best > 0 && e.duration === best,
    }))
    .sort((a, b) => (a.hasTime !== b.hasTime ? (a.hasTime ? -1 : 1) : a.duration - b.duration));
}

export function buildManualSegment(
  track: Track,
  from: number,
  to: number,
  name: string,
): ManualSegment {
  const s = Math.min(from, to);
  const e = Math.max(from, to);
  const pts = track.points;
  const step = Math.max(1, Math.floor((e - s) / 400));
  const path: Array<[number, number]> = [];
  for (let k = s; k <= e; k += step) path.push([pts[k]!.lat, pts[k]!.lon]);
  path.push([pts[e]!.lat, pts[e]!.lon]);
  return {
    id: `man-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    start: [pts[s]!.lat, pts[s]!.lon],
    end: [pts[e]!.lat, pts[e]!.lon],
    path,
    distance: pts[e]!.d - pts[s]!.d,
  };
}
