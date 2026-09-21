import { useEffect, useRef } from "react";

export interface MapHighlight {
  path: Array<[number, number]>;
  color: string;
}

interface SegmentMapProps {
  path: Array<[number, number]>;
  context?: Array<[number, number]>;
  highlights?: MapHighlight[];
  color?: string;
  className?: string;
}

/**
 * Leaflet is loaded dynamically inside an effect so it never runs during SSR.
 */
export default function SegmentMap({
  path,
  context,
  highlights,
  color = "#f97316",
  className,
}: SegmentMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let map: import("leaflet").Map | null = null;
    let cancelled = false;

    void (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current) return;

      map = L.map(containerRef.current, {
        zoomControl: false,
        attributionControl: false,
        scrollWheelZoom: false,
      });

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        className: "map-tiles-dark",
      }).addTo(map);

      if (context && context.length > 1) {
        L.polyline(context, { color: "#94a3b8", weight: 2, opacity: 0.45 }).addTo(map);
      }

      const line = L.polyline(path, { color, weight: 4, opacity: 0.7 }).addTo(map);
      const bounds = line.getBounds();

      if (highlights) {
        for (const highlight of highlights) {
          if (highlight.path.length < 2) continue;
          const segmentLine = L.polyline(highlight.path, {
            color: highlight.color,
            weight: 9,
            opacity: 0.95,
            lineCap: "round",
            lineJoin: "round",
          }).addTo(map);
          bounds.extend(segmentLine.getBounds());
        }
      }

      map.fitBounds(bounds, { padding: [24, 24] });
    })();

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [path, context, highlights, color]);

  return <div ref={containerRef} className={className} />;
}
