# VeloData frontend

Frontend React + TypeScript + Vite, basado en `jvadillo/velodata` (42dd71e). Se mantienen su interfaz, mapas Leaflet, perfiles de elevación y comparación de salidas. Aplicación estática independiente de FastAPI.

```bash
npm ci
npm run dev        # http://localhost:5173; proxy API localhost:8001
npm run typecheck
npm test
npm run build      # dist/
```

API pública configurable mediante `VITE_API_BASE_URL` (por defecto `/api`). Nunca introducir secretos en variables VITE. Autenticación mediante cookie HttpOnly: usar proxy de mismo origen.

`netlify.toml` configura build y fallback SPA. Antes de migrar a Netlify hay que crear `velodata-api.jonvadillo.com` en el VPS y activar su proxy Caddy; pasos completos en el README del backend. El frontend puede desplegarse sin reconstruir ni reiniciar FastAPI.

Producción: https://velodata.jonvadillo.com. Repositorio remoto: `jvadillo/velodatafrontend` (nombre creado por el propietario). Carpeta local: `/home/deploy/projects/velodatafronted` por compatibilidad con los scripts de despliegue.

Ver [progress.md](progress.md) y [agents.md](agents.md) antes de continuar. `upstream` conserva el original; publicar únicamente en `origin`.
