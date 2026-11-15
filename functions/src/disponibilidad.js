// Calculem les hores que encara es poden reservar. El mateix càlcul es repeteix en confirmar.
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { obtenerServiciosAdministrativos } from "./firebase.js";
import { comprobarSesion, comprobarUid } from "./permisos.js";
import { obtenerConfiguracionAgenda } from "./configuracion.js";
import { cabeEnHorario, estaOcupado } from "./horarios.js";
import { validarFechaCalendario, convertirHoraAMinutos, convertirMinutosAHora, obtenerIntervaloUtc, comprobarAnticipacion } from "./fechas.js";
// Acceptar només serveis de 30 o 60 minuts.
export function validarDuracion(valor) {
    if (valor !== 30 && valor !== 60) {
        throw new HttpsError("failed-precondition", "La durada ha de ser de 30 o 60 minuts.");
    }
    return valor;
}
// Buscar el servei i comprovar que estigui actiu i tingui preu i durada vàlids.
export async function cargarServicio(id, transaccion = null) {
    const { baseDatos } = obtenerServiciosAdministrativos();
    const referencia = baseDatos.doc("services/" + comprobarUid(id));
    // Si estem confirmant una reserva, llegim el servei dins de la mateixa transacció.
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
// Recollir les hores ocupades del dia; les cancel·lades no ocupen lloc.
export async function cargarOcupacion(fecha, transaccion = null) {
    const { baseDatos } = obtenerServiciosAdministrativos();
    const consulta = baseDatos.collection("bookings").where("dateStr", "==", fecha);
    const documentos = transaccion ? await transaccion.get(consulta) : await consulta.get();
    const ocupacion = [];
    for (const documento of documentos.docs) {
        const cita = documento.data();
        // Una cancel·lada deixa l’hora lliure; passem a la següent cita.
        if (cita.status === "cancelled") {
            continue;
        }
        const duracion = validarDuracion(cita.durationMin ?? cita.serviceSnapshot?.durationMin);
        const inicio = convertirHoraAMinutos(cita.timeStr);
        ocupacion.push({ inicio, fin: inicio + duracion });
    }
    return ocupacion;
}
// Recórrer el dia de mitja hora en mitja hora i quedar-nos només amb les hores on cap el servei.
export function calcularHorasLibres(configuracion, fecha, duracion, ocupacion, ahora = new Date()) {
    const horas = [];
    // 1440 són els minuts d’un dia. Anem provant inicis de mitja hora en mitja hora.
    for (let inicio = 0; inicio + duracion < 1440; inicio += 30) {
        // Si el servei no hi cap sencer o coincideix amb una altra cita, no afegim aquesta hora.
        if (!cabeEnHorario(configuracion.days, fecha, inicio, duracion) || estaOcupado(inicio, duracion, ocupacion)) {
            continue;
        }
        const hora = convertirMinutosAHora(inicio);
        try {
            const intervalo = obtenerIntervaloUtc(fecha, hora, duracion, configuracion.timezone);
            // Només oferim hores que encara no han començat.
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
// Comprovar el compte, la data i el servei i retornar les hores lliures.
export const getAvailability = onCall(async (peticion) => {
    // El segon argument obliga a tenir també el correu verificat.
    await comprobarSesion(peticion, true);
    const fecha = validarFechaCalendario(peticion.data?.dateStr);
    const configuracion = await obtenerConfiguracionAgenda();
    comprobarAnticipacion(fecha, configuracion.timezone);
    const { baseDatos } = obtenerServiciosAdministrativos();
    // Un dia tancat retorna una llista buida, encara que l’horari habitual sigui obert.
    if ((await baseDatos.doc("closedDays/" + fecha).get()).exists) {
        return { ok: true, slots: [] };
    }
    const servicio = await cargarServicio(peticion.data?.serviceId);
    const ocupacion = await cargarOcupacion(fecha);
    const horas = calcularHorasLibres(configuracion, fecha, servicio.durationMin, ocupacion);
    return { ok: true, slots: horas.map(timeStr => ({ timeStr })) };
});
