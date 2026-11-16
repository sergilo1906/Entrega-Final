// Canvis que només pot fer un administrador: serveis, horari habitual i dies tancats.
import { FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { obtenerServiciosAdministrativos } from "./firebase.js";
import { comprobarAdministrador, comprobarIdentidadTransaccion, comprobarUid } from "./permisos.js";
import { validarDuracion } from "./disponibilidad.js";
import { validarHorario, cabeEnHorario } from "./horarios.js";
import { validarZona, obtenerConfiguracionAgenda, actualizarControlAgenda } from "./configuracion.js";
import { validarFechaCalendario, convertirHoraAMinutos, formatearFechaZona } from "./fechas.js";
// Comprovar que sigui administrador i guardar els camps del servei.
// Rep una petició autenticada amb serviceId, nom, durada, preu i active.
// Retorna ok i l’ID del servei si la transacció s’ha confirmat.
export const saveService = onCall(async (peticion) => {
    const identidad = await comprobarAdministrador(peticion);
    const datos = peticion.data;
    // L’ID estable permet repetir un desament sense crear serveis duplicats.
    const id = comprobarUid(datos?.serviceId);
    // Comprovem nom, preu i estat al servidor; no n’hi ha prou amb el formulari.
    if (typeof datos.name !== "string" || !datos.name.trim() || datos.name.trim().length > 100 || typeof datos.price !== "number" || !Number.isFinite(datos.price) || datos.price < 0 || typeof datos.active !== "boolean") {
        throw new HttpsError("invalid-argument", "Revisa el nom, el preu i l’estat del servei.");
    }
    const durationMin = validarDuracion(datos.durationMin);
    const { baseDatos } = obtenerServiciosAdministrativos();
    return baseDatos.runTransaction(async (transaccion) => {
        await comprobarIdentidadTransaccion(transaccion, baseDatos, identidad);
        const referencia = baseDatos.doc("services/" + id);
        // Llegim també el document del servei perquè un canvi concurrent es detecti dins de la transacció.
        await transaccion.get(referencia);
        // merge conserva els altres camps del document que no estem editant.
        transaccion.set(referencia, {
            name: datos.name.trim(), price: datos.price, durationMin, active: datos.active, updatedAt: FieldValue.serverTimestamp()
        }, { merge: true });
        return { ok: true, id };
    });
});
// Comprovar l’horari nou i que cap cita futura en quedi fora abans de guardar-lo.
// Rep una petició d’administrador amb timezone i els set days.
// Retorna ok després de guardar, o un error si el canvi perjudica cites existents.
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
        // Per revisar les cites fem servir el dia de la barberia, no el del servidor.
        const hoy = formatearFechaZona(new Date(), zonaAnterior).slice(0, 10);
        const citas = await transaccion.get(baseDatos.collection("bookings").where("dateStr", ">=", hoy));
        // Revisem les cites que encara poden quedar afectades pel nou horari.
        for (const fila of citas.docs) {
            const cita = fila.data();
            // Les cancel·lades i completades no s’han de recol·locar en l’horari nou.
            if (cita.status === "cancelled" || cita.status === "done") {
                continue;
            }
            // Les cites que ja han començat no impedeixen canviar l’horari de les pròximes jornades.
            if (cita.startAt?.toDate && cita.startAt.toDate() <= new Date()) {
                continue;
            }
            // Amb cites futures no canviem la zona perquè canviaria la interpretació de les seves hores.
            if (zonaAnterior !== timezone) {
                throw new HttpsError("failed-precondition", "Hi ha cites futures: no en canviïs la zona horària sense revisar-les.");
            }
            const duracion = validarDuracion(cita.durationMin ?? cita.serviceSnapshot?.durationMin);
            const fecha = validarFechaCalendario(cita.dateStr);
            // Si una cita quedaria fora d’horari, parem i no desem el canvi.
            if (!cabeEnHorario(days, fecha, convertirHoraAMinutos(cita.timeStr), duracion)) {
                throw new HttpsError("failed-precondition", "L’horari deixaria una cita existent fora de la jornada.");
            }
        }
        transaccion.set(referencia, {
            // Desem els camps d’horari i augmentem el mateix control que utilitza la creació de reserves.
            timezone, days, revision: Number(documento.get("revision") || 0) + 1
        }, { merge: true });
        return { ok: true };
    });
});
// Tancar o reobrir una data completa, sense deixar cites actives en un dia tancat.
// Rep una petició d’administrador amb dateStr i closed.
// Retorna ok quan s’ha creat o retirat el tancament dins la transacció.
export const setClosedDay = onCall(async (peticion) => {
    const identidad = await comprobarAdministrador(peticion);
    const fecha = validarFechaCalendario(peticion.data?.dateStr);
    // closed ha de ser un booleà real; un text com false no es tracta com una casella desmarcada.
    if (typeof peticion.data?.closed !== "boolean") {
        throw new HttpsError("invalid-argument", "Indica si el dia està tancat.");
    }
    const { baseDatos } = obtenerServiciosAdministrativos();
    return baseDatos.runTransaction(async (transaccion) => {
        await comprobarIdentidadTransaccion(transaccion, baseDatos, identidad);
        const configuracion = await obtenerConfiguracionAgenda(transaccion);
        // Abans de tancar una data, comprovem que no hi quedin cites per resoldre.
        if (peticion.data.closed) {
            const citas = await transaccion.get(baseDatos.collection("bookings").where("dateStr", "==", fecha));
            for (const cita of citas.docs) {
                // Abans de tancar cal resoldre totes les cites que encara ocupen una reserva pendent de prestar.
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
            // Reobrir una data treu el seu tancament; no modifica l’horari setmanal ni les cites.
            transaccion.delete(referencia);
        }
        // Avisem que l’agenda ha canviat perquè una reserva simultània ho torni a comprovar.
        actualizarControlAgenda(transaccion, baseDatos, configuracion);
        return { ok: true };
    });
});
