import type { Track } from "./gpx";
const BASE = (import.meta.env["VITE_API_BASE_URL"] || "/api").replace(/\/$/, "");
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T = void>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      ...options,
      credentials: "include",
      headers: {
        ...(options.body && !(options.body instanceof FormData)
          ? { "Content-Type": "application/json" }
          : {}),
        "X-Velodata-Client": "web",
        ...options.headers,
      },
    });
  } catch {
    throw new ApiError("No se pudo conectar. Comprueba tu conexión e inténtalo de nuevo.", 0);
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    if (response.status === 401 && !path.startsWith("/auth/"))
      window.dispatchEvent(new Event("session-expired"));
    throw new ApiError(
      typeof data.detail === "string"
        ? data.detail
        : "No se pudo completar la solicitud. Revisa los datos.",
      response.status,
    );
  }
  return response.status === 204 ? (undefined as T) : (response.json() as Promise<T>);
}
export async function uploadTrack(file: File) {
  if (file.size > 10 * 1024 * 1024) throw new Error("El archivo supera 10 MB.");
  const body = new FormData();
  body.append("file", file);
  return api<Track>("/tracks", { method: "POST", body });
}
