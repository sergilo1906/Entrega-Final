// Forma de les dades d’una cita, un servei i un horari. Són tipus de TypeScript, no documents creats a Firebase.
import type { Timestamp } from "firebase/firestore";
// Els tres estats que pot crear aquesta versió.
export type EstadoCita = "confirmed" | "cancelled" | "done";
// Dades d’un servei del catàleg.
export interface Servicio {
    id: string;
    name: string;
    durationMin: number;
    price: number;
}
// El servei més el camp que indica si està actiu.
export interface ServicioAdministrable extends Servicio {
    active: boolean;
}
// Dades que llegim d’una cita guardada a Firestore.
export interface Cita {
    id: string;
    userId: string;
    // El signe ? vol dir que el camp pot faltar, per exemple en una cita antiga.
    userName?: string;
    userEmail?: string;
    userPhone?: string;
    // Còpia del servei quan es va reservar, encara que el catàleg canviï després.
    serviceSnapshot?: Servicio;
    serviceId?: string;
    dateStr: string;
    timeStr: string;
    durationMin: number;
    // Mostrem els estats antics sense canviar-los ni permetre accions.
    status: string;
    startAt?: Timestamp;
}
// Un dia obert o tancat i les seves franges de treball.
export interface DiaHorario {
    active: boolean;
    ranges: {
        start: string;
        end: string;
    }[];
}
// Camps que envia el client per demanar una reserva.
export interface SolicitudReserva {
    serviceId: string;
    dateStr: string;
    timeStr: string;
    // Identifica aquesta intenció de reserva per poder-la repetir sense duplicar cites.
    requestId: string;
}
// Resposta del servidor després de crear o recuperar la mateixa reserva.
export interface ResultadoReserva {
    ok: boolean;
    bookingId: string;
    status: EstadoCita;
    startAt: string;
    endAt: string;
}
// Una hora lliure del resultat de disponibilitat.
export interface HuecoDisponible {
    timeStr: string;
}
