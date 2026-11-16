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
// Rep un text que identifica una intenció o unes dades.
// Retorna el resum SHA-256 en hexadecimal; no és un xifrat que es pugui desfer.
const hash = texto => createHash("sha256").update(texto).digest("hex");
// Preparar la resposta amb l’ID, l’estat actual i les hores de la cita.
// Rep l’ID i el document de la cita nova o ja existent.
// Retorna la resposta pública amb estat actual i instants en text ISO.
function respuestaReserva(id, cita) {
    return {
        ok: true, bookingId: id, status: cita.status, startAt: cita.startAt.toDate().toISOString(), endAt: cita.endAt.toDate().toISOString()
    };
}
// Comprovar les dades i guardar la cita amb les marques d’ocupació en una sola transacció.
// Rep la identitat comprovada i els camps enviats per reservar.
// Retorna el resultat de la transacció: la mateixa cita en un reintent o una nova confirmada.
export async function crearReserva(identidad, datos) {
    // Comprovem primer els camps rebuts; no ens refiem dels valors que envia la pantalla.
    const serviceId = comprobarUid(datos?.serviceId);
    const dateStr = validarFechaCalendario(datos?.dateStr);
    const timeStr = validarHora(datos?.timeStr);
    const requestId = comprobarUid(datos?.requestId);
    // El residu ha de ser zero per acceptar només inicis de mitja hora; 09:15, per exemple, es rebutja.
    if (convertirHoraAMinutos(timeStr) % 30 !== 0) {
        throw new HttpsError("invalid-argument", "Tria una hora de la graella.");
    }
    // La propietat surt de la identitat comprovada, no d’un userId que el client pugui inventar.
    const uid = identidad.usuario.uid;
    // El mateix compte i requestId donen el mateix ID, encara que es premi dues vegades.
    const id = hash(JSON.stringify([uid, requestId]));
    // Aquesta segona marca permet detectar si es reutilitza la sol·licitud amb una altra hora.
    const fingerprint = hash(JSON.stringify([serviceId, dateStr, timeStr]));
    const { baseDatos } = obtenerServiciosAdministrativos();
    // La mateixa intenció apunta al mateix document; no fem servir un ID aleatori nou a cada reintent.
    const referencia = baseDatos.doc("bookings/" + id);
    // La transacció ho guarda tot junt. Si algú canvia les dades llegides, Firebase ho torna a comprovar.
    return baseDatos.runTransaction(async (transaccion) => {
        // Llegim el contacte i tornem a comprovar el rol dins l’operació que guardarà la cita.
        const perfil = await comprobarIdentidadTransaccion(transaccion, baseDatos, identidad);
        const existente = await transaccion.get(referencia);
        // Si ja s’havia guardat, retornem aquella cita en lloc de crear-ne una altra.
        if (existente.exists) {
            // Un requestId no es pot reutilitzar canviant servei, data o hora: deixaria de ser el mateix intent.
            if (existente.get("requestHash") !== fingerprint) {
                throw new HttpsError("failed-precondition", "La sol·licitud ja s’ha fet servir amb unes altres dades.");
            }
            // Retornem l’estat que tingui ara la cita, encara que s’hagi cancel·lat després de crear-se.
            return respuestaReserva(id, existente.data());
        }
        const configuracion = await obtenerConfiguracionAgenda(transaccion);
        // El servidor torna a exigir el límit encara que l’input de data ja el mostrés al navegador.
        comprobarAnticipacion(dateStr, configuracion.timezone);
        const cerrado = await transaccion.get(baseDatos.doc("closedDays/" + dateStr));
        // La llista d’hores es podria haver consultat abans de tancar el dia; ho comprovem una altra vegada ara.
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
            // Una marca existent significa que no podem ocupar aquesta mitja hora, encara que la pantalla abans la mostrés lliure.
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
            // La data de creació la posa el servidor; no confiem en el rellotge del client.
            createdAt: FieldValue.serverTimestamp(),
        };
        // Després de totes les lectures, desem la cita, les cel·les i el control alhora.
        transaccion.create(referencia, cita);
        for (const clave of lockKeys) {
            transaccion.create(baseDatos.doc("bookingLocks/" + clave), { bookingId: id });
        }
        // El mateix document de control coordina aquest canvi amb altres reserves, horaris o tancaments.
        actualizarControlAgenda(transaccion, baseDatos, configuracion);
        return respuestaReserva(id, cita);
    });
}
// Cancel·lar o completar una cita comprovant el propietari i l’estat anterior.
// Rep la identitat, el bookingId i l’estat cancelled o done que volem aplicar.
// Retorna el resultat després de validar permisos, estat anterior i marques d’ocupació.
export async function cambiarEstado(identidad, datos, estado) {
    const id = comprobarUid(datos?.bookingId);
    const { baseDatos } = obtenerServiciosAdministrativos();
    // La transacció ho guarda tot junt. Si algú canvia les dades llegides, Firebase ho torna a comprovar.
    return baseDatos.runTransaction(async (transaccion) => {
        await comprobarIdentidadTransaccion(transaccion, baseDatos, identidad);
        const referencia = baseDatos.doc("bookings/" + id);
        const documento = await transaccion.get(referencia);
        // No modifiquem una cita que no existeix; retornem un error conegut al formulari.
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
        // Per a clients, una cita passada o sense un inici vàlid no es pot cancel·lar des d’aquest flux.
        if (identidad.rol !== "admin" && (!cita.startAt?.toDate || cita.startAt.toDate() <= new Date())) {
            throw new HttpsError("failed-precondition", "Només pots cancel·lar cites futures.");
        }
        const configuracion = await obtenerConfiguracionAgenda(transaccion);
        // Llegim les marques abans d’escriure, com demana una transacció de Firestore.
        const locks = [];
        for (const clave of cita.lockKeys || []) {
            // Les claus antigues malformades no s’han d’utilitzar per construir camins a altres documents.
            if (typeof clave !== "string" || clave.includes("/")) {
                throw new HttpsError("failed-precondition", "L’ocupació antiga no és vàlida.");
            }
            locks.push(await transaccion.get(baseDatos.doc("bookingLocks/" + clave)));
        }
        // El canvi d’estat conserva la resta de dades de la reserva i n’anota el moment.
        transaccion.update(referencia, { status: estado, updatedAt: FieldValue.serverTimestamp() });
        // Completar una cita manté les marques d’ocupació; només cancel·lar intenta alliberar-les.
        if (estado === "cancelled") {
            for (const lock of locks) {
                // Només alliberem una marca si encara apunta a aquesta cita.
                if (lock.exists && lock.get("bookingId") === id) {
                    transaccion.delete(lock.ref);
                }
            }
        }
        // El mateix document de control coordina aquest canvi amb altres reserves, horaris o tancaments.
        actualizarControlAgenda(transaccion, baseDatos, configuracion);
        return {
            ok: true, bookingId: id, status: estado
        };
    });
}
