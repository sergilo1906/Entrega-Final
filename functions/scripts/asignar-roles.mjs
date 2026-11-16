// Script privat per assignar client o admin. Sense --aplicar només comprova el compte i mostra què faria.
import { obtenerServiciosAdministrativos, comprobarEntornoLocal } from "../src/firebase.js";
import { asignarRolAutorizado } from "../src/cuentas.js";
import { comprobarUid, normalizarRolEntrada } from "../src/permisos.js";
// Eina privada de l’operador; no es publica com a Function.
const argumentos = process.argv.slice(2);
// Buscar un argument de la comanda i avisar si no té valor.
// Rep el nom d’un indicador de comanda, com --project.
// Retorna el valor que el segueix o llança un error si falta.
function leer(nombre) {
    const indice = argumentos.indexOf(nombre);
    if (indice < 0 || !argumentos[indice + 1] || argumentos[indice + 1].startsWith("--")) {
        throw new Error("Falta " + nombre);
    }
    return argumentos[indice + 1];
}
// El projecte s’indica explícitament a la comanda perquè el rol no s’assigni en un entorn equivocat.
const proyecto = leer("--project");
const uid = comprobarUid(leer("--uid"));
const rol = normalizarRolEntrada(leer("--role"));
if (proyecto === "demo-barberpro-m13") {
    process.env.GCLOUD_PROJECT = proyecto;
    comprobarEntornoLocal();
}
else {
    if (process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST
        || process.env.FUNCTIONS_EMULATOR === "true" || proyecto.startsWith("demo-")) {
        throw new Error("No mezcles configuracion WEB y LOCAL.");
    }
    // A WEB exigim escriure el mateix projecte una segona vegada abans de permetre el canvi.
    if (leer("--confirmar-proyecto") !== proyecto) {
        throw new Error("Confirma el proyecto WEB exacto.");
    }
    if (process.env.GCLOUD_PROJECT && process.env.GCLOUD_PROJECT !== proyecto) {
        throw new Error("GCLOUD_PROJECT pertenece a otro proyecto.");
    }
    process.env.GCLOUD_PROJECT = proyecto;
}
const { autenticacion } = obtenerServiciosAdministrativos();
// Comprovem que el compte existeixi fins i tot en simulació; no creem comptes pel fet d’assignar un rol.
await autenticacion.getUser(uid);
// Només fem el canvi si la comanda porta --aplicar; altrament queda en simulació.
if (argumentos.includes("--aplicar")) {
    await asignarRolAutorizado(uid, rol);
    console.log("Rol actualizado en " + proyecto + ". La cuenta debe renovar su sesion.");
}
else {
    console.log("Simulacion: se asignaria " + rol + " en " + proyecto + ". No se ha escrito nada. Usa --aplicar para guardar.");
}
