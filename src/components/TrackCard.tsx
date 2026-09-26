import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { formatDate, formatDistance, formatDuration, type Track } from "@/lib/gpx";
import { ShareTrack } from "./ShareTrack";
const SegmentMap = lazy(() => import("./SegmentMap"));
export function TrackCard({
  track,
  onRemove,
  onShare,
}: {
  track: Track;
  onRemove: () => void;
  onShare: (token: string | null) => void;
}) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setVisible(!!entry?.isIntersecting));
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  const path = useMemo<Array<[number, number]>>(() => {
    const step = Math.max(1, Math.ceil(track.points.length / 350));
    return track.points
      .filter((_, i) => i % step === 0 || i === track.points.length - 1)
      .map((p) => [p.lat, p.lon]);
  }, [track.points]);
  return (
    <article
      ref={ref}
      className="overflow-hidden rounded-2xl border border-border bg-surface transition-colors hover:border-primary/60"
    >
      <div className="relative h-44 bg-elevated">
        {visible && (
          <Suspense fallback={<div className="h-full animate-pulse" />}>
            <SegmentMap
              path={path}
              color={track.color}
              interactive={false}
              className="h-full w-full"
            />
          </Suspense>
        )}
        <a
          href={`#/tracks/${track.id}`}
          tabIndex={-1}
          aria-label={`Ver ${track.name}`}
          className="absolute inset-0 z-[400]"
        />
      </div>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-lg">
              <a href={`#/tracks/${track.id}`} className="line-clamp-2 hover:text-primary">
                {track.name}
              </a>
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">{formatDate(track.date)}</p>
          </div>
          <button
            aria-label={`Eliminar ${track.name}`}
            onClick={onRemove}
            className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-4 text-xs">
          {[
            ["Distancia", formatDistance(track.distance)],
            ["Tiempo", formatDuration(track.duration)],
            [
              "Velocidad media",
              track.duration > 0
                ? `${((track.distance / track.duration) * 3.6).toFixed(1)} km/h`
                : "—",
            ],
            ["Desnivel positivo", `${Math.round(track.elevationGain)} m`],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="mt-1 font-mono text-sm">{value}</dd>
            </div>
          ))}
        </dl>
        <ShareTrack track={track} onChange={onShare} />
      </div>
    </article>
  );
}
