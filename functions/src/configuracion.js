import { HttpsError } from "firebase-functions/v2/https";
import { obtenerServiciosAdministrativos } from "./firebase.js";
import { validarHorario } from "./horarios.js";
export const UID_PROFESIONAL = "principal";
export function validarZona(timezone) {
    if (typeof timezone !== "string" || !timezone.trim()) {
        throw new HttpsError("invalid-argument", "Indica la zona horària.");
    }
    try {
        new Intl.DateTimeFormat("es", { timeZone: timezone }).format();
    }
    catch {
        throw new HttpsError("invalid-argument", "La zona horària no és vàlida.");
    }
    return timezone;
}
// L’horari habitual es repeteix cada setmana.
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
// El control compartit fa repetir la transacció si l’agenda ha canviat.
export function actualizarControlAgenda(transaccion, baseDatos, configuracion) {
    transaccion.update(baseDatos.doc("config/app"), { revision: configuracion.revision + 1 });
}
