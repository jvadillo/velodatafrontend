import type { Track } from "./gpx";
export type TrackSort = "date" | "distance" | "speed" | "elevation";
export function sortTracks(tracks: Track[], sort: TrackSort, ascending: boolean): Track[] {
  const value = (track: Track): number | null =>
    sort === "date"
      ? track.date
      : sort === "distance"
        ? track.distance
        : sort === "elevation"
          ? track.elevationGain
          : track.duration > 0
            ? track.distance / track.duration
            : null;
  return [...tracks].sort((a, b) => {
    const av = value(a),
      bv = value(b);
    if (av === null) return bv === null ? a.id.localeCompare(b.id) : 1;
    if (bv === null) return -1;
    return (ascending ? av - bv : bv - av) || a.id.localeCompare(b.id);
  });
}
