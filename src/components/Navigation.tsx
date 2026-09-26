import { useState } from "react";
import { Bike, LogOut, Menu, Upload } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "./ui/sheet";

export function Navigation({ page, onLogout }: { page: string; onLogout: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const links = [
    ["/", "Resumen"],
    ["/tracks", "Mis rutas"],
    ["/segments", "Mis segmentos"],
    ["/profile", "Mi Perfil"],
  ];
  const items = (
    <>
      {links.map(([path, label]) => (
        <a
          key={path}
          href={`#${path}`}
          aria-current={
            page === path || (path === "/tracks" && page.startsWith("/tracks/"))
              ? "page"
              : undefined
          }
          onClick={() => setOpen(false)}
          className="rounded-lg px-3 py-3 text-sm text-muted-foreground transition-colors hover:bg-elevated hover:text-foreground aria-[current=page]:bg-primary/10 aria-[current=page]:text-primary"
        >
          {label}
        </a>
      ))}
      <a
        href="#/upload"
        onClick={() => setOpen(false)}
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground"
      >
        <Upload className="size-4" />
        Añadir tracks
      </a>
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await onLogout();
          } finally {
            setBusy(false);
          }
        }}
        className="inline-flex items-center gap-2 rounded-lg px-3 py-3 text-sm text-muted-foreground hover:bg-elevated disabled:opacity-50"
      >
        <LogOut className="size-4" />
        Cerrar sesión
      </button>
    </>
  );
  return (
    <header className="border-b border-border bg-surface/90">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-4">
        <a
          href="#/"
          aria-label="VeloData · Resumen"
          className="flex items-center gap-3 font-display text-xl uppercase tracking-widest"
        >
          <Bike className="size-7 text-primary" />
          VeloData
        </a>
        <nav aria-label="Menú principal" className="hidden items-center gap-1 lg:flex">
          {items}
        </nav>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button
              aria-label="Abrir menú"
              className="rounded-lg border border-border p-3 lg:hidden"
            >
              <Menu className="size-5" />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="overflow-y-auto">
            <SheetTitle>VeloData</SheetTitle>
            <SheetDescription>Tus rutas y tu evolución</SheetDescription>
            <nav aria-label="Menú móvil" className="mt-8 flex flex-col gap-2">
              {items}
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
