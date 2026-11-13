import { HttpsError, onCall } from "firebase-functions/v2/https";
import { obtenerServiciosAdministrativos } from "./firebase.js";
import { comprobarSesion, comprobarUid } from "./permisos.js";
import { obtenerConfiguracionAgenda } from "./configuracion.js";
import { cabeEnHorario, estaOcupado } from "./horarios.js";
import { validarFechaCalendario, convertirHoraAMinutos, convertirMinutosAHora, obtenerIntervaloUtc, comprobarAnticipacion } from "./fechas.js";
// Cada servei ocupa una o dues cel·les de mitja hora.
export function validarDuracion(valor) {
    if (valor !== 30 && valor !== 60) {
        throw new HttpsError("failed-precondition", "La durada ha de ser de 30 o 60 minuts.");
    }
    return valor;
}
// Comprovem que el servei existeixi, estigui actiu i tingui dades vàlides.
export async function cargarServicio(id, transaccion = null) {
    const { baseDatos } = obtenerServiciosAdministrativos();
    const referencia = baseDatos.doc("services/" + comprobarUid(id));
    const documento = transaccion ? await transaccion.get(referencia) : await referencia.get();
    if (!documento.exists || documento.get("active") !== true) {
        throw new HttpsError("failed-precondition", "El servei no està disponible.");
    }
    const datos = documento.data();
    if (typeof datos.name !== "string" || !datos.name.trim() || !Number.isFinite(datos.price) || datos.price < 0) {
        throw new HttpsError("failed-precondition", "El servei no és vàlid.");
    }
    return {
        id: documento.id, name: datos.name, price: datos.price, durationMin: validarDuracion(datos.durationMin)
    };
}
// Les cites antigues també ocupen hora; no en canviem l’estat.
export async function cargarOcupacion(fecha, transaccion = null) {
    const { baseDatos } = obtenerServiciosAdministrativos();
    const consulta = baseDatos.collection("bookings").where("dateStr", "==", fecha);
    const documentos = transaccion ? await transaccion.get(consulta) : await consulta.get();
    const ocupacion = [];
    for (const documento of documentos.docs) {
        const cita = documento.data();
        if (cita.status === "cancelled") {
            continue;
        }
        const duracion = validarDuracion(cita.durationMin ?? cita.serviceSnapshot?.durationMin);
        const inicio = convertirHoraAMinutos(cita.timeStr);
        ocupacion.push({ inicio, fin: inicio + duracion });
    }
    return ocupacion;
}
// Calculem les hores igual quan les mostrem i quan confirmem la reserva.
export function calcularHorasLibres(configuracion, fecha, duracion, ocupacion, ahora = new Date()) {
    const horas = [];
    for (let inicio = 0; inicio + duracion < 1440; inicio += 30) {
        if (!cabeEnHorario(configuracion.days, fecha, inicio, duracion) || estaOcupado(inicio, duracion, ocupacion)) {
            continue;
        }
        const hora = convertirMinutosAHora(inicio);
        try {
            const intervalo = obtenerIntervaloUtc(fecha, hora, duracion, configuracion.timezone);
            if (intervalo.inicio > ahora) {
                horas.push(hora);
            }
        }
        catch (error) {
            if (error.code !== "failed-precondition") {
                throw error;
            }
        }
    }
    return horas;
}
// Consultem les hores lliures després de validar la sessió i la data.
export const getAvailability = onCall(async (peticion) => {
    await comprobarSesion(peticion, true);
    const fecha = validarFechaCalendario(peticion.data?.dateStr);
    const configuracion = await obtenerConfiguracionAgenda();
    comprobarAnticipacion(fecha, configuracion.timezone);
    const { baseDatos } = obtenerServiciosAdministrativos();
    if ((await baseDatos.doc("closedDays/" + fecha).get()).exists) {
        return { ok: true, slots: [] };
    }
    const servicio = await cargarServicio(peticion.data?.serviceId);
    const ocupacion = await cargarOcupacion(fecha);
    const horas = calcularHorasLibres(configuracion, fecha, servicio.durationMin, ocupacion);
    return { ok: true, slots: horas.map(timeStr => ({ timeStr })) };
});
