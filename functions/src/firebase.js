import { setGlobalOptions } from "firebase-functions/v2";
import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
setGlobalOptions({
    region: "europe-west1", memory: "256MiB", timeoutSeconds: 60, maxInstances: 2
});
// Comprovem el projecte demo i els ports abans d’escriure dades locals.
export function comprobarEntornoLocal() {
    if (process.env.GCLOUD_PROJECT !== "demo-barberpro-m13" || process.env.FIREBASE_AUTH_EMULATOR_HOST !== "127.0.0.1:9099" || process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8088") {
        throw new Error("Només es permeten els emuladors locals de demo-barberpro-m13.");
    }
}
// En WEB fem servir la identitat del servidor, sense enviar claus al navegador.
export function obtenerServiciosAdministrativos() {
    const local = Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST || process.env.FUNCTIONS_EMULATOR === "true");
    const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
    if (local) {
        comprobarEntornoLocal();
    }
    else if (!projectId || projectId.startsWith("demo-")) {
        throw new Error("Falta configurar el projecte real del servidor.");
    }
    let aplicacion = getApps().find(actual => actual.name === "barberpro-m13");
    if (!aplicacion) {
        aplicacion = initializeApp({ projectId }, "barberpro-m13");
    }
    return { autenticacion: getAuth(aplicacion), baseDatos: getFirestore(aplicacion) };
}
