import { HttpsError } from "firebase-functions/v2/https";
import { convertirHoraAMinutos, obtenerIndiceDia, seSolapanTramos } from "./fechas.js";
export const INTERVALO_MINUTOS = 30;
// Comprovem set dies amb fins a dues franges, sense encavalcaments i de mitja hora.
export function validarHorario(days) {
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
                const inicio = convertirHoraAMinutos(tramo?.start);
                const fin = convertirHoraAMinutos(tramo?.end);
                if (inicio >= fin || inicio % 30 !== 0 || fin % 30 !== 0) {
                    throw new HttpsError("invalid-argument", "Fes servir franges ordenades de mitja hora.");
                }
                ranges.push({ start: tramo.start, end: tramo.end });
            }
            ranges.sort((primero, segundo) => primero.start.localeCompare(segundo.start));
            if (ranges.length === 2 && ranges[0].end > ranges[1].start) {
                throw new HttpsError("invalid-argument", "Les franges no es poden encavalcar.");
            }
        }
        resultado.push({ active: dia.active, ranges });
    }
    return resultado;
}
// El servei sencer ha de cabre en una franja, sense travessar la pausa.
export function cabeEnHorario(days, fecha, inicio, duracion) {
    const dia = days[obtenerIndiceDia(fecha)];
    if (!dia?.active || inicio % 30 !== 0) {
        return false;
    }
    for (const tramo of dia.ranges) {
        if (inicio >= convertirHoraAMinutos(tramo.start) && inicio + duracion <= convertirHoraAMinutos(tramo.end)) {
            return true;
        }
    }
    return false;
}
export function estaOcupado(inicio, duracion, ocupacion) {
    for (const cita of ocupacion) {
        if (seSolapanTramos(inicio, inicio + duracion, cita.inicio, cita.fin)) {
            return true;
        }
    }
    return false;
}
