// Configuració de l’única agenda i número de canvi per detectar dues operacions alhora.
import { HttpsError } from "firebase-functions/v2/https";
import { obtenerServiciosAdministrativos } from "./firebase.js";
import { validarHorario } from "./horarios.js";
export const UID_PROFESIONAL = "principal";
// Comprovar que la zona horària existeixi abans de fer-la servir.
export function validarZona(timezone) {
    if (typeof timezone !== "string" || !timezone.trim()) {
        throw new HttpsError("invalid-argument", "Indica la zona horària.");
    }
    try {
        // Si el nom de zona no existeix, Intl llança un error i l’aturem al catch.
        new Intl.DateTimeFormat("es", { timeZone: timezone }).format();
    }
    catch {
        throw new HttpsError("invalid-argument", "La zona horària no és vàlida.");
    }
    return timezone;
}
// Llegir l’horari i la zona horària desats a config/app.
export async function obtenerConfiguracionAgenda(transaccion = null) {
    const { baseDatos } = obtenerServiciosAdministrativos();
    const referencia = baseDatos.doc("config/app");
    const documento = transaccion ? await transaccion.get(referencia) : await referencia.get();
    if (!documento.exists) {
        throw new HttpsError("failed-precondition", "L’administrador ha de configurar l’horari.");
    }
    return {
        timezone: validarZona(documento.get("timezone")),
        days: validarHorario(documento.get("days")),
        revision: Number(documento.get("revision") || 0),
    };
}
// Augmentar el número de canvi de l’agenda perquè Firebase detecti canvis alhora.
export function actualizarControlAgenda(transaccion, baseDatos, configuracion) {
    // Aquest número compartit fa que dues operacions d’agenda alhora no treballin amb dades diferents.
    transaccion.update(baseDatos.doc("config/app"), { revision: configuracion.revision + 1 });
}
