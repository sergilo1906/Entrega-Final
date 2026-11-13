# Pruebas y estado de entrega

Validación de la versión actual realizada el 13 de noviembre de 2026, zona del propietario Europe/Dublin. Se distinguen código, emuladores, Firebase WEB y paquete de entrega.

## LOCAL: 48 pruebas aprobadas

Instalación con los tres package-lock y Node 22.23.4, npm 10 y Java 21. check y build correctos: TypeScript/sintaxis sin errores y 14 páginas generadas. npm test finalizó con código 0, sin pruebas omitidas:

| Batería | Resultado |
| --- | --- |
| Vitest: cuentas, fechas y configuración | 7/7 |
| Node unitario: roles, horario y disponibilidad | 5/5 |
| Integración: permisos, transacciones, concurrencia y agenda | 16/16 |
| Integración: demo idempotente y separación LOCAL/WEB | 2/2 |
| Navegador: escritorio y móvil | 18/18 |

Se prueban registro, verificación, login/logout, dos roles, rutas denegadas, escritura directa prohibida, propiedad, snapshots, duración 30/60 completa, huecos ocupados, reintentos y reservas simultáneas incompatibles, cancelación y liberación, agenda/completar, horario habitual, cierres y carreras con nuevas reservas, datos antiguos y cambio de permisos/sesión.

La demo se ejecuta dos veces y mantiene doce citas y doce cuentas locales (seis clientes y seis administradores). Se comprueban las seis personas, precios/duraciones, fechas pasadas/futuras, bloqueos, ausencia de solapamientos activos y dos citas privadas por cliente. Los procedimientos rechazan mezclar proyectos o entornos. El navegador entra como Laia y Marta, consulta el catálogo y ve las doce citas por fechas, tanto en escritorio como en móvil.

## WEB: operaciones comprobadas en la URL pública

https://barber-pro-6fdf6-studio.web.app

Se verificaron login cliente/admin, disponibilidad, creación de 30 y 60 minutos, consulta, cancelación, liberación, denegación de administración al cliente, agenda/completar, servicios, horario y cierre/reapertura en ambos formatos, con cero errores de navegador en los recorridos finales. Las cuentas de evaluación utilizadas para estas operaciones se retiraron después; la muestra catalana permanece.

El alta se realizó con cuentas ficticias de evaluación. Se aplicaron enlaces válidos contra Authentication real. La verificación con sesión cerrada dirigió correctamente al login. La herramienta privada de generación de enlaces recibió auth/internal-error en algunos intentos; una petición posterior obtuvo un enlace válido. No se desactivó la verificación ni se marcó verificado al usuario para sustituir esa prueba. No se certifica recepción en un buzón real example.test.

La comprobación de la muestra WEB leyó Firestore real como cada uno de los seis clientes: exactamente dos citas propias, acceso ajeno denegado y horas canceladas disponibles. El administrador vio las doce citas en las fechas 13 y 14 de noviembre. Estado confirmado: seis confirmed, cuatro done pasadas y dos cancelled. Se repitió la preparación sin duplicados. La revisión de los 57 registros de citas anteriores confirmó sus mismas huellas, sin modificaciones; las doce citas nuevas corresponden a la muestra.

Las siete Functions están activas en europe-west1, Node 22 y máximo dos instancias. Se retiraron diez funciones anteriores, incluidos reset/seed, roles públicos, reprogramación y recordatorios. No hay inicialización demo pública. Auth por contraseña y el dominio studio están autorizados; se revisaron facturación y cuotas sin cambiar el plan.

## Seguridad, paquete y límites

La app y Functions no presentan avisos en npm audit de las versiones instaladas durante esta revisión. Firebase CLI, herramienta local, conserva catorce avisos moderados transitivos y ninguno alto/crítico en la revisión realizada. No se afirma ausencia de riesgos futuros ni certificación comercial.

El código del nuevo repositorio tiene historial inicial limpio. La release entrega-final-m13 publica el commit, el SHA-256 y el resultado de instalación y pruebas de su ZIP exacto, ejecutadas antes de cerrar la entrega. No se distribuyen dependencias, credenciales, bases de datos, logs, capturas temporales ni el historial del repositorio anterior.

Las imágenes de agenda de la release corresponden a las comprobaciones WEB con datos ficticios. Móvil significa Chromium emulando iPhone 13; no se afirma haber probado todos los teléfonos o Safari. No se exige equivalencia de píxeles con páginas retiradas.

La comprensión, horas personales y rúbrica del centro requieren revisión del alumno; ver REGISTRO-ACADEMICO.md. Las pruebas automáticas acreditan comportamiento técnico dentro de estos escenarios.
