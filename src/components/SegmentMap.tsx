import { useEffect, useRef } from "react";

interface SegmentMapProps {
  path: Array<[number, number]>;
  context?: Array<[number, number]>;
  color?: string;
  className?: string;
}

/**
 * Leaflet is loaded dynamically inside an effect so it never runs during SSR.
 */
export default function SegmentMap({
  path,
  context,
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

      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        maxZoom: 19,
      }).addTo(map);

      if (context && context.length > 1) {
        L.polyline(context, { color: "#94a3b8", weight: 2, opacity: 0.45 }).addTo(map);
      }

      const line = L.polyline(path, { color, weight: 5, opacity: 0.95 }).addTo(map);
      map.fitBounds(line.getBounds(), { padding: [24, 24] });
    })();

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [path, context, color]);

  return <div ref={containerRef} className={className} />;
}
