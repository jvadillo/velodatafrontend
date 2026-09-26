import * as Slider from "@radix-ui/react-slider";
import type { TrackPoint } from "@/lib/gpx";
export function SegmentRange({
  points,
  start,
  end,
  onChange,
}: {
  points: TrackPoint[];
  start: number;
  end: number;
  onChange: (start: number, end: number) => void;
}) {
  const distance = points[end]!.d - points[start]!.d;
  return (
    <div className="space-y-3 py-2">
      <p className="text-sm text-muted-foreground">
        Arrastra los dos extremos para delimitar el segmento. También puedes ajustarlos con las
        flechas del teclado.
      </p>
      <Slider.Root
        min={0}
        max={points.length - 1}
        step={1}
        minStepsBetweenThumbs={1}
        value={[start, end]}
        onValueChange={([a, b]) => {
          if (a !== undefined && b !== undefined) onChange(a, b);
        }}
        className="relative flex h-10 w-full touch-none select-none items-center"
      >
        <Slider.Track className="relative h-2 grow rounded-full bg-sky-400/15">
          <Slider.Range className="absolute h-full rounded-full bg-sky-400" />
        </Slider.Track>
        {["Inicio del segmento", "Fin del segmento"].map((label, i) => (
          <Slider.Thumb
            key={label}
            aria-label={label}
            aria-valuetext={`${(points[i === 0 ? start : end]!.d / 1000).toFixed(2)} kilómetros`}
            className="block size-7 rounded-full border-2 border-sky-400 bg-background shadow focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-400"
          />
        ))}
      </Slider.Root>
      <div className="flex flex-wrap justify-between gap-2 font-mono text-xs text-sky-400">
        <span>Inicio {(points[start]!.d / 1000).toFixed(2)} km</span>
        <span>Fin {(points[end]!.d / 1000).toFixed(2)} km</span>
        <span>Selección: {(distance / 1000).toFixed(2)} km</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Longitud mínima: 100 m.{distance < 100 ? " Amplía la selección para guardar." : ""}
      </p>
    </div>
  );
}
