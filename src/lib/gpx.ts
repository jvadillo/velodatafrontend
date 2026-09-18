export interface TrackPoint {
  lat: number;
  lon: number;
  ele: number;
  /** epoch ms, 0 if the file has no timestamps */
  t: number;
  /** cumulative distance in meters */
  d: number;
}

export interface Track {
  id: string;
  name: string;
  fileName: string;
  date: number | null;
  color: string;
  points: TrackPoint[];
  distance: number;
  duration: number;
  elevationGain: number;
}

const R = 6371000;

export function haversine(
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number,
): number {
  const toRad = Math.PI / 180;
  const dLat = (bLat - aLat) * toRad;
  const dLon = (bLon - aLon) * toRad;
  const la1 = aLat * toRad;
  const la2 = bLat * toRad;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export const TRACK_COLORS = [
  "#f97316",
  "#22d3ee",
  "#a3e635",
  "#f472b6",
  "#facc15",
  "#818cf8",
  "#34d399",
  "#fb7185",
];

export function parseGpx(xml: string, fileName: string, index: number): Track {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.querySelector("parsererror")) {
    throw new Error("El archivo no es un GPX válido");
  }
  const nodes = Array.from(doc.getElementsByTagName("trkpt"));
  if (nodes.length < 10) {
    throw new Error("El archivo no contiene un recorrido con suficientes puntos");
  }

  const points: TrackPoint[] = [];
  let cumulative = 0;
  for (const node of nodes) {
    const lat = parseFloat(node.getAttribute("lat") ?? "");
    const lon = parseFloat(node.getAttribute("lon") ?? "");
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const eleText = node.getElementsByTagName("ele")[0]?.textContent;
    const timeText = node.getElementsByTagName("time")[0]?.textContent;
    const ele = eleText ? parseFloat(eleText) : 0;
    const t = timeText ? Date.parse(timeText) : 0;
    const prev = points[points.length - 1];
    if (prev) {
      const step = haversine(prev.lat, prev.lon, lat, lon);
      // drop duplicated / GPS-noise points
      if (step < 0.5 && t - prev.t < 3000) continue;
      cumulative += step;
    }
    points.push({ lat, lon, ele: Number.isFinite(ele) ? ele : 0, t: t || 0, d: cumulative });
  }

  if (points.length < 10) throw new Error("El recorrido tiene muy pocos puntos");

  const nameNode =
    doc.getElementsByTagName("trk")[0]?.getElementsByTagName("name")[0]?.textContent;
  const first = points[0];
  const last = points[points.length - 1];

  return {
    id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
    name: nameNode?.trim() || fileName.replace(/\.gpx$/i, ""),
    fileName,
    date: first.t || null,
    color: TRACK_COLORS[index % TRACK_COLORS.length],
    points,
    distance: last.d,
    duration: first.t && last.t ? (last.t - first.t) / 1000 : 0,
    elevationGain: elevationGain(points, 0, points.length - 1),
  };
}

export function elevationGain(points: TrackPoint[], from: number, to: number): number {
  let gain = 0;
  let ref = points[from]?.ele ?? 0;
  for (let i = from + 1; i <= to && i < points.length; i++) {
    const e = points[i].ele;
    if (e > ref + 1) {
      gain += e - ref;
      ref = e;
    } else if (e < ref) {
      ref = e;
    }
  }
  return gain;
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m ${String(sec).padStart(2, "0")}s`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function formatDelta(seconds: number): string {
  if (Math.abs(seconds) < 0.5) return "0s";
  const sign = seconds > 0 ? "+" : "−";
  const s = Math.round(Math.abs(seconds));
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return m > 0 ? `${sign}${m}:${String(rest).padStart(2, "0")}` : `${sign}${rest}s`;
}

export function formatDistance(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(2)} km` : `${Math.round(meters)} m`;
}

export function formatDate(ts: number | null): string {
  if (!ts) return "Sin fecha";
  return new Date(ts).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
