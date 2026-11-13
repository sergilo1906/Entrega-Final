import { createHash } from "node:crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { obtenerServiciosAdministrativos } from "./firebase.js";
import { comprobarUid, comprobarIdentidadTransaccion } from "./permisos.js";
import { obtenerConfiguracionAgenda, actualizarControlAgenda, UID_PROFESIONAL } from "./configuracion.js";
import { cargarServicio, cargarOcupacion, calcularHorasLibres } from "./disponibilidad.js";
import { validarFechaCalendario, validarHora, convertirHoraAMinutos, convertirMinutosAHora, obtenerIntervaloUtc, comprobarAnticipacion } from "./fechas.js";
const hash = texto => createHash("sha256").update(texto).digest("hex");
function respuestaReserva(id, cita) {
    return {
        ok: true, bookingId: id, status: cita.status, startAt: cita.startAt.toDate().toISOString(), endAt: cita.endAt.toDate().toISOString()
    };
}
// El client i la sol·licitud donen sempre el mateix ID per evitar duplicats.
export async function crearReserva(identidad, datos) {
    const serviceId = comprobarUid(datos?.serviceId);
    const dateStr = validarFechaCalendario(datos?.dateStr);
    const timeStr = validarHora(datos?.timeStr);
    const requestId = comprobarUid(datos?.requestId);
    if (convertirHoraAMinutos(timeStr) % 30 !== 0) {
        throw new HttpsError("invalid-argument", "Tria una hora de la graella.");
    }
    const uid = identidad.usuario.uid;
    const id = hash(JSON.stringify([uid, requestId]));
    const fingerprint = hash(JSON.stringify([serviceId, dateStr, timeStr]));
    const { baseDatos } = obtenerServiciosAdministrativos();
    const referencia = baseDatos.doc("bookings/" + id);
    return baseDatos.runTransaction(async (transaccion) => {
        const perfil = await comprobarIdentidadTransaccion(transaccion, baseDatos, identidad);
        const existente = await transaccion.get(referencia);
        if (existente.exists) {
            if (existente.get("requestHash") !== fingerprint) {
                throw new HttpsError("failed-precondition", "La sol·licitud ja s’ha fet servir amb unes altres dades.");
            }
            return respuestaReserva(id, existente.data());
        }
        const configuracion = await obtenerConfiguracionAgenda(transaccion);
        comprobarAnticipacion(dateStr, configuracion.timezone);
        const cerrado = await transaccion.get(baseDatos.doc("closedDays/" + dateStr));
        if (cerrado.exists) {
            throw new HttpsError("failed-precondition", "La barberia està tancada aquest dia.");
        }
        const servicio = await cargarServicio(serviceId, transaccion);
        const ocupacion = await cargarOcupacion(dateStr, transaccion);
        const horas = calcularHorasLibres(configuracion, dateStr, servicio.durationMin, ocupacion);
        if (!horas.includes(timeStr)) {
            throw new HttpsError("already-exists", "L’hora ja no està disponible.");
        }
        const intervalo = obtenerIntervaloUtc(dateStr, timeStr, servicio.durationMin, configuracion.timezone);
        const lockKeys = [];
        for (let minuto = convertirHoraAMinutos(timeStr); minuto < convertirHoraAMinutos(timeStr) + servicio.durationMin; minuto += 30) {
            const clave = UID_PROFESIONAL + "_" + dateStr + "_" + convertirMinutosAHora(minuto);
            const documento = await transaccion.get(baseDatos.doc("bookingLocks/" + clave));
            if (documento.exists) {
                throw new HttpsError("already-exists", "Hora ocupada.");
            }
            lockKeys.push(clave);
        }
        const cita = {
            userId: uid, userName: String(perfil.name || identidad.usuario.displayName || "Client"),
            userEmail: identidad.usuario.email || "", userPhone: String(perfil.phone || ""),
            barberUid: UID_PROFESIONAL, serviceId, serviceSnapshot: servicio, durationMin: servicio.durationMin,
            dateStr, timeStr, status: "confirmed", lockKeys, requestHash: fingerprint,
            startAt: Timestamp.fromDate(intervalo.inicio), endAt: Timestamp.fromDate(intervalo.fin),
            createdAt: FieldValue.serverTimestamp(),
        };
        // Després de totes les lectures, desem la cita, les cel·les i el control alhora.
        transaccion.create(referencia, cita);
        for (const clave of lockKeys) {
            transaccion.create(baseDatos.doc("bookingLocks/" + clave), { bookingId: id });
        }
        actualizarControlAgenda(transaccion, baseDatos, configuracion);
        return respuestaReserva(id, cita);
    });
}
// Cancel·lar allibera les cel·les pròpies; completar les conserva.
export async function cambiarEstado(identidad, datos, estado) {
    const id = comprobarUid(datos?.bookingId);
    const { baseDatos } = obtenerServiciosAdministrativos();
    return baseDatos.runTransaction(async (transaccion) => {
        await comprobarIdentidadTransaccion(transaccion, baseDatos, identidad);
        const referencia = baseDatos.doc("bookings/" + id);
        const documento = await transaccion.get(referencia);
        if (!documento.exists) {
            throw new HttpsError("not-found", "No s’ha trobat la cita.");
        }
        const cita = documento.data();
        if (identidad.rol !== "admin" && (estado !== "cancelled" || cita.userId !== identidad.usuario.uid)) {
            throw new HttpsError("permission-denied", "No pots modificar aquesta cita.");
        }
        if (cita.status === estado) {
            return {
                ok: true, bookingId: id, status: estado
            };
        }
        if (cita.status !== "confirmed") {
            throw new HttpsError("failed-precondition", "La cita no admet aquest canvi. Les dades antigues necessiten una revisió.");
        }
        if (identidad.rol !== "admin" && (!cita.startAt?.toDate || cita.startAt.toDate() <= new Date())) {
            throw new HttpsError("failed-precondition", "Només pots cancel·lar cites futures.");
        }
        const configuracion = await obtenerConfiguracionAgenda(transaccion);
        const locks = [];
        for (const clave of cita.lockKeys || []) {
            if (typeof clave !== "string" || clave.includes("/")) {
                throw new HttpsError("failed-precondition", "L’ocupació antiga no és vàlida.");
            }
            locks.push(await transaccion.get(baseDatos.doc("bookingLocks/" + clave)));
        }
        transaccion.update(referencia, { status: estado, updatedAt: FieldValue.serverTimestamp() });
        if (estado === "cancelled") {
            for (const lock of locks) {
                if (lock.exists && lock.get("bookingId") === id) {
                    transaccion.delete(lock.ref);
                }
            }
        }
        actualizarControlAgenda(transaccion, baseDatos, configuracion);
        return {
            ok: true, bookingId: id, status: estado
        };
    });
}
