# Funcionamiento de la versión simplificada

El cliente crea una cuenta, verifica el correo, inicia sesión, consulta servicios activos de 30 o 60 minutos y elige fecha y hora. Una creación correcta queda confirmada automáticamente. En Mis citas ve únicamente las suyas y puede cancelar las confirmadas antes de su inicio. Cancelar libera el hueco; cambiar de hora exige cancelar y crear otra cita. No hay reprogramación automática.

El administrador consulta la agenda de cualquier fecha, ve el contacto y el precio/duración guardados en cada cita, cancela o marca una confirmada como hecha. Gestiona servicios (nombre, precio, duración y activo), el horario habitual y fechas cerradas. Desactivar o editar un servicio no cambia el snapshot de las citas existentes.

El recurso de agenda es principal: un identificador estable, nunca el UID real de una persona. No hay selector de profesional. Los únicos roles admitidos son client y admin. Los antiguos worker y manager pierden acceso operativo y necesitan revisión explícita por un operador; nunca se convierten automáticamente en administradores.

## Horario

Siete días, de domingo a sábado, cada uno abierto o cerrado y con un máximo de dos tramos. Se repite sin publicar semanas. Los límites y los inicios de reserva se alinean a 30 minutos. Una cita de 60 ocupa dos celdas consecutivas dentro del mismo tramo, sin cruzar pausas, medianoche ni saltos horarios. Se usa la zona IANA guardada (por ejemplo Europe/Madrid) y un máximo de 30 días de antelación.

Cerrar una fecha impide crear citas. Antes deben resolverse sus citas activas. El servidor rechaza horarios que dejen citas futuras fuera de jornada y cambios de zona con citas futuras. Los datos antiguos incompatibles bloquean la operación para revisión, sin borrar ni reinterpretar documentos.

## Estados y recuperación

Los estados nuevos son confirmed, cancelled y done. Otros estados históricos se muestran como solo lectura. Se consideran ocupación conservadora; una duración antigua incompatible requiere revisión. No hay migración automática.

requestId identifica una intención de reserva del cliente. Se conserva para reintentar tras un fallo de red. El servidor devuelve la misma cita y su estado actual; si ya se canceló, no muestra una falsa confirmación ni la recrea. Elegir otros datos inicia una intención nueva. No se puede asegurar el resultado de una petición sin conexión: consultar Mis citas o reintentar antes de elegir otra hora.

No hay CSV, ICS, KPIs, recordatorios ni mensajes de citas. Se conserva exclusivamente el correo de verificación de Authentication. No hay cobros, nóminas, facturas, uploads ni pasarela de contratación.

## Páginas

Públicas: /, /login, /registro, /verify, /ayuda, /legal, /404.
Cliente o admin: /perfil, /reservar, /mis-citas (correo verificado salvo en Perfil).
Solo admin verificado: /admin, /agenda, /servicios, /horarios.

Las rutas retiradas devuelven 404. Ocultar menús es una ayuda visual: los permisos efectivos también se comprueban en Rules y Functions.



## Muestra preparada

functions/scripts/datos-demo.mjs define seis personas catalanas, seis servicios con ID estable y doce citas. Las futuras y las canceladas utilizan crearReserva/cambiarEstado; el historial hecho se crea por operador con el mismo motor de disponibilidad, cierre y transacciones, exigiendo fecha pasada. La etiqueta demoTag permite distinguir los documentos de la muestra de cualquier dato anterior. Marc Vidal es el nombre del recurso principal guardado en config/app, no un nuevo rol.

La preparación habitual es LOCAL y genera seis administradores ficticios. El procedimiento WEB está separado, requiere confirmación del proyecto y reutiliza un único administrador privado. Las contraseñas aleatorias solo se guardan fuera del árbol de código.

