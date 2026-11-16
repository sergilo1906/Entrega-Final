// Funcions per treballar amb dates segons l’hora de la barberia, encara que el navegador sigui en un altre país.
import { fromZonedTime } from "date-fns-tz";
import type { Cita } from "../modelos/agenda";
// Comprovar que la data tingui format correcte i existeixi al calendari.
// Rep una data escrita com any-mes-dia.
// Retorna true només si el format i el dia del calendari són correctes.
export function esFechaCalendarioValida(fecha: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
        return false;
    }
    const instante = new Date(fecha + "T00:00:00Z");
    return Number.isFinite(instante.getTime()) && instante.toISOString().slice(0, 10) === fecha;
}
// Agafar l’inici de la cita; si és antiga, calcular-lo amb la zona de la barberia.
// Rep la cita i la zona horària que utilitza el negoci.
// Retorna un Date de l’inici, o un Date no vàlid si no es pot interpretar.
export function obtenerInicioCita(cita: Pick<Cita, "startAt" | "dateStr" | "timeStr">, zona: string): Date {
    // Si Firestore ja ens ha donat un Timestamp d’inici, el convertim directament a Date.
    if (cita.startAt && typeof cita.startAt.toDate === "function") {
        return cita.startAt.toDate();
    }
    // Llegim les cites antigues amb la zona de la barberia, no la del navegador.
    const hora = cita.timeStr || "00:00";
    if (!esFechaCalendarioValida(cita.dateStr) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) {
        return new Date(NaN);
    }
    // Per a dades antigues interpretem la data i l’hora amb la zona del negoci, no com a hora local de l’ordinador.
    const instante = fromZonedTime(cita.dateStr + "T" + hora + ":00", zona);
    const partes = new Intl.DateTimeFormat("en-GB", {
        timeZone: zona, hour: "2-digit", minute: "2-digit", hourCycle: "h23"
    }).format(instante);
    // Tornem a comparar la conversió per detectar una hora local que no existeixi pel canvi d’hora.
    if (formatearFechaNegocio(zona, instante) !== cita.dateStr || partes !== hora) {
        return new Date(NaN);
    }
    return instante;
}
// Retornar el dia que és a la barberia, no el que marca l’ordinador.
// Rep la zona del negoci i, opcionalment, un instant; per defecte utilitza ara.
// Retorna la data any-mes-dia que correspon a aquella zona.
export function formatearFechaNegocio(zona: string, instante = new Date()): string {
    const partes = new Intl.DateTimeFormat("en-CA", {
        timeZone: zona, year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(instante);
    let anio = "";
    let mes = "";
    let dia = "";
    // formatToParts separa la data en peces amb nom; així no depenem de si s’escriu dia/mes o mes/dia.
    for (const parte of partes) {
        if (parte.type === "year") {
            anio = parte.value;
        }
        if (parte.type === "month") {
            mes = parte.value;
        }
        if (parte.type === "day") {
            dia = parte.value;
        }
    }
    return anio + "-" + mes + "-" + dia;
}
// Sumar dies a una data, també si canviem de mes o d’any.
// Rep la data de partida i quants dies volem sumar, que també poden ser negatius.
// Retorna una data nova en format any-mes-dia.
export function sumarDiasCalendario(fecha: string, dias: number): string {
    const instante = new Date(fecha + "T00:00:00Z");
    instante.setUTCDate(instante.getUTCDate() + dias);
    return instante.toISOString().slice(0, 10);
}
