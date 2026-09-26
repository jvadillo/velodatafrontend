import { api, uploadTrack } from "@/lib/api";
import { ShareTrack } from "@/components/ShareTrack";
import { Navigation } from "@/components/Navigation";
import { usePage } from "@/hooks/use-page";
import { Profile } from "@/components/Profile";
import { TrackCard } from "@/components/TrackCard";
import { SegmentRange } from "@/components/SegmentRange";
import { sortTracks, type TrackSort } from "@/lib/trackSort";
import type { User } from "@/App";
const ClientOnly = ({ children }: { children: React.ReactNode; fallback?: React.ReactNode }) => (
  <>{children}</>
);
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownUp, Gauge, Mountain, Timer, Trash2, Upload } from "lucide-react";

import {
  formatDate,
  formatDelta,
  formatDistance,
  formatDuration,
  haversine,
  type Track,
} from "@/lib/gpx";
import { type CommonSegment, type SegmentEffort } from "@/lib/segments";
import { type ManualSegment } from "@/lib/manualSegments";

const SegmentMap = lazy(() => import("@/components/SegmentMap"));
const ElevationProfile = lazy(() => import("@/components/ElevationProfile"));
const SummaryChart = lazy(() => import("@/components/SummaryChart"));

export default function Dashboard({
  user,
  onLogout,
}: {
  user: User;
  onLogout: () => Promise<void>;
}) {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const page = usePage();
  const [sort, setSort] = useState<TrackSort>("date");
  const [ascending, setAscending] = useState(false);
  const [openSegment, setOpenSegment] = useState<string | null>(null);
  const selectedTrackId = page.startsWith("/tracks/") ? page.slice(8) : null;
  const sortedTracks = useMemo(
    () => sortTracks(tracks, sort, ascending),
    [tracks, sort, ascending],
  );
  const [activePointIndex, setActivePointIndex] = useState<number | null>(null);
  const [manualSegments, setManualSegments] = useState<ManualSegment[]>([]);
  const [draft, setDraft] = useState<{
    start: number | null;
    end: number | null;
    name: string;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [libraryError, setLibraryError] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([api<Track[]>("/tracks"), api<ManualSegment[]>("/segments")])
      .then(([saved, segments]) => {
        if (!active) return;
        setTracks(saved);
        setManualSegments(segments);

        setLibraryError(false);
      })
      .catch((e: Error) => {
        if (active) {
          setErrors([e.message]);
          setLibraryError(true);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [revision]);

  const handleFiles = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList?.length || busy || loading || libraryError) return;
      setBusy(true);
      const problems: string[] = [];
      let imported = 0;
      for (const file of Array.from(fileList)) {
        try {
          const track = await uploadTrack(file);
          setTracks((prev) =>
            [...prev, track].map((t, i) => ({
              ...t,
              color: TRACK_PALETTE[i % TRACK_PALETTE.length]!,
            })),
          );
          imported++;
        } catch (e) {
          problems.push(`${file.name}: ${(e as Error).message}`);
        }
      }
      setErrors(problems);
      if (imported && !problems.length) location.hash = "/tracks";
      setBusy(false);
    },
    [busy, loading, libraryError],
  );

  const removeTrack = async (id: string) => {
    if (
      !window.confirm(
        "¿Eliminar esta salida y sus tramos guardados? También se revocará su enlace compartido.",
      )
    )
      return;
    try {
      await api(`/tracks/${id}`, { method: "DELETE" });
      setTracks((prev) => prev.filter((t) => t.id !== id));
      setManualSegments((prev) => prev.filter((s) => s.trackId !== id));
      if (selectedTrackId === id) location.hash = "/tracks";
    } catch (e) {
      setErrors([(e as Error).message]);
    }
  };
  const removeSegment = async (id: string) => {
    try {
      await api(`/segments/${id}`, { method: "DELETE" });
      setManualSegments((prev) => prev.filter((s) => s.id !== id));
    } catch (e) {
      setErrors([(e as Error).message]);
    }
  };

  const [segments, setSegments] = useState<CommonSegment[]>([]);
  const [manualResults, setManualResults] = useState<Record<string, SegmentEffort[]>>({});
  const [analyzing, setAnalyzing] = useState(false);
  useEffect(() => {
    setSegments([]);
    setManualResults({});
    if (!tracks.length) {
      setAnalyzing(false);
      return;
    }
    const worker = new Worker(new URL("../lib/analysis.worker.ts", import.meta.url), {
      type: "module",
    });
    setAnalyzing(true);
    worker.onmessage = (
      event: MessageEvent<{
        segments?: CommonSegment[];
        manual?: Record<string, SegmentEffort[]>;
        error?: string;
      }>,
    ) => {
      setAnalyzing(false);
      if (event.data.error) setErrors([event.data.error]);
      else {
        setSegments(event.data.segments ?? []);
        setManualResults(event.data.manual ?? {});
      }
      worker.terminate();
    };
    worker.onerror = () => {
      setAnalyzing(false);
      setErrors(["No se pudo ejecutar la comparación. Recarga la página."]);
      worker.terminate();
    };
    worker.postMessage({ tracks, manual: manualSegments });
    return () => worker.terminate();
  }, [tracks, manualSegments]);

  const referenceTrack = useMemo(
    () =>
      tracks.length ? tracks.reduce((a, b) => (b.points.length > a.points.length ? b : a)) : null,
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

  const selectedHighlights = useMemo(
    () =>
      selectedTrack
        ? selectedSegments.map((segment) => {
            const mine = segment.efforts.find((e) => e.trackId === selectedTrack.id);
            return {
              path: segment.path,
              color: mine ? effortRankColor(mine, segment.efforts) : "#94a3b8",
            };
          })
        : [],
    [selectedSegments, selectedTrack],
  );

  useEffect(() => {
    setActivePointIndex(null);
    setDraft(null);
  }, [selectedTrackId]);

  const summary = useMemo(() => {
    const totalDistance = tracks.reduce((sum, t) => sum + t.distance, 0);
    const totalDuration = tracks.reduce((sum, t) => sum + t.duration, 0);
    const totalElevation = tracks.reduce((sum, t) => sum + t.elevationGain, 0);
    const timedDistance = tracks
      .filter((t) => t.duration > 0)
      .reduce((sum, t) => sum + t.distance, 0);
    const avgSpeed = totalDuration > 0 ? (timedDistance / totalDuration) * 3.6 : null;
    const maxSpeed = tracks.reduce((max, t) => Math.max(max, trackMaxSpeed(t)), 0);
    const dates = tracks.map((t) => t.date).filter((d): d is number => d !== null);
    return {
      totalDistance,
      totalDuration,
      totalElevation,
      avgSpeed,
      maxSpeed: maxSpeed > 0 ? maxSpeed : null,
      lastDate: dates.length ? Math.max(...dates) : null,
    };
  }, [tracks]);

  const summaryChartItems = useMemo(
    () =>
      tracks
        .filter((track): track is Track & { date: number } => track.date !== null)
        .map((track) => ({
          id: track.id,
          name: track.name,
          date: track.date,
          distance: track.distance,
          duration: track.duration,
          color: track.color,
        })),
    [tracks],
  );

  const selectNearestTrackPoint = useCallback(
    ([lat, lon]: [number, number]) => {
      if (!selectedTrack || selectedTrack.points.length === 0) return;
      let closestIndex = 0;
      let closestDistance = Number.POSITIVE_INFINITY;
      selectedTrack.points.forEach((point, index) => {
        const distance = haversine(lat, lon, point.lat, point.lon);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = index;
        }
      });
      setActivePointIndex(closestIndex);
    },
    [selectedTrack],
  );

  const activeMapPoint = useMemo<[number, number] | null>(() => {
    if (!selectedTrack || activePointIndex === null) return null;
    const point = selectedTrack.points[activePointIndex];
    return point ? [point.lat, point.lon] : null;
  }, [activePointIndex, selectedTrack]);

  const selectedManual = useMemo(() => {
    if (!selectedTrack) return [];
    return manualSegments.flatMap((segment) => {
      const efforts = manualResults[segment.id] ?? [];
      const mine = efforts.find((e) => e.trackId === selectedTrack.id);
      return mine ? [{ segment, efforts, mine }] : [];
    });
  }, [manualSegments, manualResults, selectedTrack]);

  const draftValid =
    !!draft &&
    draft.start !== null &&
    draft.end !== null &&
    !!selectedTrack &&
    Math.abs(
      (selectedTrack.points[draft.end]?.d ?? 0) - (selectedTrack.points[draft.start]?.d ?? 0),
    ) >= 100;

  const saveDraft = async () => {
    if (!draftValid || !draft || !selectedTrack || busy) return;
    setBusy(true);
    try {
      const saved = await api<ManualSegment>("/segments", {
        method: "POST",
        body: JSON.stringify({
          track_id: selectedTrack.id,
          start: draft.start,
          end: draft.end,
          name: draft.name.trim() || `Mi tramo ${manualSegments.length + 1}`,
        }),
      });
      setManualSegments((prev) => [...prev, saved]);
      setDraft(null);
    } catch (e) {
      setErrors([(e as Error).message]);
    } finally {
      setBusy(false);
    }
  };

  const mapHighlights = useMemo(() => {
    const list = [
      ...selectedHighlights,
      ...selectedManual.map(({ segment, efforts, mine }) => ({
        path: segment.path,
        color: effortRankColor(mine, efforts),
      })),
    ];
    if (selectedTrack && draft && draft.start !== null && draft.end !== null) {
      const s = Math.min(draft.start, draft.end);
      const e = Math.max(draft.start, draft.end);
      const path: Array<[number, number]> = [];
      const step = Math.max(1, Math.floor((e - s) / 300));
      for (let k = s; k <= e; k += step) {
        const p = selectedTrack.points[k]!;
        path.push([p.lat, p.lon]);
      }
      const last = selectedTrack.points[e]!;
      path.push([last.lat, last.lon]);
      return [{ path, color: "#38bdf8" }];
    }
    return list;
  }, [selectedHighlights, selectedManual, selectedTrack, draft]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation
        page={page}
        onLogout={() => onLogout().catch((e: Error) => setErrors([e.message]))}
      />

      <main className="mx-auto max-w-6xl px-5 pb-24 pt-10">
        {!selectedTrackId && (
          <div>
            <p className="mb-2 text-xs uppercase tracking-[0.2em] text-primary">
              Tu espacio ciclista
            </p>
            <h1 className="font-display text-3xl sm:text-4xl">
              {page === "/tracks"
                ? "Mis rutas"
                : page === "/segments"
                  ? "Mis segmentos"
                  : page === "/profile"
                    ? "Mi Perfil"
                    : page === "/upload"
                      ? "Añadir tracks"
                      : "Resumen de tus salidas"}
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              {page === "/tracks"
                ? "Todos tus recorridos, de un vistazo."
                : page === "/segments"
                  ? "Compara tus tiempos y distingue los tramos que has definido de las coincidencias automáticas."
                  : page === "/upload"
                    ? "Importa tus archivos GPX. Tus rutas se guardan de forma privada."
                    : page === "/profile"
                      ? "Gestiona la contraseña de tu cuenta."
                      : "Tu distancia, desnivel y evolución en un mismo panel."}
            </p>
          </div>
        )}
        {page === "/profile" && <Profile user={user} />}
        {!loading && !libraryError && selectedTrackId && !selectedTrack && (
          <p className="mt-6" role="alert">
            Esta salida no existe o ya no está disponible.{" "}
            <a className="text-primary underline" href="#/tracks">
              Volver a Mis rutas
            </a>
          </p>
        )}
        {!loading &&
          !libraryError &&
          tracks.length === 0 &&
          (page === "/" || page === "/tracks") && (
            <p className="mt-8 rounded-xl border border-border bg-surface p-6">
              Aún no tienes salidas.{" "}
              <a className="text-primary underline" href="#/upload">
                Añade tu primer track
              </a>{" "}
              para empezar.
            </p>
          )}

        {loading && (
          <p className="mt-6" role="status">
            Cargando tu biblioteca…
          </p>
        )}
        {libraryError && (
          <button className="mt-4 rounded border p-3" onClick={() => setRevision((v) => v + 1)}>
            Reintentar carga
          </button>
        )}
        {!loading && !libraryError && page === "/upload" && (
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
            role="button"
            tabIndex={0}
            aria-label="Seleccionar archivos GPX"
            onKeyDown={(e) => {
              if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                inputRef.current?.click();
              }
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
              o haz clic para seleccionarlos · hasta 10 MB y 30.000 puntos por archivo
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
        )}

        {(busy || analyzing) && (
          <p className="mt-4 text-sm text-muted-foreground">Analizando recorridos…</p>
        )}

        {errors.length > 0 && (
          <ul
            role="alert"
            className="mt-4 space-y-1 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive-foreground"
          >
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        )}

        {page === "/" && !loading && !libraryError && (
          <section className="mt-10 rounded-2xl border border-border bg-surface/60 p-5">
            <SectionTitle>Resumen</SectionTitle>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-5 font-mono sm:grid-cols-4">
              <SummaryStat label="Salidas" value={String(tracks.length)} />
              <SummaryStat
                label="Km totales"
                value={`${(summary.totalDistance / 1000).toFixed(1)} km`}
              />
              <SummaryStat label="Tiempo total" value={formatDuration(summary.totalDuration)} />
              <SummaryStat
                label="Desnivel acumulado"
                value={`${Math.round(summary.totalElevation)} m`}
              />
              <SummaryStat
                label="Velocidad media"
                value={summary.avgSpeed !== null ? `${summary.avgSpeed.toFixed(1)} km/h` : "—"}
              />
              <SummaryStat
                label="Velocidad máxima"
                value={summary.maxSpeed !== null ? `${summary.maxSpeed.toFixed(1)} km/h` : "—"}
              />
              <SummaryStat label="Tramos comunes" value={String(segments.length)} />
              <SummaryStat label="Última salida" value={formatDate(summary.lastDate)} />
            </dl>
            {summaryChartItems.length > 0 && (
              <div className="mt-6">
                <ClientOnly
                  fallback={<div className="h-52 w-full animate-pulse rounded-lg bg-elevated" />}
                >
                  <Suspense
                    fallback={<div className="h-52 w-full animate-pulse rounded-lg bg-elevated" />}
                  >
                    <SummaryChart items={summaryChartItems} />
                  </Suspense>
                </ClientOnly>
                {summaryChartItems.length < tracks.length && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Algunas salidas no tienen fecha en el GPX y no aparecen en la gráfica.
                  </p>
                )}
              </div>
            )}
          </section>
        )}

        {page === "/tracks" && tracks.length > 0 && (
          <section className="mt-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <SectionTitle>{tracks.length} salidas</SectionTitle>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <label htmlFor="track-sort">Ordenar por</label>
                <select
                  id="track-sort"
                  value={sort}
                  onChange={(e) => setSort(e.target.value as TrackSort)}
                  className="rounded-lg border border-border bg-surface p-2"
                >
                  <option value="date">Fecha</option>
                  <option value="distance">Distancia recorrida</option>
                  <option value="speed">Velocidad media</option>
                  <option value="elevation">Desnivel positivo</option>
                </select>
                <button
                  className="rounded-lg border border-border p-2"
                  onClick={() => setAscending((v) => !v)}
                  aria-label="Cambiar sentido de ordenación"
                >
                  {ascending ? "Ascendente ↑" : "Descendente ↓"}
                </button>
              </div>
            </div>
            <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {sortedTracks.map((track) => (
                <TrackCard
                  key={track.id}
                  track={track}
                  onRemove={() => void removeTrack(track.id)}
                  onShare={(token) =>
                    setTracks((prev) =>
                      prev.map((t) => (t.id === track.id ? { ...t, shareToken: token } : t)),
                    )
                  }
                />
              ))}
            </div>
          </section>
        )}

        {page === "/segments" && !loading && !libraryError && (
          <section className="mt-8">
            <SectionTitle>Definidos por ti ({manualSegments.length})</SectionTitle>
            <p className="mt-2 text-sm text-muted-foreground">
              Crea un segmento desde el detalle de cualquiera de tus rutas.
            </p>
            {manualSegments.length === 0 && (
              <p className="mt-4 rounded-xl border border-border p-5">
                Todavía no has definido segmentos.{" "}
                <a href="#/tracks" className="text-primary underline">
                  Ver mis rutas
                </a>
              </p>
            )}
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {manualSegments.map((segment) => (
                <article
                  key={segment.id}
                  className="rounded-xl border border-border bg-surface p-5"
                >
                  <span className="rounded bg-sky-400/10 px-2 py-1 text-xs text-sky-400">
                    Definido por ti
                  </span>
                  <h2 className="mt-3 font-display text-xl">{segment.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatDistance(segment.distance)}
                  </p>
                  <ul className="mt-4 space-y-2 text-sm">
                    {(manualResults[segment.id] ?? []).map((effort) => (
                      <li key={effort.trackId} className="flex justify-between gap-3">
                        <a
                          href={`#/tracks/${effort.trackId}`}
                          className="truncate text-primary hover:underline"
                        >
                          {effort.trackName}
                        </a>
                        <span className="shrink-0 font-mono">
                          {effort.hasTime ? formatDuration(effort.duration) : "Sin tiempos"}
                          {effort.isBest ? " · Mejor" : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-5 flex items-center justify-between gap-3">
                    <a
                      href={`#/tracks/${segment.trackId}`}
                      className="text-sm text-primary hover:underline"
                    >
                      Ver ruta de origen →
                    </a>
                    <button
                      aria-label={`Eliminar ${segment.name}`}
                      onClick={() => void removeSegment(segment.id)}
                      className="rounded-lg p-2 hover:bg-elevated"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {page === "/segments" && tracks.length < 2 && (
          <p className="mt-8 rounded-lg border border-border bg-surface p-4 text-sm text-muted-foreground">
            Añade al menos una salida más para poder comparar tramos.
          </p>
        )}

        {page === "/segments" && tracks.length >= 2 && !analyzing && (
          <section className="mt-12">
            <SectionTitle>Generados automáticamente ({segments.length})</SectionTitle>
            {segments.length === 0 ? (
              <p className="mt-4 rounded-lg border border-border bg-surface p-4 text-sm text-muted-foreground">
                No hemos encontrado tramos de al menos 500 m que se repitan en la misma dirección
                entre estas salidas.
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
                          <p className="mb-2 text-xs text-primary">Automático</p>
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
                                <tr key={effort.trackId} className="border-t border-border/50">
                                  <td className="px-5 py-3">
                                    <span className="flex items-center gap-2">
                                      <span
                                        className="size-2.5 rounded-full"
                                        style={{ backgroundColor: effort.color }}
                                      />
                                      <a
                                        href={`#/tracks/${effort.trackId}`}
                                        className="truncate hover:underline"
                                      >
                                        {effort.trackName}
                                      </a>
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
                                      effort.delta > 0 ? "text-destructive" : "text-success"
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
                                  className="h-80 w-full overflow-hidden rounded-xl sm:h-[420px]"
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

        {selectedTrack && (
          <section>
            <a
              href="#/tracks"
              className="mb-6 inline-flex items-center gap-2 text-sm text-primary hover:underline"
            >
              ← Volver a Mis rutas
            </a>
            <div className="rounded-2xl border border-border bg-surface">
              <div className="flex items-start justify-between gap-4 border-b border-border/70 p-5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: selectedTrack.color }}
                    />
                    <h1 className="break-words font-display text-2xl sm:text-3xl">
                      {selectedTrack.name}
                    </h1>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDate(selectedTrack.date)} · {selectedTrack.fileName}
                  </p>
                </div>
              </div>

              <div className="p-5">
                <dl className="grid grid-cols-2 gap-3 font-mono text-xs sm:grid-cols-4">
                  <Stat label="Dist." value={formatDistance(selectedTrack.distance)} />
                  <Stat label="Tiempo" value={formatDuration(selectedTrack.duration)} />
                  <Stat label="Desnivel" value={`${Math.round(selectedTrack.elevationGain)} m`} />
                  <Stat
                    label="Vel. media"
                    value={
                      selectedTrack.duration > 0
                        ? `${((selectedTrack.distance / selectedTrack.duration) * 3.6).toFixed(1)} km/h`
                        : "—"
                    }
                  />
                </dl>

                <ShareTrack
                  track={selectedTrack}
                  onChange={(token) =>
                    setTracks((prev) =>
                      prev.map((t) =>
                        t.id === selectedTrack.id ? { ...t, shareToken: token } : t,
                      ),
                    )
                  }
                />
                <div className="mt-5">
                  <div className="mb-3 rounded-lg border border-border bg-elevated/40 p-3 text-sm">
                    {!draft ? (
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-muted-foreground">
                          Crea tus propios tramos y compáralos con el resto de salidas.
                        </p>
                        <button
                          type="button"
                          onClick={() =>
                            setDraft({ start: 0, end: selectedTrack.points.length - 1, name: "" })
                          }
                          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
                        >
                          Definir tramo
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <SegmentRange
                          points={selectedTrack.points}
                          start={draft.start ?? 0}
                          end={draft.end ?? selectedTrack.points.length - 1}
                          onChange={(start, end) => setDraft((d) => d && { ...d, start, end })}
                        />
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <input
                            maxLength={100}
                            value={draft.name}
                            onChange={(e) => setDraft((d) => d && { ...d, name: e.target.value })}
                            placeholder={`Mi tramo ${manualSegments.length + 1}`}
                            aria-label="Nombre del tramo"
                            className="min-w-40 flex-1 rounded-md border border-border bg-background px-2 py-1.5"
                          />
                          <button
                            type="button"
                            disabled={!draftValid || busy}
                            onClick={saveDraft}
                            className="rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground disabled:opacity-40"
                          >
                            Guardar tramo
                          </button>
                          <button
                            type="button"
                            onClick={() => setDraft(null)}
                            className="rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  <ClientOnly
                    fallback={<div className="h-72 w-full animate-pulse rounded-xl bg-elevated" />}
                  >
                    <Suspense
                      fallback={
                        <div className="h-72 w-full animate-pulse rounded-xl bg-elevated" />
                      }
                    >
                      <SegmentMap
                        path={selectedPath}
                        color={selectedTrack.color}
                        highlights={mapHighlights}
                        activePoint={activeMapPoint}
                        onPathSelect={selectNearestTrackPoint}
                        className="h-80 w-full overflow-hidden rounded-xl sm:h-[420px]"
                      />
                    </Suspense>
                  </ClientOnly>
                  <div className="mt-3">
                    <Suspense
                      fallback={
                        <div className="h-48 w-full animate-pulse rounded-lg bg-elevated" />
                      }
                    >
                      <ElevationProfile
                        points={selectedTrack.points}
                        activeIndex={activePointIndex}
                        onActiveIndexChange={setActivePointIndex}
                        range={
                          draft && draft.start !== null && draft.end !== null
                            ? [draft.start, draft.end]
                            : null
                        }
                      />
                    </Suspense>
                  </div>
                  {selectedSegments.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="h-1 w-4 rounded-full"
                          style={{ backgroundColor: RANK_BEST }}
                        />
                        Mejor tiempo
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="h-1 w-4 rounded-full"
                          style={{ backgroundColor: RANK_MIDDLE }}
                        />
                        Intermedio
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="h-1 w-4 rounded-full"
                          style={{ backgroundColor: RANK_WORST }}
                        />
                        Peor tiempo
                      </span>
                    </div>
                  )}
                </div>

                <h4 className="mt-6 font-display text-sm uppercase tracking-[0.22em] text-muted-foreground">
                  Segmentos automáticos ({selectedSegments.length})
                </h4>

                {selectedSegments.length === 0 ? (
                  <p className="mt-3 rounded-lg border border-border bg-elevated/50 p-4 text-sm text-muted-foreground">
                    Esta salida no comparte tramos con el resto de recorridos cargados.
                  </p>
                ) : (
                  <div className="mt-3 space-y-3">
                    {selectedSegments.map((segment) => {
                      const mine = segment.efforts.find((e) => e.trackId === selectedTrack.id)!;
                      return (
                        <div
                          key={segment.id}
                          className="rounded-xl border border-border bg-elevated/40 p-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className="font-display text-base">Tramo {segment.index}</p>
                            <p className="flex flex-wrap gap-x-4 font-mono text-xs text-muted-foreground">
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
                          <dl className="mt-3 grid grid-cols-3 gap-2 font-mono text-xs">
                            <Stat
                              label="Tu tiempo"
                              value={mine.hasTime ? formatDuration(mine.duration) : "—"}
                            />
                            <Stat
                              label="Dif. mejor"
                              value={
                                mine.isBest ? "Mejor" : mine.hasTime ? formatDelta(mine.delta) : "—"
                              }
                            />
                            <Stat
                              label="Vel. media"
                              value={mine.speed ? `${mine.speed.toFixed(1)} km/h` : "—"}
                            />
                          </dl>
                          <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                            {segment.efforts
                              .filter((e) => e.trackId !== selectedTrack.id)
                              .map((e) => (
                                <li key={e.trackId} className="flex items-center gap-2">
                                  <span
                                    className="size-2 rounded-full"
                                    style={{ backgroundColor: e.color }}
                                  />
                                  <span className="truncate">{e.trackName}</span>
                                  <span className="ml-auto font-mono">
                                    {e.hasTime ? formatDuration(e.duration) : "—"}
                                  </span>
                                </li>
                              ))}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                )}

                <h4 className="mt-6 font-display text-sm uppercase tracking-[0.22em] text-muted-foreground">
                  Segmentos definidos por ti ({selectedManual.length})
                </h4>
                {selectedManual.length === 0 ? (
                  <p className="mt-3 rounded-lg border border-border bg-elevated/50 p-4 text-sm text-muted-foreground">
                    Aún no has definido tramos que pase esta salida. Pulsa "Definir tramo" junto al
                    mapa.
                  </p>
                ) : (
                  <div className="mt-3 space-y-3">
                    {selectedManual.map(({ segment, efforts, mine }) => (
                      <div
                        key={segment.id}
                        className="rounded-xl border border-border bg-elevated/40 p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="font-display text-base">{segment.name}</p>
                          <div className="flex items-center gap-3 font-mono text-xs text-muted-foreground">
                            <span>{formatDistance(segment.distance)}</span>
                            <span>{Math.round(mine.elevationGain)} m D+</span>
                            <span>{mine.avgGrade.toFixed(1)}%</span>
                            <button
                              type="button"
                              aria-label={`Eliminar ${segment.name}`}
                              onClick={() => void removeSegment(segment.id)}
                              className="rounded p-1 hover:bg-elevated hover:text-foreground"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        </div>
                        <dl className="mt-3 grid grid-cols-3 gap-2 font-mono text-xs">
                          <Stat
                            label="Tu tiempo"
                            value={mine.hasTime ? formatDuration(mine.duration) : "—"}
                          />
                          <Stat
                            label="Dif. mejor"
                            value={
                              mine.isBest ? "Mejor" : mine.hasTime ? formatDelta(mine.delta) : "—"
                            }
                          />
                          <Stat
                            label="Vel. media"
                            value={mine.speed ? `${mine.speed.toFixed(1)} km/h` : "—"}
                          />
                        </dl>
                        <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                          {efforts
                            .filter((e) => e.trackId !== selectedTrack.id)
                            .map((e) => (
                              <li key={e.trackId} className="flex items-center gap-2">
                                <span
                                  className="size-2 rounded-full"
                                  style={{ backgroundColor: e.color }}
                                />
                                <span className="truncate">{e.trackName}</span>
                                <span className="ml-auto font-mono">
                                  {e.hasTime ? formatDuration(e.duration) : "—"}
                                  {e.hasTime && !e.isBest ? ` (${formatDelta(e.delta)})` : ""}
                                </span>
                              </li>
                            ))}
                          {efforts.length === 1 && (
                            <li>Ninguna otra salida pasa por este tramo.</li>
                          )}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

const RANK_BEST = "#22c55e";
const RANK_MIDDLE = "#f97316";
const RANK_WORST = "#ef4444";

/** Traffic-light rank of an effort within its segment: best / middle / worst time. */
function effortRankColor(effort: SegmentEffort, all: SegmentEffort[]): string {
  const timed = all.filter((e) => e.hasTime && e.duration > 0);
  if (!effort.hasTime || timed.length === 0) return "#94a3b8";
  if (timed.length === 1) return RANK_BEST;
  const fastest = Math.min(...timed.map((e) => e.duration));
  const slowest = Math.max(...timed.map((e) => e.duration));
  if (effort.duration === fastest) return RANK_BEST;
  if (effort.duration === slowest) return RANK_WORST;
  return RANK_MIDDLE;
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

/** Highest sustained speed (km/h) in a track, from timestamps. 0 if untimed. */
function trackMaxSpeed(track: Track): number {
  let max = 0;
  const pts = track.points;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1]!;
    const cur = pts[i]!;
    if (prev.t === 0 || cur.t === 0) continue;
    const dt = (cur.t - prev.t) / 1000;
    if (dt < 1 || dt > 30) continue;
    const dist = cur.d - prev.d;
    if (dist <= 1) continue;
    const speed = (dist / dt) * 3.6;
    if (speed > max) max = speed;
  }
  return max;
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-xl font-medium text-foreground">{value}</dd>
    </div>
  );
}

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
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-foreground">{value}</dd>
    </div>
  );
}
