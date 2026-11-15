// Comprovem dates i hores i les convertim a UTC, que representa el mateix instant per a tothom.
import { HttpsError } from "firebase-functions/v2/https";
import { fromZonedTime } from "date-fns-tz";
// Separar any, mes, dia i hora segons la zona de la barberia.
export function formatearFechaZona(instante, zona) {
    const partes = new Intl.DateTimeFormat("en-CA", {
        timeZone: zona, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23"
    }).formatToParts(instante);
    const valores = {};
    for (const parte of partes) {
        valores[parte.type] = parte.value;
    }
    return valores.year + "-" + valores.month + "-" + valores.day + "T" + valores.hour + ":" + valores.minute;
}
// Comprovar el format de la data i que aquest dia existeixi de veritat.
export function validarFechaCalendario(fecha) {
    if (typeof fecha !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
        throw new HttpsError("invalid-argument", "La data no és vàlida.");
    }
    const instante = new Date(fecha + "T00:00:00Z");
    // Una data com 30 de febrer no és vàlida encara que tingui format any-mes-dia.
    if (!Number.isFinite(instante.getTime()) || instante.toISOString().slice(0, 10) !== fecha) {
        throw new HttpsError("invalid-argument", "La data no existeix al calendari.");
    }
    return fecha;
}
// Comprovar que l’hora tingui format HH:mm i valors vàlids.
export function validarHora(hora) {
    if (typeof hora !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) {
        throw new HttpsError("invalid-argument", "L’hora no és vàlida.");
    }
    return hora;
}
// Convertir l’hora a minuts per poder comparar i sumar durades.
export function convertirHoraAMinutos(hora) {
    validarHora(hora);
    // Separem hores i minuts; per exemple, 09:30 són 570 minuts.
    return Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3));
}
// Passar els minuts a HH:mm i posar zeros si fan falta.
export function convertirMinutosAHora(minutos) {
    return String(Math.floor(minutos / 60)).padStart(2, "0") + ":" + String(minutos % 60).padStart(2, "0");
}
// Obtenir el dia de la setmana: diumenge és 0 i dissabte és 6.
export function obtenerIndiceDia(fecha) {
    return new Date(validarFechaCalendario(fecha) + "T00:00:00Z").getUTCDay();
}
// Sumar dies a una data, també si canviem de mes o d’any.
export function sumarDiasCalendario(fecha, dias) {
    const instante = new Date(validarFechaCalendario(fecha) + "T00:00:00Z");
    instante.setUTCDate(instante.getUTCDate() + dias);
    return instante.toISOString().slice(0, 10);
}
// Mirar si dues franges coincideixen en algun moment.
export function seSolapanTramos(inicio, fin, otroInicio, otroFin) {
    // Si una franja acaba just quan comença l’altra, no comparteixen temps.
    return inicio < otroFin && otroInicio < fin;
}
// Passar data i hora del negoci a un instant UTC i comprovar que l’hora existeixi.
export function convertirAFechaUtc(fecha, hora, zona) {
    validarFechaCalendario(fecha);
    validarHora(hora);
    const instante = fromZonedTime(fecha + "T" + hora + ":00", zona);
    // Tornem a l’hora local per detectar hores inexistents del canvi de primavera.
    if (!Number.isFinite(instante.getTime()) || formatearFechaZona(instante, zona) !== fecha + "T" + hora) {
        throw new HttpsError("failed-precondition", "L’hora no existeix a la zona horària de la barberia.");
    }
    return instante;
}
// Calcular l’inici i el final reals de la cita, sense creuar un canvi d’hora o de dia.
export function obtenerIntervaloUtc(fecha, hora, duracion, zona) {
    const inicio = convertirAFechaUtc(fecha, hora, zona);
    // Passem els minuts a mil·lisegons per sumar la durada a l’instant d’inici.
    const fin = new Date(inicio.getTime() + duracion * 60000);
    const minutosFin = convertirHoraAMinutos(hora) + duracion;
    // HH:mm no distingeix una hora repetida. Fem servir la conversió de la llibreria
    // i descartem intervals que travessen el canvi d’hora.
    if (minutosFin >= 1440 || formatearFechaZona(fin, zona) !== fecha + "T" + convertirMinutosAHora(minutosFin)) {
        throw new HttpsError("failed-precondition", "L’interval travessa un canvi d’hora o de dia.");
    }
    return { inicio, fin };
}
// Rebutjar dates de més de trenta dies endavant.
export function comprobarAnticipacion(fecha, zona, ahora = new Date()) {
    const hoy = formatearFechaZona(ahora, zona).slice(0, 10);
    const limite = new Date(hoy + "T00:00:00Z");
    // Date calcula també el canvi de mes o d’any quan sumem els trenta dies.
    limite.setUTCDate(limite.getUTCDate() + 30);
    if (fecha > limite.toISOString().slice(0, 10)) {
        throw new HttpsError("failed-precondition", "Només es pot reservar amb 30 dies d’antelació.");
    }
}
