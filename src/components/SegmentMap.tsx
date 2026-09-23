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
  activePoint?: [number, number] | null;
  onPathSelect?: (location: [number, number]) => void;
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
  activePoint,
  onPathSelect,
}: SegmentMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markerRef = useRef<import("leaflet").CircleMarker | null>(null);
  const onPathSelectRef = useRef(onPathSelect);

  useEffect(() => {
    onPathSelectRef.current = onPathSelect;
  }, [onPathSelect]);

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
      mapRef.current = map;

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        className: "map-tiles-dark",
      }).addTo(map);

      if (context && context.length > 1) {
        L.polyline(context, { color: "#94a3b8", weight: 2, opacity: 0.45 }).addTo(map);
      }

      const line = L.polyline(path, { color, weight: 4, opacity: 0.7 }).addTo(map);
      line.on("click", (event) => {
        onPathSelectRef.current?.([event.latlng.lat, event.latlng.lng]);
      });
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
      markerRef.current = null;
      mapRef.current = null;
      map?.remove();
    };
  }, [path, context, highlights, color]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const map = mapRef.current;
      if (!map || !activePoint) {
        markerRef.current?.remove();
        markerRef.current = null;
        return;
      }
      const L = (await import("leaflet")).default;
      if (cancelled || !mapRef.current) return;
      if (markerRef.current) {
        markerRef.current.setLatLng(activePoint);
      } else {
        markerRef.current = L.circleMarker(activePoint, {
          radius: 7,
          color,
          weight: 3,
          fillColor: "#ffffff",
          fillOpacity: 1,
          interactive: false,
        }).addTo(map);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activePoint, color]);

  return <div ref={containerRef} className={className} />;
}
