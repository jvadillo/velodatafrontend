import {
  Component,
  lazy,
  Suspense,
  useEffect,
  useState,
  type ReactNode,
  type FormEvent,
} from "react";
import { Bike } from "lucide-react";
import { api, ApiError } from "./lib/api";
import { formatDistance, formatDuration, type Track } from "./lib/gpx";
const Dashboard = lazy(() => import("./routes/index"));
const SegmentMap = lazy(() => import("./components/SegmentMap"));
export interface User {
  id: string;
  email: string;
  verified: boolean;
}
const button =
  "rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground disabled:opacity-50";
const input = "mt-2 w-full rounded-lg border border-border bg-background p-3 text-foreground";

class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    return this.state.failed ? (
      <main className="p-8">
        <p>No se pudo mostrar la aplicación.</p>
        <button className={button} onClick={() => location.reload()}>
          Recargar
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <Application />
    </ErrorBoundary>
  );
}
function Application() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [connectionError, setConnectionError] = useState("");
  const [revision, setRevision] = useState(0);
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const change = () => setHash(location.hash);
    const expired = () => setUser(null);
    window.addEventListener("hashchange", change);
    window.addEventListener("session-expired", expired);
    return () => {
      window.removeEventListener("hashchange", change);
      window.removeEventListener("session-expired", expired);
    };
  }, []);
  useEffect(() => {
    let active = true;
    setReady(false);
    setConnectionError("");
    api<User>("/auth/me")
      .then((u) => {
        if (active) setUser(u);
      })
      .catch((e) => {
        if (active && (!(e instanceof ApiError) || e.status !== 401)) setConnectionError(e.message);
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, [revision]);
  const sharedToken = hash.startsWith("#share=") ? hash.slice(7) : null;
  if (sharedToken) return <SharedTrack token={sharedToken} />;
  if (!ready)
    return (
      <Shell>
        <p role="status">Cargando VeloData…</p>
      </Shell>
    );
  if (connectionError)
    return (
      <Shell>
        <p role="alert">{connectionError}</p>
        <button className={button} onClick={() => setRevision((v) => v + 1)}>
          Reintentar
        </button>
      </Shell>
    );
  if (!user || hash.startsWith("#verify=") || hash.startsWith("#reset="))
    return <Auth onLogin={setUser} hash={hash} />;
  return (
    <Suspense fallback={<Shell>Cargando tus salidas…</Shell>}>
      <Dashboard
        key={user.id}
        user={user}
        onLogout={async () => {
          await api("/auth/logout", { method: "POST" });
          setUser(null);
        }}
      />
    </Suspense>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 py-12 text-foreground">
      <section className="w-full max-w-md rounded-2xl border border-border bg-surface p-8">
        <a
          href="/"
          className="mb-8 flex items-center gap-3 font-display text-2xl uppercase tracking-widest"
        >
          <Bike className="text-primary" /> VeloData
        </a>
        {children}
      </section>
    </main>
  );
}

function Auth({ onLogin, hash }: { onLogin: (user: User) => void; hash: string }) {
  const [mode, setMode] = useState<"login" | "register" | "reset" | "verify">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [mailEnabled, setMailEnabled] = useState(true);
  useEffect(() => {
    api<{ email_enabled: boolean }>("/config")
      .then((c) => setMailEnabled(c.email_enabled))
      .catch(() => {});
  }, []);
  const action = hash.startsWith("#verify=")
    ? "verify"
    : hash.startsWith("#reset=")
      ? "reset"
      : null;
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (action) {
        const result = await api<{ message: string }>(`/auth/${action}`, {
          method: "POST",
          body: JSON.stringify({
            token: hash.split("=")[1],
            ...(action === "reset" ? { password } : {}),
          }),
        });
        setMessage(result.message);
        location.hash = "";
        setMode("login");
        setPassword("");
      } else if (mode === "login") {
        onLogin(
          await api<User>("/auth/login", {
            method: "POST",
            body: JSON.stringify({ email, password }),
          }),
        );
      } else {
        const path = mode === "register" ? "/auth/register" : `/auth/request-email?purpose=${mode}`;
        const result = await api<{ message: string }>(path, {
          method: "POST",
          body: JSON.stringify({ email, ...(mode === "register" ? { password } : {}) }),
        });
        setMessage(result.message);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const title =
    action === "verify"
      ? "Verifica tu email"
      : action === "reset"
        ? "Nueva contraseña"
        : mode === "login"
          ? "Tus salidas, tu evolución"
          : mode === "register"
            ? "Crea tu cuenta"
            : mode === "verify"
              ? "Reenviar verificación"
              : "Recupera tu contraseña";
  return (
    <Shell>
      <h1 className="font-display text-3xl">{title}</h1>
      <p className="mb-6 mt-3 text-sm text-muted-foreground">
        Guarda tus GPX de forma privada y compara tu rendimiento en los tramos que repites.
      </p>
      {!mailEnabled && (
        <p className="mb-4 rounded border border-border p-3 text-sm">
          El registro y los correos estarán disponibles cuando se active el servicio de email.
        </p>
      )}
      <form onSubmit={submit} className="space-y-5">
        {!action && (
          <label className="block text-sm">
            Email
            <input
              className={input}
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
        )}
        {(action === "reset" || (!action && (mode === "login" || mode === "register"))) && (
          <label className="block text-sm">
            Contraseña
            <input
              className={input}
              type="password"
              autoComplete={mode === "login" && !action ? "current-password" : "new-password"}
              required
              minLength={12}
              maxLength={128}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <span className="mt-2 block text-xs text-muted-foreground">
              Al menos 12 caracteres.
            </span>
          </label>
        )}
        {error && (
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="text-sm text-green-400">
            {message}
          </p>
        )}
        <button
          disabled={busy || (!mailEnabled && !action && mode !== "login")}
          className={`${button} w-full`}
        >
          {busy
            ? "Un momento…"
            : action === "verify"
              ? "Confirmar email"
              : action === "reset"
                ? "Guardar contraseña"
                : mode === "login"
                  ? "Entrar"
                  : mode === "register"
                    ? "Crear cuenta"
                    : "Enviar email"}
        </button>
      </form>
      <nav
        aria-label="Acceso a la cuenta"
        className="mt-6 flex flex-wrap gap-4 text-xs text-muted-foreground"
      >
        {(
          [
            ["login", "Iniciar sesión"],
            ["register", "Crear cuenta"],
            ["reset", "Olvidé mi contraseña"],
            ["verify", "Reenviar verificación"],
          ] as const
        )
          .filter(([m]) => m !== mode || action)
          .map(([m, label]) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                setError("");
                setMessage("");
                location.hash = "";
              }}
            >
              {label}
            </button>
          ))}
      </nav>
    </Shell>
  );
}

