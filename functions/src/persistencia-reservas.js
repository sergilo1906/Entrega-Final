// Guardem la cita i les marques que ocupen cada mitja hora. Ho fem tot junt per no deixar dues cites a la mateixa hora.
import { createHash } from "node:crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { obtenerServiciosAdministrativos } from "./firebase.js";
import { comprobarUid, comprobarIdentidadTransaccion } from "./permisos.js";
import { obtenerConfiguracionAgenda, actualizarControlAgenda, UID_PROFESIONAL } from "./configuracion.js";
import { cargarServicio, cargarOcupacion, calcularHorasLibres } from "./disponibilidad.js";
import { validarFechaCalendario, validarHora, convertirHoraAMinutos, convertirMinutosAHora, obtenerIntervaloUtc, comprobarAnticipacion } from "./fechas.js";
// Convertir el text en un identificador fix: el mateix text dona el mateix resultat.
const hash = texto => createHash("sha256").update(texto).digest("hex");
// Preparar la resposta amb l’ID, l’estat actual i les hores de la cita.
function respuestaReserva(id, cita) {
    return {
        ok: true, bookingId: id, status: cita.status, startAt: cita.startAt.toDate().toISOString(), endAt: cita.endAt.toDate().toISOString()
    };
}
// Comprovar les dades i guardar la cita amb les marques d’ocupació en una sola transacció.
export async function crearReserva(identidad, datos) {
    // Comprovem primer els camps rebuts; no ens refiem dels valors que envia la pantalla.
    const serviceId = comprobarUid(datos?.serviceId);
    const dateStr = validarFechaCalendario(datos?.dateStr);
    const timeStr = validarHora(datos?.timeStr);
    const requestId = comprobarUid(datos?.requestId);
    if (convertirHoraAMinutos(timeStr) % 30 !== 0) {
        throw new HttpsError("invalid-argument", "Tria una hora de la graella.");
    }
    const uid = identidad.usuario.uid;
    // El mateix compte i requestId donen el mateix ID, encara que es premi dues vegades.
    const id = hash(JSON.stringify([uid, requestId]));
    // Aquesta segona marca permet detectar si es reutilitza la sol·licitud amb una altra hora.
    const fingerprint = hash(JSON.stringify([serviceId, dateStr, timeStr]));
    const { baseDatos } = obtenerServiciosAdministrativos();
    const referencia = baseDatos.doc("bookings/" + id);
    // La transacció ho guarda tot junt. Si algú canvia les dades llegides, Firebase ho torna a comprovar.
    return baseDatos.runTransaction(async (transaccion) => {
        const perfil = await comprobarIdentidadTransaccion(transaccion, baseDatos, identidad);
        const existente = await transaccion.get(referencia);
        // Si ja s’havia guardat, retornem aquella cita en lloc de crear-ne una altra.
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
        // Recalculem ara el buit: una altra persona pot haver reservat després de mostrar les hores.
        const horas = calcularHorasLibres(configuracion, dateStr, servicio.durationMin, ocupacion);
        if (!horas.includes(timeStr)) {
            throw new HttpsError("already-exists", "L’hora ja no està disponible.");
        }
        const intervalo = obtenerIntervaloUtc(dateStr, timeStr, servicio.durationMin, configuracion.timezone);
        const lockKeys = [];
        // Cada volta prepara una marca de mitja hora. Un servei de 60 minuts en necessita dues.
        for (let minuto = convertirHoraAMinutos(timeStr); minuto < convertirHoraAMinutos(timeStr) + servicio.durationMin; minuto += 30) {
            const clave = UID_PROFESIONAL + "_" + dateStr + "_" + convertirMinutosAHora(minuto);
            const documento = await transaccion.get(baseDatos.doc("bookingLocks/" + clave));
            if (documento.exists) {
                throw new HttpsError("already-exists", "Hora ocupada.");
            }
            lockKeys.push(clave);
        }
        // Guardem el contacte i una còpia del servei perquè els canvis posteriors no alterin la cita.
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
// Cancel·lar o completar una cita comprovant el propietari i l’estat anterior.
export async function cambiarEstado(identidad, datos, estado) {
    const id = comprobarUid(datos?.bookingId);
    const { baseDatos } = obtenerServiciosAdministrativos();
    // La transacció ho guarda tot junt. Si algú canvia les dades llegides, Firebase ho torna a comprovar.
    return baseDatos.runTransaction(async (transaccion) => {
        await comprobarIdentidadTransaccion(transaccion, baseDatos, identidad);
        const referencia = baseDatos.doc("bookings/" + id);
        const documento = await transaccion.get(referencia);
        if (!documento.exists) {
            throw new HttpsError("not-found", "No s’ha trobat la cita.");
        }
        const cita = documento.data();
        // El client només pot cancel·lar cites seves; completar és una operació d’administrador.
        if (identidad.rol !== "admin" && (estado !== "cancelled" || cita.userId !== identidad.usuario.uid)) {
            throw new HttpsError("permission-denied", "No pots modificar aquesta cita.");
        }
        // Si el canvi ja s’havia fet, podem retornar el resultat sense repetir-lo.
        if (cita.status === estado) {
            return {
                ok: true, bookingId: id, status: estado
            };
        }
        // Només canviem les confirmades; no reinterpretarem una cita amb un estat antic.
        if (cita.status !== "confirmed") {
            throw new HttpsError("failed-precondition", "La cita no admet aquest canvi. Les dades antigues necessiten una revisió.");
        }
        if (identidad.rol !== "admin" && (!cita.startAt?.toDate || cita.startAt.toDate() <= new Date())) {
            throw new HttpsError("failed-precondition", "Només pots cancel·lar cites futures.");
        }
        const configuracion = await obtenerConfiguracionAgenda(transaccion);
        // Llegim les marques abans d’escriure, com demana una transacció de Firestore.
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
                // Només alliberem una marca si encara apunta a aquesta cita.
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
