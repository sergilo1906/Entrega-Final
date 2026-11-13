# Entrega Final — BarberPro Studio

Proyecto M13 de CFGS DAM: reservas de barbería con Astro, TypeScript, Tailwind y Firebase Authentication, Firestore y Functions. Versión académica simplificada: **14 páginas, dos roles, un profesional y siete operaciones remotas**. El cliente reserva y cancela; el administrador gestiona agenda, servicios, horario habitual y fechas cerradas.

[Repositorio](https://github.com/sergilo1906/Entrega-Final) · [Release](https://github.com/sergilo1906/Entrega-Final/releases/tag/entrega-final-m13) · [Web](https://barber-pro-6fdf6-studio.web.app)

El repositorio contiene código, reglas, configuración pública, pruebas y scripts seguros. No contiene bases de datos ni credenciales reales. GitHub aloja el código; Firebase Hosting ejecuta la web con su backend real. [Procedencia](docs/ANEXO-TRAZABILIDAD.md): nueva publicación con historial inicial limpio; el proyecto anterior y sus releases se conservan.

## Instalar y ejecutar

Requisitos: Node 22.23.4, npm >=10, Java 21. Desde la raíz:

```powershell
npm ci
npm --prefix app ci
npm --prefix functions ci
Copy-Item app/.env.example app/.env.local
npm run emulators
```

Esperar a que estén preparados. En una segunda terminal, desde la misma raíz:

```powershell
npm run datos:local
npm run dev
```

Abrir http://127.0.0.1:4321. La preparación muestra fechas, cantidades y la ruta del archivo privado de accesos: por defecto, Entrega-Final-accesos-locales.json en la carpeta personal, **fuera del repositorio**. Las contraseñas se generan al ejecutar, no se imprimen ni se fijan en el código. Usar ese archivo para iniciar sesión; no adjuntarlo al repositorio ni al ZIP. El comando se puede repetir sin duplicar cuentas, servicios ni citas.

## Demostración en catalán

| Clientes | Administradores exclusivamente LOCAL |
| --- | --- |
| Laia Soler | Marta Roca |
| Pau Rovira | Jordi Vidal |
| Júlia Font | Núria Pons |
| Arnau Puig | Pere Casas |
| Mariona Valls | Anna Ferrer |
| Nil Casals | Oriol Serra |

Todos usan correos ficticios example.test y teléfono vacío. El profesional principal es **Marc Vidal**, recurso principal; no existe un tercer rol ni selector de equipo.

| Servicio | Minutos | EUR |
| --- | --- | --- |
| Tall de cabell | 30 | 15 |
| Arreglar barba | 30 | 10 |
| Tall + barba | 60 | 23 |
| Tall infantil | 30 | 12 |
| Rentat i pentinat | 30 | 10 |
| Tall clàssic | 30 | 17 |

Se preparan **12 citas**, dos por cliente: inicialmente seis confirmadas futuras, cuatro hechas en el pasado y dos canceladas con sus huecos libres. Las fechas se calculan al crear la muestra, respetando el horario y los cierres. Repetir el script conserva las citas ya existentes y los cambios que haya realizado el evaluador; no las mueve ni las devuelve a su estado inicial.

Para enseñar la aplicación: entrar como Laia, consultar sus dos citas y el catálogo, reservar una hora libre y cancelar esa nueva reserva. Salir, entrar como Marta en LOCAL y abrir Agenda; elegir las fechas que indica el resumen para ver las doce citas, filtrar estados y completar una confirmada. Revisar Servicios y Horarios. En WEB se usa el único administrador privado, nunca las seis cuentas administrativas locales.

## Pruebas

Con los emuladores manuales apagados:

```powershell
npm run check
npm run build
npm run test:unit
npm test
```

npm test arranca sus propios emuladores, prueba permisos, carreras 30/60, cancelación, horario, cierres, idempotencia demo y recorridos de escritorio/móvil. Las pruebas usan exclusivamente el proyecto ficticio demo-barberpro-m13. [Resultados y límites](docs/PRUEBAS.md).

## Firebase WEB y entrega

La configuración apunta al sitio studio del proyecto autorizado barber-pro-6fdf6. Se han preparado también los seis clientes, seis servicios y doce citas demo en Firestore real. Las credenciales WEB se entregan al propietario por separado. Se conservan los datos anteriores del proyecto; los registros demo se distinguen por demoTag y sus identificadores. Los servicios anteriores no se borran automáticamente.

Validación pública final y del ZIP: consultar el estado ejecutado en [PRUEBAS](docs/PRUEBAS.md). El procedimiento WEB separado exige proyecto y confirmación explícitos, ADC privado y un administrador ya autorizado; sin --aplicar no escribe. No hay funciones públicas de inicialización o reset. [Instalación y publicación](docs/INSTALACION.md).

La release entrega-final-m13 contiene Entrega-Final-BarberPro-Studio-M13.zip y su SHA-256. El código se instala desde cero; las dependencias, datos y credenciales se preparan en cada entorno, no se distribuyen dentro del ZIP.

## Arquitectura y defensa

pages contiene las pantallas; modulos controla formularios; datos accede a Firebase; modelos define los tipos; functions valida permisos y escrituras. Las transacciones, los bloqueos de 30 minutos y requestId impiden solapamientos y duplicados. [Arquitectura](docs/ARQUITECTURA.md), [funcionamiento](docs/FUNCIONAMIENTO.md), [defensa M13](docs/DEFENSA-M13.md) y [matriz](docs/MATRIZ-REQUISITOS.md).

No hay reprogramación, equipo, semanas publicadas, bloqueos parciales, estadísticas, exportaciones ni recordatorios. Es una aplicación académica para una sola agenda; no se certifica preparación comercial completa ni una dificultad 6/10 medida. [Seguridad](docs/SEGURIDAD-Y-LIMITACIONES.md).

Se declara asistencia de Codex/IA. Las horas efectivas, los datos del alumno, la comprensión personal y los requisitos del centro deben completarse con información real: [registro académico](docs/REGISTRO-ACADEMICO.md). No se envía nada al profesor automáticamente.