function SharedTrack({ token }: { token: string }) {
  const [track, setTrack] = useState<Track | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setTrack(null);
    setError("");
    api<Track>(`/shared/${encodeURIComponent(token)}`)
      .then((t) => {
        if (active) setTrack(t);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [token]);
  if (error)
    return (
      <Shell>
        <p role="alert">{error}</p>
      </Shell>
    );
  if (!track) return <Shell>Cargando salida compartida…</Shell>;
  return (
    <main className="mx-auto min-h-screen max-w-5xl p-6 text-foreground">
      <a href="/" className="text-primary">
        VeloData
      </a>
      <p className="mt-8 text-xs uppercase tracking-widest text-muted-foreground">
        Salida compartida · Solo lectura
      </p>
      <h1 className="my-4 font-display text-4xl">{track.name}</h1>
      <p className="mb-6">
        {formatDistance(track.distance)} · {formatDuration(track.duration)} ·{" "}
        {Math.round(track.elevationGain)} m D+
      </p>
      <Suspense fallback={<p>Cargando mapa…</p>}>
        <SegmentMap
          path={track.points.map((p) => [p.lat, p.lon])}
          className="h-[60vh] rounded-2xl"
        />
      </Suspense>
      <p className="mt-4 text-xs text-muted-foreground">
        El propietario puede revocar este enlace en cualquier momento.
      </p>
    </main>
  );
}
