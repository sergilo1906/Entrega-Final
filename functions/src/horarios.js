// Comprovem els dies de treball, les franges i si un servei hi cap sencer.
import { HttpsError } from "firebase-functions/v2/https";
import { convertirHoraAMinutos, obtenerIndiceDia, seSolapanTramos } from "./fechas.js";
export const INTERVALO_MINUTOS = 30;
// Comprovar que hi hagi set dies amb fins a dues franges ordenades de mitja hora.
export function validarHorario(days) {
    // Necessitem els set dies, incloent els que estan tancats.
    if (!Array.isArray(days) || days.length !== 7) {
        throw new HttpsError("invalid-argument", "Indica els set dies de la setmana.");
    }
    const resultado = [];
    for (const dia of days) {
        if (!dia || typeof dia.active !== "boolean" || !Array.isArray(dia.ranges) || dia.ranges.length > 2) {
            throw new HttpsError("invalid-argument", "El dia de treball no és vàlid.");
        }
        const ranges = [];
        if (dia.active && !dia.ranges.length) {
            throw new HttpsError("invalid-argument", "Un dia obert necessita una franja.");
        }
        if (dia.active) {
            for (const tramo of dia.ranges) {
                // Treballar en minuts permet comparar les hores sense dependre del text.
                const inicio = convertirHoraAMinutos(tramo?.start);
                const fin = convertirHoraAMinutos(tramo?.end);
                if (inicio >= fin || inicio % 30 !== 0 || fin % 30 !== 0) {
                    throw new HttpsError("invalid-argument", "Fes servir franges ordenades de mitja hora.");
                }
                ranges.push({ start: tramo.start, end: tramo.end });
            }
            // Ordenem les dues franges abans de mirar si es trepitgen.
            ranges.sort((primero, segundo) => primero.start.localeCompare(segundo.start));
            // La primera franja ha d’acabar abans que comenci la segona, o just quan comença.
            if (ranges.length === 2 && ranges[0].end > ranges[1].start) {
                throw new HttpsError("invalid-argument", "Les franges no es poden encavalcar.");
            }
        }
        resultado.push({ active: dia.active, ranges });
    }
    return resultado;
}
// Mirar si el servei sencer cap dins d’una sola franja oberta.
export function cabeEnHorario(days, fecha, inicio, duracion) {
    const dia = days[obtenerIndiceDia(fecha)];
    if (!dia?.active || inicio % 30 !== 0) {
        return false;
    }
    for (const tramo of dia.ranges) {
        // L’inici i el final del servei han de quedar dins la mateixa franja.
        if (inicio >= convertirHoraAMinutos(tramo.start) && inicio + duracion <= convertirHoraAMinutos(tramo.end)) {
            return true;
        }
    }
    return false;
}
// Recórrer les cites i retornar true si una coincideix amb l’hora que volem.
export function estaOcupado(inicio, duracion, ocupacion) {
    for (const cita of ocupacion) {
        if (seSolapanTramos(inicio, inicio + duracion, cita.inicio, cita.fin)) {
            return true;
        }
    }
    return false;
}
