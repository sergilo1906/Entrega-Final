// Funcions que envien les dades del navegador al servidor. El servidor decideix si pot fer el canvi.
import { httpsCallable } from "firebase/functions";
import { obtenerServiciosFirebase } from "./firebase";
import type { HuecoDisponible, SolicitudReserva, ResultadoReserva, ServicioAdministrable } from "../modelos/agenda";
import type { ConfiguracionAgenda } from "../modelos/aplicacion";
// Enviar les dades a una funció del servidor i esperar-ne la resposta.
async function llamar<Entrada, Salida>(nombre: string, datos: Entrada): Promise<Salida> {
    const servicios = obtenerServiciosFirebase();
    if (!servicios) {
        throw new Error("Firebase no està configurat.");
    }
    return (await httpsCallable<Entrada, Salida>(servicios.funcionesRemotas, nombre)(datos)).data;
}
// Demanar al servidor quines hores queden lliures per al servei i la data.
export function consultarDisponibilidad(datos: Pick<SolicitudReserva, "dateStr" | "serviceId">) {
    return llamar<typeof datos, {
        slots: HuecoDisponible[];
    }>("getAvailability", datos);
}
// Enviar servei, data, hora i identificador de sol·licitud per confirmar la cita.
export function solicitarReserva(datos: SolicitudReserva) {
    return llamar<SolicitudReserva, ResultadoReserva>("createBooking", datos);
}
// Demanar al servidor que cancel·li la cita indicada.
export function cancelarReserva(bookingId: string) {
    return llamar("cancelBooking", { bookingId });
}
// Demanar que la cita passi a completada; el servidor exigeix administrador.
export function completarReserva(bookingId: string) {
    return llamar("completeBooking", { bookingId });
}
// Enviar els camps del servei perquè el servidor els comprovi i els guardi.
export function guardarServicio(servicio: ServicioAdministrable) {
    return llamar("saveService", { ...servicio, serviceId: servicio.id });
}
// Enviar la zona horària i els set dies de l’horari.
export function guardarHorario(datos: ConfiguracionAgenda) {
    return llamar("saveSchedule", datos);
}
// Enviar la data i si la volem tancar o tornar a obrir.
export function cerrarDia(dateStr: string, closed: boolean) {
    return llamar("setClosedDay", { dateStr, closed });
}
