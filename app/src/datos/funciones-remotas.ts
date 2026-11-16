// Funcions que envien les dades del navegador al servidor. El servidor decideix si pot fer el canvi.
import { httpsCallable } from "firebase/functions";
import { obtenerServiciosFirebase } from "./firebase";
import type { HuecoDisponible, SolicitudReserva, ResultadoReserva, ServicioAdministrable } from "../modelos/agenda";
import type { ConfiguracionAgenda } from "../modelos/aplicacion";
// Enviar les dades a una funció del servidor i esperar-ne la resposta.
// Rep el nom de la funció remota i les dades que li volem enviar.
// Retorna la promesa amb data de la resposta de Firebase, o llança l’error rebut.
async function llamar<Entrada, Salida>(nombre: string, datos: Entrada): Promise<Salida> {
    const servicios = obtenerServiciosFirebase();
    if (!servicios) {
        throw new Error("Firebase no està configurat.");
    }
    // El SDK adjunta el token de la sessió a la petició; nosaltres recollim només el camp data de la resposta.
    return (await httpsCallable<Entrada, Salida>(servicios.funcionesRemotas, nombre)(datos)).data;
}
// Demanar al servidor quines hores queden lliures per al servei i la data.
// Rep serviceId i dateStr de la selecció actual.
// Retorna la resposta amb slots, una llista d’hores disponibles.
export function consultarDisponibilidad(datos: Pick<SolicitudReserva, "dateStr" | "serviceId">) {
    return llamar<typeof datos, {
        slots: HuecoDisponible[];
    }>("getAvailability", datos);
}
// Enviar servei, data, hora i identificador de sol·licitud per confirmar la cita.
// Rep servei, data, hora i el requestId que identifica aquesta sol·licitud.
// Retorna la cita i l’estat actual que ha confirmat el servidor.
export function solicitarReserva(datos: SolicitudReserva) {
    return llamar<SolicitudReserva, ResultadoReserva>("createBooking", datos);
}
// Demanar al servidor que cancel·li la cita indicada.
// Rep el bookingId de la cita que es vol cancel·lar.
// Retorna la resposta de cancelBooking; no escriu directament a Firestore.
export function cancelarReserva(bookingId: string) {
    return llamar("cancelBooking", { bookingId });
}
// Demanar que la cita passi a completada; el servidor exigeix administrador.
// Rep el bookingId seleccionat per l’administrador.
// Retorna la resposta de completeBooking després de validar els permisos al servidor.
export function completarReserva(bookingId: string) {
    return llamar("completeBooking", { bookingId });
}
// Enviar els camps del servei perquè el servidor els comprovi i els guardi.
// Rep un objecte amb l’ID i els camps editables del servei.
// Retorna la resposta de saveService, que decideix si el canvi és vàlid.
export function guardarServicio(servicio: ServicioAdministrable) {
    // El formulari utilitza id, però el contracte del servidor espera serviceId. Enviem el mateix valor amb aquell nom.
    return llamar("saveService", { ...servicio, serviceId: servicio.id });
}
// Enviar la zona horària i els set dies de l’horari.
// Rep timezone i els set days amb les seves franges.
// Retorna la resposta de saveSchedule; un error no significa que l’horari s’hagi guardat.
export function guardarHorario(datos: ConfiguracionAgenda) {
    return llamar("saveSchedule", datos);
}
// Enviar la data i si la volem tancar o tornar a obrir.
// Rep una data i un booleà: true tanca, false reobre.
// Retorna la resposta de setClosedDay després de comprovar les cites afectades.
export function cerrarDia(dateStr: string, closed: boolean) {
    return llamar("setClosedDay", { dateStr, closed });
}
