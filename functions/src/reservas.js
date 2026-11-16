// Rebem la petició de la web, comprovem qui la fa i cridem el codi que modifica la cita.
import { onCall } from "firebase-functions/v2/https";
import { comprobarSesion, comprobarAdministrador } from "./permisos.js";
import { crearReserva, cambiarEstado } from "./persistencia-reservas.js";
// Comprovar la sessió i passar la sol·licitud a la funció que crea la reserva.
// Rep una petició autenticada amb les dades de la reserva.
// Retorna el resultat de crearReserva després d’exigir compte i correu verificat.
export const createBooking = onCall(async (peticion) => crearReserva(await comprobarSesion(peticion, true), peticion.data));
// Comprovar la sessió i demanar el canvi a cancel·lada.
// Rep una petició autenticada amb el bookingId.
// Retorna el resultat de canviar l’estat a cancelled, si la identitat hi té permís.
export const cancelBooking = onCall(async (peticion) => cambiarEstado(await comprobarSesion(peticion, true), peticion.data, "cancelled"));
// Comprovar que sigui administrador i demanar el canvi a completada.
// Rep una petició administrativa amb el bookingId.
// Retorna el resultat de canviar l’estat a done, mantenint l’ocupació.
export const completeBooking = onCall(async (peticion) => cambiarEstado(await comprobarAdministrador(peticion), peticion.data, "done"));
