// Rebem la petició de la web, comprovem qui la fa i cridem el codi que modifica la cita.
import { onCall } from "firebase-functions/v2/https";
import { comprobarSesion, comprobarAdministrador } from "./permisos.js";
import { crearReserva, cambiarEstado } from "./persistencia-reservas.js";
// Comprovar la sessió i passar la sol·licitud a la funció que crea la reserva.
export const createBooking = onCall(async (peticion) => crearReserva(await comprobarSesion(peticion, true), peticion.data));
// Comprovar la sessió i demanar el canvi a cancel·lada.
export const cancelBooking = onCall(async (peticion) => cambiarEstado(await comprobarSesion(peticion, true), peticion.data, "cancelled"));
// Comprovar que sigui administrador i demanar el canvi a completada.
export const completeBooking = onCall(async (peticion) => cambiarEstado(await comprobarAdministrador(peticion), peticion.data, "done"));
