# Arquitectura

Se conserva la estructura existente de Astro estático, TypeScript y Tailwind. Las páginas generan HTML sin datos privados; el navegador consulta Firebase tras comprobar la sesión. No se ha creado otro proyecto ni una arquitectura paralela.

| Carpeta | Responsabilidad |
| --- | --- |
| app/src/pages | 14 pantallas Astro |
| app/src/modulos | Formularios, navegación, reserva y administración |
| app/src/datos | SDK Firebase, sesión, consultas y llamadas remotas |
| app/src/modelos | Tipos de cuenta, cita, servicio y horario |
| app/src/comun | Permisos de rutas, fechas, formularios y mensajes |
| functions/src | Validación y operaciones autorizadas del servidor |
| functions/tests y app/tests | Pruebas puras, emuladores y navegador |

## Datos y operaciones

users/{uid}: contacto, role y roleVersion; services/{id}: catálogo; config/app: timezone, siete days y revision; closedDays/{fecha}: cierres completos; bookings/{id}: propietario, snapshot, estado, fecha/hora y UTC; bookingLocks/{principal_fecha_hora}: reserva que ocupa una celda.

Los clientes solo escriben su contacto con las restricciones de Rules. Las escrituras de negocio pasan por 7 callables de europe-west1: getAvailability, createBooking, cancelBooking, completeBooking, saveService, saveSchedule y setClosedDay. Ninguna función pública asigna roles, inicializa datos o borra datos demo. El alta del administrador es una herramienta privada con simulación por defecto.

disponibilidad.js contiene el motor compartido de huecos. getAvailability lo usa para informar; crearReserva lo repite dentro de una transacción. Consulta servicio, horario, cierre y ocupación; después crea cita y una o dos celdas. El hash de UID + requestId identifica el documento y otro hash detecta que un mismo requestId se reutilice con datos diferentes.

Todas las operaciones que afectan a la agenda escriben revision en config/app. Este documento coordina reservas, cierres y cambios de horario en las carreras simultáneas. La transacción de Firestore vuelve a intentarse si cambia una lectura. Es una solución deliberadamente sencilla para una sola barbería y supone un límite de escalabilidad: no está diseñada para numerosas sedes o alto volumen concurrente.

El token, la cuenta actual de Auth y el perfil deben coincidir en rol y versión. Las Functions vuelven a leer el perfil dentro de la transacción. Los observadores de pantalla invalidan respuestas de una identidad anterior y limpian datos al cerrar sesión. La revocación de permisos en Rules depende del perfil/versionado; cambiar claims directamente sin sincronizar el perfil no constituye el procedimiento admitido.

## LOCAL y WEB

LOCAL conecta Auth 9099, Firestore 8088 y Functions 5001 en 127.0.0.1, exclusivamente al proyecto ficticio demo-barberpro-m13. Las herramientas de datos verifican ese entorno antes de escribir.

WEB usa HTTPS, configuración pública de una aplicación Firebase real y un origen canónico. No conecta emuladores. El Admin SDK de Functions usa identidad administrada; sus credenciales nunca se envían al navegador. Hosting publica app/dist. Las variables PUBLIC_ se incorporan al compilar; cambiar el archivo exige reconstruir.



## Inicialización de demostración

scripts/datos-demo.mjs comparte las validaciones del servidor, usa IDs deterministas y no reescribe citas existentes. preparar-demo-local.mjs exige los puertos y proyecto demo. preparar-demo-web.mjs exige proyecto confirmado, ADC y administrador existente, y simula por defecto. Ninguno es un export de Functions ni se empaqueta en el despliegue de backend.

La única adaptación visual de esta publicación permite mostrar el nombre configurado del profesional y autoriza la imagen concreta de comprobación de red del SDK en la CSP. No se añaden gestión de equipo ni funcionalidades avanzadas.

