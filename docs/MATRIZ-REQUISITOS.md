# Matriz del alcance actual

| Objetivo | Implementación | Evidencia |
| --- | --- | --- |
| Registro, login, verificación y logout | datos/sesion y modulos/cuentas | app/tests/e2e/academica.test.ts |
| Cliente/admin y denegaciones | comun/permisos, Functions y Rules | functions/tests/emuladores/agenda.test.mjs y navegador |
| Catálogo 30/60, alta y desactivación | servicios y saveService | navegador y emuladores |
| Disponibilidad y cita confirmada | getAvailability y createBooking | unitarias, emuladores y navegador |
| Sin solapamientos ni duplicados | transacción, locks y requestId | carreras 30/60 y reintentos simultáneos |
| Cancelación y liberación | cancelBooking | emuladores y navegador |
| Agenda y completar | agenda y completeBooking | emuladores y navegador |
| Horario habitual y protección de citas | saveSchedule | emuladores, carrera y navegador |
| Fecha cerrada y reapertura | setClosedDay | emuladores, carrera y navegador |
| Sesión y aislamiento entre usuarios | contexto y consultas por propietario | reglas y cambio de cuenta en navegador |
| Móvil y ordenador | diseño conservado y formularios adaptados | dos proyectos Playwright |
| Firebase WEB seguro | SDK WEB, Rules y Hosting | configuración unitaria y verificaciones públicas descritas en PRUEBAS.md |
| Demostración catalana idempotente | scripts/datos-demo y wrappers LOCAL/WEB | integración demo y navegador |
| Documentación y defensa | documentos de esta carpeta | revisión de enlaces y registro académico |

No se afirma conservar los antiguos grupos funcionales: la retirada es explícita y figura en [trazabilidad](ANEXO-TRAZABILIDAD.md). Los resultados ejecutados se detallan en [PRUEBAS](PRUEBAS.md).




