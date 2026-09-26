import { findCommonSegments } from "./segments";
import { manualEfforts, type ManualSegment } from "./manualSegments";
import type { Track } from "./gpx";
self.onmessage = (event: MessageEvent<{ tracks: Track[]; manual: ManualSegment[] }>) => {
  try {
    const { tracks, manual } = event.data;
    self.postMessage({
      segments: findCommonSegments(tracks),
      manual: Object.fromEntries(manual.map((s) => [s.id, manualEfforts(s, tracks)])),
    });
  } catch {
    self.postMessage({ error: "No se pudo completar la comparación de estas salidas." });
  }
};
