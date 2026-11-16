// Entrada per crear la mostra local. Les contrasenyes aleatòries es guarden fora del projecte.
import { homedir } from "node:os";
import path from "node:path";
const entorno = {
    GCLOUD_PROJECT: "demo-barberpro-m13", FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099", FIRESTORE_EMULATOR_HOST: "127.0.0.1:8088"
};
// Si l’entorn ja tenia un projecte o port diferent, parem abans d’importar el codi que escriu dades.
for (const [nombre, valor] of Object.entries(entorno)) {
    if (process.env[nombre] && process.env[nombre] !== valor) {
        throw new Error("La demo habitual solo admite los emuladores locales.");
    }
    process.env[nombre] = valor;
}
const args = process.argv.slice(2);
const indice = args.indexOf("--credenciales-salida");
// Per defecte els accessos es desen a la carpeta personal; es pot indicar una altra ruta privada.
const archivoAccesos = indice < 0 ? path.join(homedir(), "Entrega-Final-accesos-locales.json") : args[indice + 1];
if (!archivoAccesos) {
    throw new Error("Indica una ruta privada fuera del proyecto.");
}
const { prepararDemostracion } = await import("./datos-demo.mjs");
await prepararDemostracion({ archivoAccesos });
