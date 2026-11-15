// Preparem la connexió amb Firebase. LOCAL fa servir emuladors; WEB es connecta al projecte real.
import { initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, inMemoryPersistence, type Auth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore, type Firestore } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions, type Functions } from "firebase/functions";
// Aquesta interfície indica les dades necessàries; no conté contrasenyes administratives.
export interface ConfiguracionFirebase {
    modo: string;
    usarEmuladores: boolean;
    usarEmuladorFunciones: boolean;
    apiKey: string;
    authDomain: string;
    projectId: string;
    appId: string;
    appUrl: string;
}
let servicios: {
    aplicacionFirebase: FirebaseApp;
    autenticacion: Auth;
    baseDatos: Firestore;
    funcionesRemotas: Functions;
} | null = null;
// Llegir les variables públiques que es van posar en compilar la web.
export function leerConfiguracionFirebase(): ConfiguracionFirebase {
    return {
        modo: import.meta.env.PUBLIC_FIREBASE_MODE || "desactivado",
        usarEmuladores: import.meta.env.PUBLIC_USE_FIREBASE_EMULATORS === "1",
        usarEmuladorFunciones: import.meta.env.PUBLIC_USE_FUNCTIONS_EMULATOR === "1",
        apiKey: import.meta.env.PUBLIC_FIREBASE_API_KEY || "",
        authDomain: import.meta.env.PUBLIC_FIREBASE_AUTH_DOMAIN || "",
        projectId: import.meta.env.PUBLIC_FIREBASE_PROJECT_ID || "",
        appId: import.meta.env.PUBLIC_FIREBASE_APP_ID || "",
        appUrl: import.meta.env.PUBLIC_APP_URL || "",
    };
}
// Comprovar que la configuració correspon al lloc on obrim la web.
export function comprobarConfiguracionFirebase(config: ConfiguracionFirebase, origen: string): string | null {
    if (!config.apiKey || !config.appId || !config.projectId || !config.authDomain) {
        return "La configuració de Firebase és incompleta.";
    }
    let url: URL;
    try {
        url = new URL(origen);
    }
    catch {
        return "L’origen no és vàlid.";
    }
    // LOCAL només s’accepta a localhost amb tots els emuladors i el projecte fictici.
    if (config.modo === "local") {
        if (!config.usarEmuladores || !config.usarEmuladorFunciones || !["localhost", "127.0.0.1"].includes(url.hostname)
            || config.projectId !== "demo-barberpro-m13" || config.authDomain !== "localhost") {
            return "El mode local requereix localhost, emuladors i el projecte fictici.";
        }
        return null;
    }
    // WEB exigeix HTTPS i no pot tenir emuladors activats.
    if (config.modo !== "web" || config.usarEmuladores || config.usarEmuladorFunciones || url.protocol !== "https:"
        || config.projectId.startsWith("demo-") || config.authDomain !== config.projectId + ".firebaseapp.com") {
        return "La configuració WEB no és vàlida.";
    }
    try {
        // L’origen real de la pàgina ha de coincidir amb l’adreça pública configurada.
        const canonica = new URL(config.appUrl);
        if (canonica.protocol !== "https:" || canonica.origin !== url.origin || canonica.pathname !== "/") {
            return "L’origen no coincideix amb PUBLIC_APP_URL.";
        }
    }
    catch {
        return "Falta PUBLIC_APP_URL amb HTTPS.";
    }
    return null;
}
// Crear les connexions amb Firebase una sola vegada i reutilitzar-les.
export function obtenerServiciosFirebase() {
    const config = leerConfiguracionFirebase();
    if (config.modo === "desactivado") {
        return null;
    }
    const error = comprobarConfiguracionFirebase(config, typeof window === "undefined" ? "" : window.location.origin);
    if (error) {
        throw new Error(error);
    }
    // Si ja hem preparat Firebase abans, retornem les connexions existents.
    if (servicios) {
        return servicios;
    }
    const aplicacionFirebase = initializeApp(config, "barberpro-m13");
    // Provem de conservar la sessió al navegador; si no es pot, la mantenim en memòria.
    const autenticacion = initializeAuth(aplicacionFirebase, { persistence: [indexedDBLocalPersistence, browserLocalPersistence, inMemoryPersistence] });
    const baseDatos = getFirestore(aplicacionFirebase);
    const funcionesRemotas = getFunctions(aplicacionFirebase, "europe-west1");
    if (config.modo === "local") {
        connectAuthEmulator(autenticacion, "http://127.0.0.1:9099", { disableWarnings: true });
        connectFirestoreEmulator(baseDatos, "127.0.0.1", 8088);
        connectFunctionsEmulator(funcionesRemotas, "127.0.0.1", 5001);
    }
    servicios = {
        aplicacionFirebase, autenticacion, baseDatos, funcionesRemotas
    };
    return servicios;
}
