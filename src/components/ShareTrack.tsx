import { useState } from "react";
import { api } from "@/lib/api";
import type { Track } from "@/lib/gpx";

export function ShareTrack({
  track,
  onChange,
}: {
  track: Track;
  onChange: (token: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const url = track.shareToken ? `${location.origin}/#share=${track.shareToken}` : "";
  async function change() {
    if (
      !track.shareToken &&
      !window.confirm(
        "Cualquier persona con el enlace podrá ver el recorrido completo, incluidos inicio y final, y sus métricas. ¿Compartir esta salida?",
      )
    )
      return;
    setBusy(true);
    setError("");
    setCopied(false);
    try {
      if (track.shareToken) {
        await api(`/tracks/${track.id}/share`, { method: "DELETE" });
        onChange(null);
      } else {
        const result = await api<{ token: string }>(`/tracks/${track.id}/share`, {
          method: "POST",
        });
        onChange(result.token);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className="mt-4 border-t border-border pt-3 text-xs"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground">
          {track.shareToken ? "Compartida por enlace" : "Privada"}
        </span>
        <button
          className="rounded border border-border px-2 py-1 text-primary"
          disabled={busy}
          onClick={() => void change()}
        >
          {busy ? "Guardando…" : track.shareToken ? "Revocar enlace" : "Compartir"}
        </button>
      </div>
      {url && (
        <div className="mt-2">
          <input
            aria-label="Enlace para compartir"
            className="w-full rounded bg-background p-2"
            readOnly
            value={url}
            onFocus={(e) => e.target.select()}
          />
          <button
            className="mt-2 text-primary"
            onClick={() =>
              void navigator.clipboard
                .writeText(url)
                .then(() => setCopied(true))
                .catch(() => setError("Selecciona y copia el enlace."))
            }
          >
            {copied ? "Copiado" : "Copiar enlace"}
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
