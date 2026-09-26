# VeloData frontend — progreso

2026-09-26: primera versión funcional desplegada en **https://velodata.jonvadillo.com**.

Repositorio destino confirmado: **jvadillo/velodatafrontend** (creado por el usuario; nombre corregido respecto al pedido inicial). Carpeta local `/home/deploy/projects/velodatafronted`. Original `jvadillo/velodata` conservado como upstream, base 42dd71e. Publicado en GitHub, commit de implementación `24076df`; workflow de checks añadido (resultado remoto no consultado).

| Funcionalidad | Estado |
|---|---|
| Migrar frontend original a SPA estática Vite | Completo |
| Conservar diseño, mapas y elevación | Completo |
| Registro/login/logout | Completo |
| Verificación email y recuperación | Completo; FastAPI + Resend |
| Biblioteca GPX privada persistente y eliminación | Completo |
| Comparar rendimiento y tramos automáticos | Completo para alcance inicial; Web Worker |
| Tramos manuales persistentes | Completo |
| Compartir y revocar enlaces | Completo |
| Carga, errores y sesión caducada | Completo |
| Docker y Netlify independientes de API | Completo; Netlify requiere preparar dominio API |
| Renombrar tracks desde la interfaz | Pendiente opcional; API ya disponible |

Validado: TypeScript, build Docker/npm ci, 2 tests de comparación, lint de integración y Chromium contra HTTPS (cuentas aisladas, GPX, recarga, mapas, tramos, enlaces, cookie, móvil). Las cuentas de comprobación fueron eliminadas. Imagen desplegada `velodata-web:v1`.

La comparación es aproximada y usa la salida con más puntos como referencia. No cubre todos los pares ni corrige ambigüedades de bucles/caminos alternativos. GPX: 10 MB/30.000 puntos, hasta 100 salidas/300.000 puntos por cuenta; solo un tramo de grabación. Tiempo transcurrido incluye paradas. FIT/TCX y comparación entre usuarios quedan fuera de esta fase.

Retomar con `agents.md`, `README.md`, `npm ci`, `npm run typecheck && npm test && npm run build`. API por defecto `/api`; nunca introducir secretos en VITE_*. El backend reside en `/home/deploy/projects/velodata`, con el progreso global en `../velodata/progress.md` y los scripts de despliegue. Consultar ese archivo en el VPS para credenciales, operaciones y pendientes globales (sin secretos).
