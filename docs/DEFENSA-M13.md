# Guía de defensa M13

Estas respuestas son una ayuda para estudiar, no certifican comprensión personal. Practicar el recorrido completo y explicar el código sin leer una respuesta memorizada.

1. **¿Por qué Astro?** Genera las pantallas como HTML estático. Se conserva el proyecto existente y se añade TypeScript de navegador para formularios y consultas. No necesitamos un servidor de renderizado para estas 14 pantallas.
2. **¿Por qué Firebase?** Reúne identificación, almacenamiento y funciones de servidor. Podemos practicar en emuladores y preparar el mismo flujo para una web real.
3. **¿Qué es Firestore?** Una base de datos de documentos agrupados en colecciones. Cada cita está en bookings; guarda propietario, fecha, estado y una copia del servicio para que un precio posterior no cambie una reserva anterior.
4. **¿Qué hace Authentication?** Comprueba las credenciales y entrega un token firmado. La verificación de correo se exige para operar. Authentication identifica; no sustituye a la autorización.
5. **¿Cómo se comprueban permisos?** En navegador se ocultan pantallas y se descartan respuestas antiguas. En Rules se restringen lecturas y contacto. En functions/src/permisos.js se comprueban cuenta actual, token, rol y versión del perfil. Solo client/admin son operativos; el cliente nunca elige ser admin.
6. **¿Cómo calculo una hora libre?** En functions/src/disponibilidad.js se recorre la jornada en saltos de 30 minutos. La duración completa debe caber en un tramo, estar en el futuro y no solaparse con ocupación. Una fecha cerrada no tiene huecos.
7. **¿Cómo creo una reserva?** La pantalla envía servicio, fecha, hora y requestId. El servidor vuelve a comprobar el hueco, toma la identidad real y escribe confirmed con el snapshot y los bloqueos.
8. **¿Qué es una transacción?** Un grupo de lecturas y escrituras que se confirma como una unidad. Si otra operación cambia una lectura relevante, Firestore reintenta. No puede guardarse la cita sin su ocupación.
9. **¿Cómo evito duplicados?** Las celdas impiden ocupar la misma media hora; UID + requestId produce siempre el mismo documento. Son problemas distintos: concurrencia de clientes y reintentos de una misma petición.
10. **¿Cómo se organiza el código?** pages muestra, modulos controla eventos, datos habla con Firebase, modelos define tipos y functions aplica las reglas que nadie debe saltarse.

## Fragmentos reales

En functions/src/persistencia-reservas.js, el documento de reserva depende de una intención concreta:

```javascript
const id = hash(JSON.stringify([uid, requestId]));
const fingerprint = hash(JSON.stringify([serviceId, dateStr, timeStr]));
```

La confirmación comprueba otra vez el resultado del mismo motor de disponibilidad:

```javascript
const horas = calcularHorasLibres(configuracion, dateStr, servicio.durationMin, ocupacion);
```

En firestore.rules, las escrituras de negocio no se conceden desde el navegador:

```javascript
allow write: if false;
```

Esto no bloquea al Admin SDK: por eso cada Function también valida identidad, permisos y datos. Explicar por qué no basta con ocultar un botón, por qué se convierte la zona horaria a UTC y por qué un cambio de horario debe revisar citas existentes.

## Qué se ha simplificado

Dos roles, un recurso de agenda, tres estados nuevos, siete operaciones remotas, horario repetido y cierre de fecha completa. Desaparecen semanas publicadas, equipo, reprogramación, notificaciones, estadísticas, exportaciones y paneles duplicados. La seguridad transaccional se mantiene porque resolver solapamientos es parte esencial de una aplicación real de reservas.

## Demostración sugerida

Cliente: crear cuenta, verificar, entrar, reservar, recargar, consultar y cancelar. Admin: ver la cita, completar otra, editar un servicio y cerrar una fecha libre. Intentar reservar un hueco ocupado y entrar a /admin con un cliente. Mostrar la prueba simultánea 30/60 y explicar por qué solo una petición incompatible tiene éxito.

No atribuir horas ni autoría manual que no se puedan acreditar. Distinguir el código en GitHub, los datos creados en emuladores y la muestra desplegada en Firebase real. Leer [REGISTRO-ACADÉMICO](REGISTRO-ACADEMICO.md) y completar solo datos personales reales.



## Demostración preparada para el profesor

Ejecutar datos:local y leer los accesos privados generados. Entrar como Laia Soler para ver dos citas propias y reservar/cancelar una nueva. Salir y entrar como Marta Roca en LOCAL para revisar las fechas del resumen, filtrar estados, completar y editar un servicio. WEB utiliza un administrador privado ya configurado, no las seis cuentas locales.

Explicar idCitaDemo y los IDs estables: repetir la preparación no duplica la muestra. Explicar prepararHistorial: solo un operador puede crear una cita terminada en fecha pasada; la transacción comprueba el mismo horario, cierre, servicio y ocupación. Nunca se permite que un cliente eluda la prohibición de reservar en el pasado.

