import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
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
  interactive?: boolean;
}
export default function SegmentMap({
  path,
  context,
  highlights,
  color = "#f97316",
  className,
  activePoint,
  onPathSelect,
  interactive = true,
}: SegmentMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const leafletRef = useRef<typeof Leaflet | null>(null);
  const onSelect = useRef(onPathSelect);
  const [ready, setReady] = useState(0);
  useEffect(() => {
    onSelect.current = onPathSelect;
  }, [onPathSelect]);
  useEffect(() => {
    let cancelled = false;
    let map: Leaflet.Map | null = null;
    let resize: ResizeObserver | undefined;
    void import("leaflet").then(({ default: L }) => {
      if (cancelled || !containerRef.current) return;
      leafletRef.current = L;
      map = L.map(containerRef.current, {
        zoomControl: interactive,
        attributionControl: true,
        scrollWheelZoom: false,
        dragging: interactive,
        touchZoom: interactive,
        doubleClickZoom: interactive,
        boxZoom: interactive,
        keyboard: interactive,
      });
      mapRef.current = map;
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        referrerPolicy: "strict-origin-when-cross-origin",
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);
      if (context && context.length > 1)
        L.polyline(context, {
          color: "#94a3b8",
          weight: 2,
          opacity: 0.45,
          interactive: false,
        }).addTo(map);
      const line = L.polyline(path, {
        color,
        weight: interactive ? 4 : 3,
        opacity: 0.9,
        interactive,
      }).addTo(map);
      line.on("click", (event: Leaflet.LeafletMouseEvent) =>
        onSelect.current?.([event.latlng.lat, event.latlng.lng]),
      );
      const bounds = line.getBounds();
      if (bounds.isValid())
        map.fitBounds(bounds, { padding: [24, 24], maxZoom: interactive ? 17 : 14 });
      resize = new ResizeObserver(() => map?.invalidateSize({ pan: false }));
      resize.observe(containerRef.current);
      setReady((v) => v + 1);
    });
    return () => {
      cancelled = true;
      resize?.disconnect();
      mapRef.current = null;
      map?.remove();
    };
  }, [path, context, color, interactive]);
  useEffect(() => {
    const L = leafletRef.current,
      map = mapRef.current;
    if (!L || !map) return;
    const layer = L.layerGroup().addTo(map);
    for (const highlight of highlights ?? []) {
      if (highlight.path.length < 2) continue;
      const line = L.polyline(highlight.path, {
        color: highlight.color,
        weight: 8,
        opacity: 0.95,
      }).addTo(layer);
      line.on("click", (event: Leaflet.LeafletMouseEvent) =>
        onSelect.current?.([event.latlng.lat, event.latlng.lng]),
      );
      for (const point of [highlight.path[0]!, highlight.path[highlight.path.length - 1]!])
        L.circleMarker(point, {
          radius: 5,
          color: highlight.color,
          fillColor: "#fff",
          fillOpacity: 1,
          weight: 3,
          interactive: false,
        }).addTo(layer);
    }
    return () => {
      layer.remove();
    };
  }, [highlights, ready]);
  useEffect(() => {
    const L = leafletRef.current,
      map = mapRef.current;
    if (!L || !map || !activePoint) return;
    const marker = L.circleMarker(activePoint, {
      radius: 7,
      color,
      weight: 3,
      fillColor: "#fff",
      fillOpacity: 1,
      interactive: false,
    }).addTo(map);
    return () => {
      marker.remove();
    };
  }, [activePoint, color, ready]);
  return <div ref={containerRef} className={className} />;
}
