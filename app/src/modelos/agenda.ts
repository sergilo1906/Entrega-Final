// Forma de les dades d’una cita, un servei i un horari. Són tipus de TypeScript, no documents creats a Firebase.
import type { Timestamp } from "firebase/firestore";
// Els tres estats que pot crear aquesta versió.
export type EstadoCita = "confirmed" | "cancelled" | "done";
// Dades d’un servei del catàleg.
export interface Servicio {
    // ID del document de servei o cita; no és el nom que mostrem a l’usuari.
    id: string;
    name: string;
    // Durada en minuts; els serveis reservables d’aquesta versió són de 30 o 60.
    durationMin: number;
    // Preu numèric en euros, sense incloure el text EUR a la dada.
    price: number;
}
// El servei més el camp que indica si està actiu.
export interface ServicioAdministrable extends Servicio {
    // Si és false, el servei continua al catàleg admin però no s’ofereix per a noves reserves.
    active: boolean;
}
// Dades que llegim d’una cita guardada a Firestore.
export interface Cita {
    // ID del document de servei o cita; no és el nom que mostrem a l’usuari.
    id: string;
    // UID del compte propietari: serveix per consultar només les cites que li corresponen.
    userId: string;
    // El signe ? vol dir que el camp pot faltar, per exemple en una cita antiga.
    userName?: string;
    userEmail?: string;
    // Contacte que tenia el client quan es va crear la cita; pot faltar en registres antics.
    userPhone?: string;
    // Còpia del servei quan es va reservar, encara que el catàleg canviï després.
    serviceSnapshot?: Servicio;
    serviceId?: string;
    dateStr: string;
    // Hora del calendari de la barberia, per exemple 09:30.
    timeStr: string;
    // Durada en minuts; els serveis reservables d’aquesta versió són de 30 o 60.
    durationMin: number;
    // Mostrem els estats antics sense canviar-los ni permetre accions.
    // Aquí permetem text perquè també es puguin llegir estats antics sense convertir-los en confirmats.
    status: string;
    // Instant guardat per Firestore; toDate() permet comparar-lo amb el moment actual.
    startAt?: Timestamp;
}
// Un dia obert o tancat i les seves franges de treball.
export interface DiaHorario {
    active: boolean;
    // Cada franja té una hora d’inici i una de final, totes dues escrites com HH:mm.
    ranges: {
        start: string;
        end: string;
    }[];
}
// Camps que envia el client per demanar una reserva.
export interface SolicitudReserva {
    serviceId: string;
    dateStr: string;
    // Hora del calendari de la barberia, per exemple 09:30.
    timeStr: string;
    // Identifica aquesta intenció de reserva per poder-la repetir sense duplicar cites.
    requestId: string;
}
// Resposta del servidor després de crear o recuperar la mateixa reserva.
export interface ResultadoReserva {
    ok: boolean;
    // Identificador que el servidor retorna per trobar la cita confirmada o recuperada.
    bookingId: string;
    status: EstadoCita;
    // A la resposta remota els instants viatgen com a text ISO, no com a Timestamp de Firestore.
    startAt: string;
    endAt: string;
}
// Una hora lliure del resultat de disponibilitat.
export interface HuecoDisponible {
    // Hora del calendari de la barberia, per exemple 09:30.
    timeStr: string;
}
