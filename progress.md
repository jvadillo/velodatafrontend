# VeloData frontend — progreso

## Actualización UI — 2026-09-26 (desplegada)

- Web activa: `velodata-web:ui-20260926-2`; API `velodata-api:ui-20260926-1`. HTTPS y servicios sanos.
- Menú superior en escritorio y panel lateral accesible en móvil. Páginas SPA con URLs `#/`, `#/tracks`, `#/tracks/:id`, `#/segments`, `#/profile`, `#/upload`; historial del navegador y recarga directa del detalle. Login lleva al resumen.
- Resumen independiente, tarjetas de rutas con minimapas que se cargan al entrar en pantalla y ordenación ascendente/descendente por fecha, distancia, velocidad y D+. Valores sin fecha/tiempos quedan al final.
- Detalle de ruta en página, con enlace de vuelta, compartir, mapa/perfil y slider de dos extremos para guardar segmentos de al menos 100 m. Selección celeste en mapa y altitud, con teclado; actualizar el rango conserva el mapa y el zoom.
- Mis segmentos separa los definidos por el usuario de los automáticos. Los manuales siguen guardados en API; automáticos se recalculan con el algoritmo existente.
- Perfil permite cambiar contraseña actual/nueva/confirmación. API valida la actual y revoca todas las sesiones y enlaces de recuperación; se solicita nuevo login.
- OSM: corregido `no-referrer` en HTML, Netlify y Caddy; `strict-origin-when-cross-origin` también explícito en teselas. Atribución visible y caché del navegador. Política contrastada: https://operations.osmfoundation.org/policies/tiles/ . Una tesela real con identificación VeloData/Referer devolvió mapa válido.
- Validación: TypeScript, build local y Docker, ESLint de archivos cambiados sin incidencias; 3 tests frontend; 5 tests API. Chromium con API real y SQLite temporal: importación, páginas, ordenación, recarga/atrás, slider, mapa/perfil, guardado/persistencia, separación de segmentos, móvil y cambio de contraseña/relogin. Teselas interceptadas en prueba automatizada, verificando Referer.
- Smoke HTTPS de producción: login, resumen, rutas, segmentos, perfil, menú móvil y logout; sin errores JS/CSP. Cuentas temporales eliminadas; contenedor y SQLite temporales retirados. Capturas: `/tmp/velodata-ui-check/` y `/tmp/velodata-ui-production/production-mobile-menu.png`.
- No cambia el algoritmo de coincidencias ni sus límites. Próximos pasos opcionales previos (renombrar, copias externas, Netlify) siguen pendientes.


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
