// Comprovem els dies de treball, les franges i si un servei hi cap sencer.
import { HttpsError } from "firebase-functions/v2/https";
import { convertirHoraAMinutos, obtenerIndiceDia, seSolapanTramos } from "./fechas.js";
export const INTERVALO_MINUTOS = 30;
// Comprovar que hi hagi set dies amb fins a dues franges ordenades de mitja hora.
// Rep la llista de set dies amb active i ranges.
// Retorna una llista neta i ordenada de franges o un error si no són vàlides.
export function validarHorario(days) {
    // Necessitem els set dies, incloent els que estan tancats.
    if (!Array.isArray(days) || days.length !== 7) {
        throw new HttpsError("invalid-argument", "Indica els set dies de la setmana.");
    }
    const resultado = [];
    for (const dia of days) {
        // Comprovem la forma de cada dia i el límit de dues franges abans de recórrer-les.
        if (!dia || typeof dia.active !== "boolean" || !Array.isArray(dia.ranges) || dia.ranges.length > 2) {
            throw new HttpsError("invalid-argument", "El dia de treball no és vàlid.");
        }
        const ranges = [];
        // Un dia que es marca obert necessita com a mínim una franja de treball.
        if (dia.active && !dia.ranges.length) {
            throw new HttpsError("invalid-argument", "Un dia obert necessita una franja.");
        }
        if (dia.active) {
            for (const tramo of dia.ranges) {
                // Treballar en minuts permet comparar les hores sense dependre del text.
                const inicio = convertirHoraAMinutos(tramo?.start);
                const fin = convertirHoraAMinutos(tramo?.end);
                // No acceptem una franja buida, invertida ni amb extrems fora dels intervals de mitja hora.
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
        // Per a un dia tancat deixem ranges buit, encara que arribessin franges a la petició.
        resultado.push({ active: dia.active, ranges });
    }
    return resultado;
}
// Mirar si el servei sencer cap dins d’una sola franja oberta.
// Rep els set dies, una data, l’inici en minuts i la durada del servei.
// Retorna true si l’interval sencer queda dins d’una franja d’aquell dia.
export function cabeEnHorario(days, fecha, inicio, duracion) {
    // L’índex es calcula a partir del dia del calendari, sense desplaçar-lo per la zona del servidor.
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
    // Si cap franja conté tota la durada, no es pot reservar encara que hi càpiga una part.
    return false;
}
// Recórrer les cites i retornar true si una coincideix amb l’hora que volem.
// Rep un inici, una durada i els intervals de les cites que ja ocupen lloc.
// Retorna true tan bon punt troba una cita que coincideix amb el temps demanat.
export function estaOcupado(inicio, duracion, ocupacion) {
    for (const cita of ocupacion) {
        if (seSolapanTramos(inicio, inicio + duracion, cita.inicio, cita.fin)) {
            return true;
        }
    }
    return false;
}
