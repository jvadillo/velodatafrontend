import { useId, useMemo, useRef } from "react";

import type { TrackPoint } from "@/lib/gpx";

interface ElevationProfileProps {
  points: TrackPoint[];
  activeIndex: number | null;
  onActiveIndexChange: (index: number) => void;
}

const WIDTH = 720;
const HEIGHT = 190;
const PADDING = { top: 18, right: 18, bottom: 32, left: 48 };

export default function ElevationProfile({
  points,
  activeIndex,
  onActiveIndexChange,
}: ElevationProfileProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const gradientId = useId().replace(/:/g, "");

  const profile = useMemo(() => {
    if (points.length === 0) return null;
    const elevations = points.map((point) => point.ele);
    const rawMin = Math.min(...elevations);
    const rawMax = Math.max(...elevations);
    const range = Math.max(10, rawMax - rawMin);
    const min = Math.floor((rawMin - range * 0.08) / 10) * 10;
    const max = Math.ceil((rawMax + range * 0.08) / 10) * 10;
    const totalDistance = Math.max(1, points[points.length - 1]?.d ?? 1);
    const plotWidth = WIDTH - PADDING.left - PADDING.right;
    const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;
    const x = (distance: number) => PADDING.left + (distance / totalDistance) * plotWidth;
    const y = (elevation: number) =>
      PADDING.top + ((max - elevation) / Math.max(1, max - min)) * plotHeight;
    const step = Math.max(1, Math.ceil(points.length / 700));
    const sampled = points.filter((_, index) => index % step === 0);
    const last = points[points.length - 1];
    if (last && sampled[sampled.length - 1] !== last) sampled.push(last);
    const line = sampled.map((point) => `${x(point.d)},${y(point.ele)}`).join(" ");
    const area = `${PADDING.left},${HEIGHT - PADDING.bottom} ${line} ${WIDTH - PADDING.right},${HEIGHT - PADDING.bottom}`;
    return { min, max, totalDistance, plotWidth, plotHeight, x, y, line, area };
  }, [points]);

  if (!profile) return null;

  const activePoint = activeIndex === null ? null : points[activeIndex] ?? null;
  const distanceTicks = Array.from({ length: 5 }, (_, index) => index / 4);
  const elevationTicks = Array.from({ length: 3 }, (_, index) => index / 2);

  const selectFromPointer = (clientX: number) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const viewX = ((clientX - rect.left) / rect.width) * WIDTH;
    const ratio = Math.max(
      0,
      Math.min(1, (viewX - PADDING.left) / profile.plotWidth),
    );
    const targetDistance = ratio * profile.totalDistance;
    let low = 0;
    let high = points.length - 1;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if ((points[middle]?.d ?? 0) < targetDistance) low = middle + 1;
      else high = middle;
    }
    const previous = Math.max(0, low - 1);
    const currentDistance = points[low]?.d ?? 0;
    const previousDistance = points[previous]?.d ?? 0;
    onActiveIndexChange(
      Math.abs(previousDistance - targetDistance) < Math.abs(currentDistance - targetDistance)
        ? previous
        : low,
    );
  };

  return (
    <div className="rounded-lg border border-border bg-elevated/35 px-2 pb-2 pt-3 sm:px-3">
      <div className="mb-1 flex items-center justify-between px-2">
        <p className="font-display text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Perfil del recorrido
        </p>
        <p className="min-h-4 font-mono text-[11px] text-foreground" aria-live="polite">
          {activePoint
            ? `${(activePoint.d / 1000).toFixed(2)} km · ${Math.round(activePoint.ele)} m`
            : "Recorre el perfil o pulsa la ruta"}
        </p>
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-44 w-full touch-none select-none overflow-visible text-primary"
        role="img"
        aria-label="Perfil de altitud interactivo del recorrido"
        onPointerMove={(event) => selectFromPointer(event.clientX)}
        onPointerDown={(event) => selectFromPointer(event.clientX)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {elevationTicks.map((ratio) => {
          const y = PADDING.top + ratio * profile.plotHeight;
          const elevation = profile.max - ratio * (profile.max - profile.min);
          return (
            <g key={ratio}>
              <line
                x1={PADDING.left}
                y1={y}
                x2={WIDTH - PADDING.right}
                y2={y}
                className="stroke-border"
                strokeWidth="1"
              />
              <text
                x={PADDING.left - 8}
                y={y + 4}
                textAnchor="end"
                className="fill-muted-foreground font-mono text-[10px]"
              >
                {Math.round(elevation)} m
              </text>
            </g>
          );
        })}

        <polygon points={profile.area} fill={`url(#${gradientId})`} />
        <polyline
          points={profile.line}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />

        {distanceTicks.map((ratio) => (
          <text
            key={ratio}
            x={PADDING.left + ratio * profile.plotWidth}
            y={HEIGHT - 10}
            textAnchor={ratio === 0 ? "start" : ratio === 1 ? "end" : "middle"}
            className="fill-muted-foreground font-mono text-[10px]"
          >
            {((profile.totalDistance * ratio) / 1000).toFixed(ratio === 0 ? 0 : 1)} km
          </text>
        ))}

        {activePoint && (
          <g className="pointer-events-none">
            <line
              x1={profile.x(activePoint.d)}
              y1={PADDING.top}
              x2={profile.x(activePoint.d)}
              y2={HEIGHT - PADDING.bottom}
              stroke="currentColor"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
            <circle
              cx={profile.x(activePoint.d)}
              cy={profile.y(activePoint.ele)}
              r="5"
              className="fill-background stroke-primary"
              strokeWidth="3"
            />
          </g>
        )}
      </svg>
    </div>
  );
}