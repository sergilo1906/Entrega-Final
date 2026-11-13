import { onCall } from "firebase-functions/v2/https";
import { comprobarSesion, comprobarAdministrador } from "./permisos.js";
import { crearReserva, cambiarEstado } from "./persistencia-reservas.js";
// Comprovem la identitat abans d’entrar a la transacció.
export const createBooking = onCall(async (peticion) => crearReserva(await comprobarSesion(peticion, true), peticion.data));
export const cancelBooking = onCall(async (peticion) => cambiarEstado(await comprobarSesion(peticion, true), peticion.data, "cancelled"));
export const completeBooking = onCall(async (peticion) => cambiarEstado(await comprobarAdministrador(peticion), peticion.data, "done"));
