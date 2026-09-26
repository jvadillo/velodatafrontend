import { useState, type FormEvent } from "react";
import type { User } from "@/App";
import { api } from "@/lib/api";

export function Profile({ user }: { user: User }) {
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (password !== confirmation) {
      setError("Las contraseñas nuevas no coinciden.");
      return;
    }
    setBusy(true);
    try {
      await api("/auth/password", {
        method: "POST",
        body: JSON.stringify({ current_password: current, password }),
      });
      setCurrent("");
      setPassword("");
      setConfirmation("");
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="mt-8 max-w-xl rounded-2xl border border-border bg-surface p-6">
      <p className="break-all text-sm text-muted-foreground">{user.email}</p>
      <h2 className="mt-4 font-display text-xl">Cambiar contraseña</h2>
      {saved ? (
        <div className="mt-5">
          <p role="status">
            Contraseña actualizada. Por seguridad, se han cerrado todas tus sesiones.
          </p>
          <button
            onClick={() => {
              location.hash = "/";
              window.dispatchEvent(new Event("session-expired"));
            }}
            className="mt-5 rounded-lg bg-primary px-4 py-3 text-primary-foreground"
          >
            Iniciar sesión de nuevo
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-5 space-y-5">
          <p className="text-sm text-muted-foreground">
            Usa entre 12 y 128 caracteres. Al guardar tendrás que iniciar sesión de nuevo en tus
            dispositivos.
          </p>
          {(
            [
              ["Contraseña actual", current, setCurrent, "current-password"],
              ["Nueva contraseña", password, setPassword, "new-password"],
              ["Repetir nueva contraseña", confirmation, setConfirmation, "new-password"],
            ] as const
          ).map(([label, value, update, autocomplete]) => (
            <label key={label} className="block text-sm">
              {label}
              <input
                type="password"
                autoComplete={autocomplete}
                value={value}
                onChange={(e) => update(e.target.value)}
                required
                minLength={12}
                maxLength={128}
                className="mt-2 w-full rounded-lg border border-border bg-background p-3"
              />
            </label>
          ))}
          {error && (
            <p role="alert" className="text-sm text-red-400">
              {error}
            </p>
          )}
          <button
            disabled={busy}
            className="rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {busy ? "Guardando…" : "Guardar contraseña"}
          </button>
        </form>
      )}
    </section>
  );
}
