# Instalación y publicación

## LOCAL reproducible

Node 22.23.4, npm >=10 y Java 21. Instalar con npm ci en raíz, app y functions. Copiar app/.env.example a app/.env.local sin cambiar sus valores ficticios. Primera terminal: npm run emulators. Segunda: npm run datos:local y npm run dev. Abrir http://127.0.0.1:4321. Apagar con Ctrl+C al terminar; no ejecutar npm test mientras los puertos están ocupados.

La plantilla activa LOCAL con ambas flags de emulador en 1. Sin configuración la web pública funciona, pero el acceso a cuentas queda desactivado. No hay una simulación que aparente guardar reservas. Los datos de emuladores se pierden al apagarlos; la preparación local los restablece.

Si falla Java, revisar java -version. Si están ocupados 9099/8088/5001/4401, identificar el proceso antes de detenerlo; no matar procesos ajenos. Si falta Chromium, ejecutar desde app: npx playwright install chromium (en Linux CI, añadir --with-deps). No se requieren credenciales de producción para las pruebas.

## WEB: preparación antes de desplegar

Destino autorizado por el propietario: barber-pro-6fdf6, sitio barber-pro-6fdf6-studio. Hosting y las siete Functions Node 22 están desplegados; Auth email/contraseña y el dominio studio ya estaban autorizados. Se verificaron facturación habilitada y cuotas antes del despliegue, sin cambiar el plan. Las citas previas se conservan. El estado de los recorridos públicos consta en PRUEBAS.md.

1. Elegir un proyecto de evaluación separado del original, o confirmar expresamente el destino. Registrar PROJECT_ID y SITE_ID reales. No reutilizar datos privados ni ejecutar los fixtures locales contra ese proyecto.
2. Comprobar en Firebase/Google Cloud el estado de facturación y las cuotas. Functions requiere el plan Blaze para desplegar; revisar costes y configurar alertas antes de continuar. Este proyecto limita Functions a 2 instancias, pero eso no garantiza coste cero. No se cambia el plan automáticamente.
3. Crear Firestore en la región elegida y habilitar Authentication por email/contraseña. Añadir SITE_ID.web.app y cualquier dominio propio a Authentication > Settings > Authorized domains; revisar la plantilla de verificación y su URL de retorno /verify. No habilitar proveedores OAuth innecesarios.
4. Registrar una app web y escribir su configuración pública en un archivo de entorno local excluido de Git: PUBLIC_FIREBASE_MODE=web, PUBLIC_USE_FIREBASE_EMULATORS=0, PUBLIC_USE_FUNCTIONS_EMULATOR=0, PUBLIC_FIREBASE_PROJECT_ID=PROJECT_ID, PUBLIC_FIREBASE_AUTH_DOMAIN=PROJECT_ID.firebaseapp.com, API_KEY y APP_ID reales de esa app, PUBLIC_APP_URL=https://SITE_ID.web.app. La API key de cliente es pública; no debe confundirse con una clave privada administrativa.
5. Verificar los permisos del operador para Hosting, Firestore Rules y Functions y la identidad administrada del backend. La CLI autenticada no equivale necesariamente a disponer de Application Default Credentials para el script privado de roles. Usar ADC fuera del repositorio; nunca copiar un service account al árbol de entrega.

La CLI siempre debe recibir el proyecto explícito para no confundirlo con el alias demo predeterminado. Comandos, sustituyendo los marcadores por datos comprobados:

```powershell
npx firebase target:apply hosting studio SITE_ID --project PROJECT_ID
npm run check
npm run build
npx firebase deploy --only firestore:rules,functions,hosting:studio --project PROJECT_ID
```

Ejecutar el despliegue únicamente después de validar el nuevo alcance y confirmar el destino. En un proyecto que ya tenga Functions, revisar la lista de eliminaciones propuestas y no aceptar borrar funciones ajenas o del original. No usar --force. storage.rules deniega todo y no hay funcionalidad de Storage que desplegar.

Registrar una cuenta de evaluación con contraseña propia y verificarla. Un operador autorizado puede comprobar la asignación administrativa con el script privado:

```powershell
node functions/scripts/asignar-roles.mjs --project PROJECT_ID --confirmar-proyecto PROJECT_ID --uid UID_DE_EVALUACION --role admin
```

Sin --aplicar es simulación de lectura. Añadir --aplicar solo al confirmar el proyecto y UID. El script sincroniza perfil y claims con versionado; ante un fallo parcial el acceso queda denegado y se puede repetir. Cerrar y volver a iniciar sesión después. No se promocionan worker/manager automáticamente: decidir individualmente client/admin con este mismo procedimiento. No hay migración masiva.

Desde Horarios guardar un horario habitual y desde Servicios crear servicios de 30/60 minutos. Usar únicamente datos ficticios de evaluación. Confirmar desde la URL pública el registro/verificación/login, reserva/cancelación, agenda/completar y servicio/horario/cierre, con cuentas separadas y en móvil. Revisar consola, Rules y errores. Solo entonces documentar la URL real y declarar publicada la versión.

Referencias oficiales: [Hosting](https://firebase.google.com/docs/hosting/quickstart), [Functions y facturación](https://firebase.google.com/docs/functions/get-started), [Authentication](https://firebase.google.com/docs/auth/web/start), [Rules](https://firebase.google.com/docs/firestore/security/rules-conditions).



## Preparar la muestra LOCAL

npm run datos:local crea seis clientes y seis administradores ficticios, seis servicios y doce citas. El archivo privado de acceso predeterminado es ~/Entrega-Final-accesos-locales.json. Se puede elegir otro destino absoluto externo al proyecto: npm run datos:local -- --credenciales-salida C:\privado\accesos-locales.json. No contiene cuentas reales y no debe publicarse. Las cuentas demo se provisionan ya verificadas; el registro/verificación de usuarios normales se prueba por separado.

Los emuladores no conservan datos al apagarse. Al arrancar una sesión nueva y repetir la preparación se generan citas relativas a ese día. Con la misma sesión, la repetición conserva documentos e intenciones existentes, sin duplicarlos ni restablecer estados o contraseñas. Conservar el archivo privado mientras se reutilicen esas cuentas.

## Preparación WEB restringida

Este procedimiento crea únicamente seis clientes demo y reutiliza un administrador ya autorizado. No crea seis administradores en producción, no borra datos anteriores y no restablece contraseñas existentes. Requiere Application Default Credentials con permisos del operador, fuera del repositorio; no basta con una sesión del navegador.

```powershell
npm run demo:web -- --project barber-pro-6fdf6 --confirmar-proyecto barber-pro-6fdf6
```

El comando anterior es una simulación sin escrituras. Para aplicar, añadir --admin-uid UID_PRIVADO --credenciales-salida RUTA_ABSOLUTA_PRIVADA --aplicar. Nunca introducir tokens, contraseñas o JSON administrativos en Git, README, Actions o la web. La configuración rechaza emuladores y un proyecto distinto. El archivo generado solo contiene los accesos ficticios privados de esta muestra; el administrador se configura por separado.

La muestra WEB ya creada utiliza fechas 13 y 14 de noviembre de 2026. Seleccionarlas en Agenda para revisar las doce citas. Las futuras se calcularon respecto a la ejecución del 13 de noviembre; no se renuevan automáticamente al repetir el script días después. No hay un reset público ni una migración de datos reales.

El fichero de índices se conserva para instalación local o un proyecto nuevo. No se desplegó una lista vacía sobre el proyecto existente: sus índices anteriores se mantuvieron.

