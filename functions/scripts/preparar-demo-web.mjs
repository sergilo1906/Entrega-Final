// Entrada privada per preparar la mostra a WEB, amb el projecte confirmat i un administrador que ja existeix.
import fs from "node:fs";
const args = process.argv.slice(2);
// Buscar un argument de la comanda i avisar si no té valor.
// Rep el nom d’un indicador de comanda, com --project.
// Retorna el valor que el segueix o llança un error si falta.
function leer(nombre) {
    const indice = args.indexOf(nombre);
    if (indice < 0 || !args[indice + 1] || args[indice + 1].startsWith("--")) {
        throw new Error("Falta " + nombre);
    }
    return args[indice + 1];
}
const proyecto = leer("--project");
// L’àlies web del repositori és el projecte permès per a aquest procediment privat.
const configuracion = JSON.parse(fs.readFileSync(new URL("../../.firebaserc", import.meta.url), "utf8"));
if (proyecto !== configuracion.projects.web || proyecto.startsWith("demo-") || leer("--confirmar-proyecto") !== proyecto) {
    throw new Error("Confirma exactamente el proyecto WEB configurado.");
}
// Una barreja de WEB i emuladors es rebutja abans de preparar cap compte.
if (process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST || process.env.FUNCTIONS_EMULATOR === "true") {
    throw new Error("No mezcles WEB con emuladores.");
}
if (process.env.GCLOUD_PROJECT && process.env.GCLOUD_PROJECT !== proyecto) {
    throw new Error("GCLOUD_PROJECT apunta a otro proyecto.");
}
// Sense l’opció explícita no creem cap compte ni cita al projecte real.
if (!args.includes("--aplicar")) {
    console.log("Simulacion sin escrituras: seis clientes ficticios, seis servicios y doce citas en " + proyecto + ". Requiere ADC privado, --admin-uid, --credenciales-salida y --aplicar.");
}
else {
    process.env.GCLOUD_PROJECT = proyecto;
    const { prepararDemostracion } = await import("./datos-demo.mjs");
    await prepararDemostracion({
        // WEB reutilitza un administrador existent; no crea els sis administradors de la mostra local.
        real: true, adminUid: leer("--admin-uid"), archivoAccesos: leer("--credenciales-salida")
    });
}
