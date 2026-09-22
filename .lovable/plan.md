# Perfil de altitud sincronizado

## Qué se añadirá
- Un perfil de altitud inmediatamente debajo del mapa en el detalle de cada salida.
- Ejes y lectura precisa de altitud y distancia, manteniendo una visualización clara aunque el GPX tenga muchos puntos.
- Sincronización en ambos sentidos: al recorrer el perfil se marcará la posición correspondiente en el mapa; al pulsar una ubicación de la ruta en el mapa se resaltará el punto y su altitud en el perfil.
- El marcador conservará la selección más reciente para poder comparar mapa, distancia y altitud.

## Detalles técnicos
- Crear un componente SVG ligero para el perfil, sin añadir dependencias nuevas.
- Compartir el índice del punto activo desde la vista de detalle.
- Ampliar el mapa para mostrar un marcador activo y comunicar pulsaciones, sin reinicializarlo durante la interacción.
- Mantener el funcionamiento local en el navegador y los colores actuales de los tramos compartidos.

## Verificación
- Probar con archivos GPX y confirmar visualmente la sincronización perfil → mapa y mapa → perfil.
- Revisar la vista de detalle en escritorio y en un ancho móvil.
- Confirmar que la aplicación compila sin errores.
