import { test } from "node:test";
import assert from "node:assert/strict";
import { findCommonSegments } from "./segments";
import { manualEfforts, buildManualSegment } from "./manualSegments";
import type { Track } from "./gpx";
function track(id: string, step = 5000, reverse = false): Track {
  return {
    id,
    name: id,
    fileName: "test.gpx",
    date: 1000000,
    color: "#f97316",
    distance: 1000,
    duration: (100 * step) / 1000,
    elevationGain: 100,
    points: Array.from({ length: 101 }, (_, i) => ({
      lat: 42,
      lon: -2 + (reverse ? 100 - i : i) * 0.00012,
      ele: 500 + i,
      t: step ? 1000000 + i * step : 0,
      d: i * 10,
    })),
  };
}
test("common segments compare elapsed times and reject reverse direction", () => {
  const segments = findCommonSegments([track("a"), track("b", 6000)]);
  assert.equal(segments.length, 1);
  assert.equal(segments[0]!.efforts[0]!.trackId, "a");
  assert.equal(segments[0]!.efforts[1]!.delta, 100);
  assert.equal(findCommonSegments([track("a"), track("b", 6000, true)]).length, 0);
});
test("untimed tracks do not win; manual segments compare matching rides", () => {
  const a = track("a"),
    b = track("b", 0);
  const segment = buildManualSegment(a, 0, 100, "Climb");
  const efforts = manualEfforts(segment, [a, b]);
  assert.equal(efforts.length, 2);
  assert.equal(efforts[1]!.hasTime, false);
  assert.equal(efforts[1]!.isBest, false);
});

test("track sorting handles all metrics and puts missing dates/times last in either direction", async () => {
  const { sortTracks } = await import("./trackSort");
  const a = { ...track("a"), date: 300, distance: 3000, duration: 300, elevationGain: 50 };
  const b = { ...track("b"), date: 100, distance: 5000, duration: 1000, elevationGain: 200 };
  const c = { ...track("c"), date: null, distance: 1000, duration: 0, elevationGain: 100 };
  const library = [a, b, c];
  assert.deepEqual(
    sortTracks(library, "date", false).map((t) => t.id),
    ["a", "b", "c"],
  );
  assert.deepEqual(
    sortTracks(library, "date", true).map((t) => t.id),
    ["b", "a", "c"],
  );
  assert.deepEqual(
    sortTracks(library, "distance", false).map((t) => t.id),
    ["b", "a", "c"],
  );
  assert.deepEqual(
    sortTracks(library, "speed", false).map((t) => t.id),
    ["a", "b", "c"],
  );
  assert.deepEqual(
    sortTracks(library, "speed", true).map((t) => t.id),
    ["b", "a", "c"],
  );
  assert.deepEqual(
    sortTracks(library, "elevation", false).map((t) => t.id),
    ["b", "c", "a"],
  );
  assert.deepEqual(library, [a, b, c]);
});
