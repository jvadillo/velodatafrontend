import { useId, useMemo, useRef, useState } from "react";

export interface SummaryChartItem {
  id: string;
  name: string;
  /** epoch ms */
  date: number;
  /** meters */
  distance: number;
  /** seconds, 0 if the GPX has no timestamps */
  duration: number;
  color: string;
}

const WIDTH = 720;
const HEIGHT = 240;
const PADDING = { top: 16, right: 52, bottom: 34, left: 48 };

const DAY_MS = 24 * 60 * 60 * 1000;

function speedKmh(item: SummaryChartItem): number | null {
  return item.duration > 0 ? (item.distance / item.duration) * 3.6 : null;
}

function formatShortDate(ts: number): string {
  return new Date(ts).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
  });
}

function niceMax(value: number, step: number): number {
  if (value <= 0) return step;
  return Math.ceil(value / step) * step;
}

export default function SummaryChart({ items }: { items: SummaryChartItem[] }) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const gradientId = useId().replace(/:/g, "");
  const [activeId, setActiveId] = useState<string | null>(null);

  const model = useMemo(() => {
    if (items.length === 0) return null;
    const sorted = [...items].sort((a, b) => a.date - b.date);
    const minDate = sorted[0]!.date;
    const maxDate = sorted[sorted.length - 1]!.date;
    const span = Math.max(maxDate - minDate, DAY_MS);
    const pad = span * 0.04;
    const plotWidth = WIDTH - PADDING.left - PADDING.right;
    const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;

    const x = (date: number) =>
      PADDING.left + ((date - (minDate - pad)) / (span + pad * 2)) * plotWidth;

    const maxDistance = Math.max(...sorted.map((item) => item.distance)) / 1000;
    const distanceMax = niceMax(maxDistance * 1.12, 10);
    const yDistance = (km: number) =>
      PADDING.top + (1 - km / distanceMax) * plotHeight;

    const speeds = sorted
      .map(speedKmh)
      .filter((speed): speed is number => speed !== null);
    const speedMax = speeds.length ? niceMax(Math.max(...speeds) * 1.15, 5) : 20;
    const speedMin = 0;
    const ySpeed = (kmh: number) =>
      PADDING.top + (1 - (kmh - speedMin) / (speedMax - speedMin)) * plotHeight;

    const barWidth = Math.min(
      34,
      Math.max(6, (plotWidth / sorted.length) * 0.55),
    );

    const positions = sorted.map((item) => {
      const speed = speedKmh(item);
      return {
        item,
        speed,
        cx: x(item.date),
        barY: yDistance(item.distance / 1000),
        speedY: speed === null ? null : ySpeed(speed),
      };
    });

    const speedLine = positions
      .filter((p) => p.speedY !== null)
      .map((p) => `${p.cx},${p.speedY}`)
      .join(" ");

    const dateTicks: Array<{ ts: number; anchor: "start" | "middle" | "end" }> = [];
    const tickCount = Math.min(5, sorted.length);
    for (let i = 0; i < tickCount; i++) {
      const ratio = tickCount === 1 ? 0.5 : i / (tickCount - 1);
      const ts = minDate + ratio * span;
      dateTicks.push({
        ts,
        anchor: i === 0 ? "start" : i === tickCount - 1 ? "end" : "middle",
      });
    }

    return {
      positions,
      speedLine,
      distanceMax,
      speedMax,
      plotWidth,
      plotHeight,
      x,
      yDistance,
      ySpeed,
      barWidth,
      dateTicks,
      span,
    };
  }, [items]);

  if (!model) return null;

  const active = model.positions.find((p) => p.item.id === activeId) ?? null;

  const selectFromPointer = (clientX: number) => {
    const svg = svgRef.current;
    if (!svg || model.positions.length === 0) return;
    const rect = svg.getBoundingClientRect();
    const viewX = ((clientX - rect.left) / rect.width) * WIDTH;
    let closest = model.positions[0]!;
    let closestGap = Math.abs(closest.cx - viewX);
    for (const position of model.positions) {
      const gap = Math.abs(position.cx - viewX);
      if (gap < closestGap) {
        closestGap = gap;
        closest = position;
      }
    }
    setActiveId(closest.item.id);
  };

  const activeReadout = active
    ? `${formatShortDate(active.item.date)} · ${(active.item.distance / 1000).toFixed(1)} km · ${active.speed === null ? "—" : `${active.speed.toFixed(1)} km/h`}`
    : null;

  return (
    <div className="rounded-lg border border-border bg-elevated/35 px-2 pb-2 pt-3 sm:px-3">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-2">
        <p className="font-display text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Evolución de las salidas
        </p>
        <p
          className="min-h-4 text-right font-mono text-[11px] text-foreground"
          aria-live="polite"
        >
          {activeReadout ?? "Recorre la gráfica para ver cada salida"}
        </p>
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-52 w-full touch-none select-none overflow-visible"
        role="img"
        aria-label="Distancia y velocidad media de cada salida en el tiempo"
        onPointerMove={(event) => selectFromPointer(event.clientX)}
        onPointerDown={(event) => selectFromPointer(event.clientX)}
        onPointerLeave={() => setActiveId(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.85" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.35" />
          </linearGradient>
        </defs>

        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = PADDING.top + ratio * model.plotHeight;
          const km = model.distanceMax * (1 - ratio);
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
                {Math.round(km)} km
              </text>
              <text
                x={WIDTH - PADDING.right + 8}
                y={y + 4}
                textAnchor="start"
                className="fill-muted-foreground font-mono text-[10px]"
              >
                {Math.round(model.speedMax * (1 - ratio))} km/h
              </text>
            </g>
          );
        })}

        {model.positions.map((position) => (
          <g key={position.item.id} className="text-primary">
            <rect
              x={position.cx - model.barWidth / 2}
              y={position.barY}
              width={model.barWidth}
              height={
                PADDING.top + model.plotHeight - position.barY
              }
              rx={Math.min(3, model.barWidth / 2)}
              fill={
                activeId === null || activeId === position.item.id
                  ? `url(#${gradientId})`
                  : "currentColor"
              }
              opacity={activeId === null || activeId === position.item.id ? 1 : 0.35}
            />
            <rect
              x={position.cx - model.barWidth / 2}
              y={position.barY}
              width={model.barWidth}
              height={PADDING.top + model.plotHeight - position.barY}
              rx={Math.min(3, model.barWidth / 2)}
              fill="none"
              stroke={position.item.color}
              strokeWidth="1.5"
              opacity={activeId === null || activeId === position.item.id ? 0.9 : 0.35}
            />
          </g>
        ))}

        {model.speedLine && (
          <polyline
            points={model.speedLine}
            fill="none"
            className="stroke-accent"
            strokeWidth="2"
            strokeDasharray="1 0"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {model.positions.map((position) =>
          position.speedY === null ? null : (
            <circle
              key={`speed-${position.item.id}`}
              cx={position.cx}
              cy={position.speedY}
              r={activeId === position.item.id ? 5 : 3.5}
              className="fill-background stroke-accent"
              strokeWidth="2.5"
            />
          ),
        )}

        {model.dateTicks.map((tick) => (
          <text
            key={tick.ts}
            x={model.x(tick.ts)}
            y={HEIGHT - 10}
            textAnchor={tick.anchor}
            className="fill-muted-foreground font-mono text-[10px]"
          >
            {formatShortDate(tick.ts)}
          </text>
        ))}

        {active && (
          <g className="pointer-events-none">
            <line
              x1={active.cx}
              y1={PADDING.top}
              x2={active.cx}
              y2={HEIGHT - PADDING.bottom}
              stroke="currentColor"
              className="text-accent"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
            <text
              x={active.cx}
              y={PADDING.top - 4}
              textAnchor="middle"
              className="fill-foreground font-mono text-[10px]"
            >
              {active.item.name.length > 22
                ? `${active.item.name.slice(0, 21)}…`
                : active.item.name}
            </text>
          </g>
        )}
      </svg>
      <div className="mt-1 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 px-2 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-sm bg-primary/70" />
          Distancia (km)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded bg-accent" />
          Velocidad media (km/h)
        </span>
      </div>
    </div>
  );
}
