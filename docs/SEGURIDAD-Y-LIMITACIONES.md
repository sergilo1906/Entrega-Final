# Seguridad y límites

Solo client y admin, correo verificado para operaciones, token/cuenta/perfil coherentes y roleVersion. La asignación de roles se realiza desde un script privado de operador, no desde la aplicación. Las Rules deniegan escrituras de negocio, consultas de usuarios y lectura de citas ajenas; un cliente puede editar solo su contacto y no su rol. Storage deniega todo.

Las Functions validan UID, fechas reales, horas, duración, servicios activos, horario, cierre, ocupación y propiedad. Las transacciones y celdas de 30 minutos impiden reservas incompatibles; requestId impide duplicar una intención al reintentar. Un documento de control compartido coordina también cierres y cambios de horario. El servidor decide: cambiar el HTML o fabricar una petición no concede permisos.

No hay funciones públicas de reset, migración, roles o demo. La preparación de datos comprueba proyecto demo y puertos locales antes de escribir. El Admin SDK WEB usa credenciales del entorno administrado; las claves privadas nunca se incluyen en app ni en el ZIP. Los valores PUBLIC_ de la app web son configuración pública, no credenciales administrativas.

Los documentos antiguos se conservan: los roles retirados se deniegan y estados desconocidos son solo lectura. Las citas no canceladas se consideran ocupación; si su duración o forma no es compatible se exige revisión. Para adoptar esta versión sobre datos existentes, inventariar y resolver cada conflicto con un operador antes de publicar. No hay borrado ni conversión automática.

Límites: un solo recurso principal y un control global de agenda, sin diseño para muchas sedes o grandes volúmenes; no hay pagos, facturación, recordatorios, uploads o recuperación de contraseña propia. La zona horaria admite IANA; las horas inexistentes y los intervalos que atraviesan un cambio horario no se reservan. Una hora repetida de otoño usa la conversión canónica de la librería, sin ofrecer dos opciones visuales idénticas.

La protección contra abuso de volumen requiere configurar cuotas, alertas y eventualmente App Check antes de un uso comercial; el proyecto académico no afirma auditoría productiva completa. Verificación de correo y reglas no sustituyen la gestión de costes. La revisión de privacidad y textos legales reales, retención/borrado de datos, accesibilidad formal y operación pública deben completarse según el centro y el responsable de la barbería.

El propietario autorizó barber-pro-6fdf6 y se ha desplegado el sitio studio. Los recorridos públicos comprobados y sus límites figuran en PRUEBAS.md. Se mantienen separados los resultados LOCAL, WEB y del ZIP. [Instalación WEB](INSTALACION.md) describe el procedimiento restringido.



La preparación demo genera contraseñas aleatorias en un archivo privado externo. Los seis administradores del catálogo de demostración solo se crean en LOCAL. WEB exige un administrador existente y crea seis clientes identificados como demo. No restablece contraseñas ni modifica usuarios ajenos. El historial pasado se valida por operador porque la API pública prohíbe reservar en el pasado.

La auditoría de dependencias de la app y Functions no detecta vulnerabilidades en las versiones instaladas al cierre. En las herramientas locales Firebase CLI permanecen avisos moderados transitivos, sin avisos altos o críticos en la revisión realizada. No se fuerza una degradación de la CLI para ocultarlos; requieren seguimiento del proveedor. Esta revisión no garantiza ausencia de vulnerabilidades futuras.

