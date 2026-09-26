# VeloData — prácticas de desarrollo

- Leer `progress.md` al comenzar y actualizarlo al terminar cada bloque, con estado real, validaciones y siguiente paso.
- Backend FastAPI en este repositorio; frontend independiente en `../velodatafronted`, derivado de jvadillo/velodata. No publicar cambios en el origen.
- Usar la interfaz existente; textos en español, estados de carga/error y accesibilidad básica.
- Aislar siempre por usuario en servidor. Un identificador de track no autoriza acceso. Tracks privados salvo enlace aleatorio y revocable creado por su propietario.
- Cookies HttpOnly, contraseñas Argon2, sesiones revocables y control de origen/CSRF. Nunca guardar tokens en localStorage ni secretos en Git o VITE_*.
- GPX no confiable: limitar tamaño, puntos y cuota; prohibir entidades XML; validar coordenadas y tiempos. No inventar rendimiento sin tiempos fiables.
- SQLAlchemy y migraciones Alembic versionadas. Evitar cambios destructivos; copia antes de migrar producción.
- Tests básicos de autenticación, aislamiento entre usuarios, GPX y compartición. Build y TypeScript del frontend. No añadir pruebas triviales ni infraestructura innecesaria.
- Docker Compose exclusivo `velodata`, volúmenes propios, límites de recursos, puertos solo loopback. No reiniciar ni modificar contenedores de otras apps.
- Desplegar frontend/backend por separado, con imágenes versionadas, caché y healthcheck. No usar `down -v`, `prune` global ni etiquetas de otras aplicaciones.
- No mezclar credenciales, bases de datos ni servicios de correo de otros proyectos.
- Documentar comandos reproducibles, limitaciones conocidas y cómo retomar. Explicaciones al usuario breves.
