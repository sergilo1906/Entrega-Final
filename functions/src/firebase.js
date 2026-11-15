// Preparem els serveis de Firebase del servidor. Les eines locals només poden escriure al projecte demo.
import { setGlobalOptions } from "firebase-functions/v2";
import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
// La regió és europe-west1 i limitem temps, memòria i instàncies d’aquestes funcions.
setGlobalOptions({
    region: "europe-west1", memory: "256MiB", timeoutSeconds: 60, maxInstances: 2
});
// Parar si el projecte i els ports no són exactament els dels emuladors de prova.
export function comprobarEntornoLocal() {
    if (process.env.GCLOUD_PROJECT !== "demo-barberpro-m13" || process.env.FIREBASE_AUTH_EMULATOR_HOST !== "127.0.0.1:9099" || process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8088") {
        throw new Error("Només es permeten els emuladors locals de demo-barberpro-m13.");
    }
}
// Preparar els serveis del servidor amb la identitat de Firebase, mai amb claus del navegador.
export function obtenerServiciosAdministrativos() {
    const local = Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST || process.env.FUNCTIONS_EMULATOR === "true");
    const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
    // Si algun emulador està activat, exigim que tot apunti al projecte demo local.
    if (local) {
        comprobarEntornoLocal();
    }
    else if (!projectId || projectId.startsWith("demo-")) {
        throw new Error("Falta configurar el projecte real del servidor.");
    }
    let aplicacion = getApps().find(actual => actual.name === "barberpro-m13");
    // Reutilitzem la mateixa aplicació de Firebase si ja s’havia preparat.
    if (!aplicacion) {
        aplicacion = initializeApp({ projectId }, "barberpro-m13");
    }
    return { autenticacion: getAuth(aplicacion), baseDatos: getFirestore(aplicacion) };
}
