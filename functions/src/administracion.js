import { FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { obtenerServiciosAdministrativos } from "./firebase.js";
import { comprobarAdministrador, comprobarIdentidadTransaccion, comprobarUid } from "./permisos.js";
import { validarDuracion } from "./disponibilidad.js";
import { validarHorario, cabeEnHorario } from "./horarios.js";
import { validarZona, obtenerConfiguracionAgenda, actualizarControlAgenda } from "./configuracion.js";
import { validarFechaCalendario, convertirHoraAMinutos, formatearFechaZona } from "./fechas.js";
// Desem el servei; les cites conserven la còpia que tenien en reservar.
export const saveService = onCall(async (peticion) => {
    const identidad = await comprobarAdministrador(peticion);
    const datos = peticion.data;
    const id = comprobarUid(datos?.serviceId);
    if (typeof datos.name !== "string" || !datos.name.trim() || datos.name.trim().length > 100 || typeof datos.price !== "number" || !Number.isFinite(datos.price) || datos.price < 0 || typeof datos.active !== "boolean") {
        throw new HttpsError("invalid-argument", "Revisa el nom, el preu i l’estat del servei.");
    }
    const durationMin = validarDuracion(datos.durationMin);
    const { baseDatos } = obtenerServiciosAdministrativos();
    return baseDatos.runTransaction(async (transaccion) => {
        await comprobarIdentidadTransaccion(transaccion, baseDatos, identidad);
        const referencia = baseDatos.doc("services/" + id);
        await transaccion.get(referencia);
        transaccion.set(referencia, {
            name: datos.name.trim(), price: datos.price, durationMin, active: datos.active, updatedAt: FieldValue.serverTimestamp()
        }, { merge: true });
        return { ok: true, id };
    });
});
// Revisem les cites futures abans de canviar l’horari.
export const saveSchedule = onCall(async (peticion) => {
    const identidad = await comprobarAdministrador(peticion);
    const timezone = validarZona(peticion.data?.timezone);
    const days = validarHorario(peticion.data?.days);
    const { baseDatos } = obtenerServiciosAdministrativos();
    return baseDatos.runTransaction(async (transaccion) => {
        await comprobarIdentidadTransaccion(transaccion, baseDatos, identidad);
        const referencia = baseDatos.doc("config/app");
        const documento = await transaccion.get(referencia);
        const zonaAnterior = documento.get("timezone") || timezone;
        const hoy = formatearFechaZona(new Date(), zonaAnterior).slice(0, 10);
        const citas = await transaccion.get(baseDatos.collection("bookings").where("dateStr", ">=", hoy));
        for (const fila of citas.docs) {
            const cita = fila.data();
            if (cita.status === "cancelled" || cita.status === "done") {
                continue;
            }
            if (cita.startAt?.toDate && cita.startAt.toDate() <= new Date()) {
                continue;
            }
            if (zonaAnterior !== timezone) {
                throw new HttpsError("failed-precondition", "Hi ha cites futures: no en canviïs la zona horària sense revisar-les.");
            }
            const duracion = validarDuracion(cita.durationMin ?? cita.serviceSnapshot?.durationMin);
            const fecha = validarFechaCalendario(cita.dateStr);
            if (!cabeEnHorario(days, fecha, convertirHoraAMinutos(cita.timeStr), duracion)) {
                throw new HttpsError("failed-precondition", "L’horari deixaria una cita existent fora de la jornada.");
            }
        }
        transaccion.set(referencia, {
            timezone, days, revision: Number(documento.get("revision") || 0) + 1
        }, { merge: true });
        return { ok: true };
    });
});
// Tanquem el dia sencer només si no queden cites pendents de resoldre.
export const setClosedDay = onCall(async (peticion) => {
    const identidad = await comprobarAdministrador(peticion);
    const fecha = validarFechaCalendario(peticion.data?.dateStr);
    if (typeof peticion.data?.closed !== "boolean") {
        throw new HttpsError("invalid-argument", "Indica si el dia està tancat.");
    }
    const { baseDatos } = obtenerServiciosAdministrativos();
    return baseDatos.runTransaction(async (transaccion) => {
        await comprobarIdentidadTransaccion(transaccion, baseDatos, identidad);
        const configuracion = await obtenerConfiguracionAgenda(transaccion);
        if (peticion.data.closed) {
            const citas = await transaccion.get(baseDatos.collection("bookings").where("dateStr", "==", fecha));
            for (const cita of citas.docs) {
                if (cita.get("status") !== "cancelled" && cita.get("status") !== "done") {
                    throw new HttpsError("failed-precondition", "Resol les cites d’aquest dia abans de tancar-lo.");
                }
            }
        }
        const referencia = baseDatos.doc("closedDays/" + fecha);
        if (peticion.data.closed) {
            transaccion.set(referencia, { dateStr: fecha });
        }
        else {
            transaccion.delete(referencia);
        }
        actualizarControlAgenda(transaccion, baseDatos, configuracion);
        return { ok: true };
    });
});
