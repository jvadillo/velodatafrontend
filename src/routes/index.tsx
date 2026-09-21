import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { Suspense, lazy, useCallback, useMemo, useRef, useState } from "react";
import {
  ArrowDownUp,
  Bike,
  Gauge,
  Mountain,
  Timer,
  Trash2,
  Upload,
} from "lucide-react";

import {
  formatDate,
  formatDelta,
  formatDistance,
  formatDuration,
  parseGpx,
  type Track,
} from "@/lib/gpx";
import { findCommonSegments } from "@/lib/segments";

const SegmentMap = lazy(() => import("@/components/SegmentMap"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Segmentos — Compara tus salidas en bici a partir de tus GPX" },
      {
        name: "description",
        content:
          "Sube varios archivos GPX de tus salidas en bicicleta de carretera y descubre los tramos que repites, con tiempos, velocidad media y desnivel comparados.",
      },
      { property: "og:title", content: "Segmentos — Compara tus salidas en bici" },
      {
        property: "og:description",
        content:
          "Detecta automáticamente los tramos comunes entre tus rutas GPX y compara tu rendimiento salida a salida.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [openSegment, setOpenSegment] = useState<string | null>(null);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFiles = useCallback(async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setBusy(true);
    const problems: string[] = [];
    const parsed: Track[] = [];
    const files = Array.from(fileList);

    for (let i = 0; i < files.length; i++) {
      const file = files[i]!;
      try {
        const text = await file.text();
        parsed.push(parseGpx(text, file.name, i));
      } catch (error) {
        problems.push(`${file.name}: ${(error as Error).message}`);
      }
    }

    setTracks((prev) => {
      const combined = [...prev, ...parsed];
      return combined.map((track, i) => ({
        ...track,
        color: TRACK_PALETTE[i % TRACK_PALETTE.length]!,
      }));
    });
    setErrors(problems);
    setBusy(false);
  }, []);

  const segments = useMemo(() => {
    if (tracks.length < 2) return [];
    try {
      return findCommonSegments(tracks);
    } catch {
      return [];
    }
  }, [tracks]);

  const referenceTrack = useMemo(
    () =>
      tracks.length
        ? tracks.reduce((a, b) => (b.points.length > a.points.length ? b : a))
        : null,
    [tracks],
  );

  const contextPath = useMemo<Array<[number, number]>>(() => {
    if (!referenceTrack) return [];
    const pts = referenceTrack.points;
    const step = Math.max(1, Math.floor(pts.length / 800));
    const out: Array<[number, number]> = [];
    for (let i = 0; i < pts.length; i += step) out.push([pts[i]!.lat, pts[i]!.lon]);
    return out;
  }, [referenceTrack]);

  const selectedTrack = useMemo(
    () => tracks.find((t) => t.id === selectedTrackId) ?? null,
    [tracks, selectedTrackId],
  );

  const selectedPath = useMemo<Array<[number, number]>>(() => {
    if (!selectedTrack) return [];
    const pts = selectedTrack.points;
    const step = Math.max(1, Math.floor(pts.length / 900));
    const out: Array<[number, number]> = [];
    for (let i = 0; i < pts.length; i += step) out.push([pts[i]!.lat, pts[i]!.lon]);
    const last = pts[pts.length - 1]!;
    out.push([last.lat, last.lon]);
    return out;
  }, [selectedTrack]);

  const selectedSegments = useMemo(
    () =>
      selectedTrack
        ? segments.filter((s) => s.efforts.some((e) => e.trackId === selectedTrack.id))
        : [],
    [segments, selectedTrack],
  );


  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/70 bg-surface/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-5 py-5">
          <span className="flex size-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Bike className="size-5" />
          </span>
          <div>
            <h1 className="font-display text-xl uppercase tracking-[0.18em] text-foreground">
              Tramos
            </h1>
            <p className="text-xs text-muted-foreground">
              Comparador de rendimiento para rutas GPX de carretera
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-24 pt-10">
        <section className="max-w-2xl">
          <h2 className="font-display text-3xl leading-tight sm:text-4xl">
            Sube tus salidas y descubre en qué tramos has mejorado
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Todo el análisis ocurre en tu navegador: tus archivos no salen de tu
            ordenador. Añade dos o más GPX que compartan carretera y te mostramos cada
            tramo repetido con tiempos, velocidad media y desnivel.
          </p>
        </section>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void handleFiles(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          className={`mt-8 cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition-colors ${
            dragging
              ? "border-primary bg-primary/10"
              : "border-border bg-surface/50 hover:border-primary/60 hover:bg-surface"
          }`}
        >
          <Upload className="mx-auto size-7 text-primary" />
          <p className="mt-3 font-medium">Arrastra aquí tus archivos GPX</p>
          <p className="mt-1 text-sm text-muted-foreground">
            o haz clic para seleccionarlos · varios a la vez
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".gpx,application/gpx+xml"
            multiple
            className="hidden"
            onChange={(e) => {
              void handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {busy && (
          <p className="mt-4 text-sm text-muted-foreground">Analizando recorridos…</p>
        )}

        {errors.length > 0 && (
          <ul className="mt-4 space-y-1 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive-foreground">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        )}

        {tracks.length > 0 && (
          <section className="mt-10">
            <SectionTitle>Salidas cargadas ({tracks.length})</SectionTitle>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {tracks.map((track) => (
                <article
                  key={track.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedTrackId(track.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedTrackId(track.id);
                    }
                  }}
                  className="cursor-pointer rounded-xl border border-border bg-surface p-4 transition-colors hover:border-primary/60 hover:bg-elevated"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: track.color }}
                        />
                        <h3 className="truncate text-sm font-medium">{track.name}</h3>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDate(track.date)}
                      </p>
                    </div>
                    <button
                      aria-label="Quitar salida"
                      onClick={(e) => {
                        e.stopPropagation();
                        setTracks((prev) => prev.filter((t) => t.id !== track.id));
                      }}
                      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  <dl className="mt-4 grid grid-cols-3 gap-2 font-mono text-xs">
                    <Stat label="Dist." value={formatDistance(track.distance)} />
                    <Stat label="Tiempo" value={formatDuration(track.duration)} />
                    <Stat label="Desnivel" value={`${Math.round(track.elevationGain)} m`} />
                  </dl>
                </article>
              ))}
            </div>
          </section>
        )}

        {tracks.length === 1 && (
          <p className="mt-8 rounded-lg border border-border bg-surface p-4 text-sm text-muted-foreground">
            Añade al menos una salida más para poder comparar tramos.
          </p>
        )}

        {tracks.length >= 2 && (
          <section className="mt-12">
            <SectionTitle>
              Tramos comunes detectados ({segments.length})
            </SectionTitle>
            {segments.length === 0 ? (
              <p className="mt-4 rounded-lg border border-border bg-surface p-4 text-sm text-muted-foreground">
                No hemos encontrado tramos de al menos 500 m que se repitan en la misma
                dirección entre estas salidas.
              </p>
            ) : (
              <div className="mt-4 space-y-4">
                {segments.map((segment) => {
                  const open = openSegment === segment.id;
                  return (
                    <article
                      key={segment.id}
                      className="overflow-hidden rounded-2xl border border-border bg-surface"
                    >
                      <button
                        onClick={() => setOpenSegment(open ? null : segment.id)}
                        className="flex w-full flex-wrap items-center justify-between gap-4 p-5 text-left transition-colors hover:bg-elevated"
                      >
                        <div>
                          <p className="font-display text-lg">Tramo {segment.index}</p>
                          <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <ArrowDownUp className="size-3.5" />
                              {formatDistance(segment.distance)}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Mountain className="size-3.5" />
                              {Math.round(segment.elevationGain)} m D+
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Gauge className="size-3.5" />
                              {segment.avgGrade.toFixed(1)}%
                            </span>
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {segment.efforts.map((effort) => (
                            <span
                              key={effort.trackId}
                              className="size-2.5 rounded-full"
                              style={{ backgroundColor: effort.color }}
                            />
                          ))}
                          <span className="ml-2 text-xs uppercase tracking-widest text-muted-foreground">
                            {open ? "Cerrar" : "Ver detalle"}
                          </span>
                        </div>
                      </button>

                      <div className="border-t border-border/70">
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[620px] text-sm">
                            <thead>
                              <tr className="text-left font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                                <th className="px-5 py-3 font-normal">Salida</th>
                                <th className="px-5 py-3 font-normal">
                                  <Timer className="mr-1 inline size-3.5" />
                                  Tiempo
                                </th>
                                <th className="px-5 py-3 font-normal">Dif.</th>
                                <th className="px-5 py-3 font-normal">Vel. media</th>
                                <th className="px-5 py-3 font-normal">D+</th>
                              </tr>
                            </thead>
                            <tbody>
                              {segment.efforts.map((effort) => (
                                <tr
                                  key={effort.trackId}
                                  className="border-t border-border/50"
                                >
                                  <td className="px-5 py-3">
                                    <span className="flex items-center gap-2">
                                      <span
                                        className="size-2.5 rounded-full"
                                        style={{ backgroundColor: effort.color }}
                                      />
                                      <span className="truncate">{effort.trackName}</span>
                                      {effort.isBest && (
                                        <span className="rounded bg-primary/15 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary">
                                          Mejor
                                        </span>
                                      )}
                                    </span>
                                    <span className="mt-0.5 block text-xs text-muted-foreground">
                                      {formatDate(effort.date)}
                                    </span>
                                  </td>
                                  <td className="px-5 py-3 font-mono">
                                    {effort.hasTime ? formatDuration(effort.duration) : "—"}
                                  </td>
                                  <td
                                    className={`px-5 py-3 font-mono ${
                                      effort.delta > 0
                                        ? "text-destructive"
                                        : "text-success"
                                    }`}
                                  >
                                    {effort.hasTime ? formatDelta(effort.delta) : "—"}
                                  </td>
                                  <td className="px-5 py-3 font-mono">
                                    {effort.speed ? `${effort.speed.toFixed(1)} km/h` : "—"}
                                  </td>
                                  <td className="px-5 py-3 font-mono">
                                    {Math.round(effort.elevationGain)} m
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {open && (
                          <div className="border-t border-border/70 p-5">
                            <ClientOnly
                              fallback={
                                <div className="h-72 w-full animate-pulse rounded-xl bg-elevated" />
                              }
                            >
                              <Suspense
                                fallback={
                                  <div className="h-72 w-full animate-pulse rounded-xl bg-elevated" />
                                }
                              >
                                <SegmentMap
                                  path={segment.path}
                                  context={contextPath}
                                  className="h-72 w-full overflow-hidden rounded-xl"
                                />
                              </Suspense>
                            </ClientOnly>
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

const TRACK_PALETTE = [
  "#f97316",
  "#22d3ee",
  "#a3e635",
  "#f472b6",
  "#facc15",
  "#818cf8",
  "#34d399",
  "#fb7185",
];

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-display text-sm uppercase tracking-[0.22em] text-muted-foreground">
      {children}
    </h2>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 text-foreground">{value}</dd>
    </div>
  );
}
