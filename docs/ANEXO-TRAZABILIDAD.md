# Procedencia y reducción de alcance

La versión histórica de referencia se conserva sin reescribir Git ni releases:

- [Entrega anterior del 11 de noviembre](https://github.com/sergilo1906/BarberPro-M13/releases/tag/cierre-definitivo-2026-11-11).
- [Base previa a la simplificación, 66d4da4](https://github.com/sergilo1906/BarberPro-M13/tree/66d4da4dccb117076bcc420152e007047ebaaf31): código, declaración de IA, inventarios originales, correspondencias y pruebas del alcance anterior.
- [Rama histórica de otra ejecución](https://github.com/sergilo1906/BarberPro-M13/tree/bb278da1c39e52b089087d6d6866ab64b4f0e4): sus cambios no se sobrescriben.

El estado inicial local era 27 páginas y 19 exports; la otra rama remota había retirado debug y dos capacidades, quedando 26 y 18. La simplificación parte de la base local guardada e incluye una reducción posterior autorizada por el propietario. Entrega-Final publica una instantánea limpia de esa versión, sin copiar el historial anterior. Las cifras de las versiones históricas no describen la entrega simplificada.

## Cambios reales

| Antes | Ahora |
| --- | --- |
| Cuatro roles | client/admin; worker/manager se deniegan |
| Equipo y varios profesionales | Recurso estable principal, sin selector |
| Crear, cancelar y reprogramar | Crear/cancelar; admin completa |
| Estados múltiples | confirmed/cancelled/done nuevos; históricos solo lectura |
| Semanas publicadas y bloqueos parciales | Horario habitual y cierres de fecha completa |
| Duración y tamaño de celda variables | 30/60 minutos sobre celdas fijas de 30 |
| Recordatorios y notificaciones internas | Confirmación directa en pantalla; solo email de verificación |
| Estadísticas, CSV/ICS, PRO y paneles duplicados | Retirados del alcance |
| Herramientas públicas demo/roles | Fixtures locales y operador privado |
| Solo SDK local | Modos LOCAL/WEB separados y sitio studio desplegado |

Las páginas conservadas reutilizan layout, navegación, estilos, formularios de cuenta y consultas existentes. Las pantallas afectadas se adaptan a su tarea más sencilla; no se afirma equivalencia visual con funcionalidades retiradas. La estructura del proyecto sigue siendo la misma.

Los inventarios y el generador anteriores apuntaban a páginas y funciones eliminadas. Se retiran del árbol activo para no ofrecer referencias falsas. Permanecen íntegros en el commit histórico enlazado, junto a sus límites de evidencia. Las retiradas se explican en la tabla y sus cambios históricos pueden consultarse en el repositorio anterior. Entrega-Final comienza con una instantánea validada, sin incorporar esos commits a su historial.

El proyecto original separado y la planificación anterior solo se han consultado. No se migran ni borran datos reales. README y PRUEBAS.md recogen la entrega actual. La nueva publicación se preparó en un directorio temporal externo sin modificar el remote origin del repositorio anterior ni sus releases.


