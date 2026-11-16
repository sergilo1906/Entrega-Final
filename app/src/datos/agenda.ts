// Llegim cites de Firestore: les d’un client o les d’un dia de l’agenda.
import { collection, getDocs, query, where, type QueryConstraint } from "firebase/firestore";
import { obtenerServiciosFirebase } from "./firebase";
import type { Cita } from "../modelos/agenda";
// Llegir les cites que compleixen el filtre i ordenar-les per data i hora.
// Rep una condició de Firestore, com propietari igual a un UID.
// Retorna una promesa amb la llista ordenada de cites que compleixen el filtre.
async function consultarCitas(condicion: QueryConstraint): Promise<Cita[]> {
    const servicios = obtenerServiciosFirebase();
    if (!servicios) {
        throw new Error("Firebase no està configurat.");
    }
    // La consulta ja porta el filtre permès abans de demanar dades; les regles no filtren una lectura general per nosaltres.
    const documentos = await getDocs(query(collection(servicios.baseDatos, "bookings"), condicion));
    // Passem els documents a una llista de cites i les ordenem per mostrar-les.
    return documentos.docs.map(documento => ({ ...documento.data(), id: documento.id } as Cita))
        // Com que any-mes-dia i HH:mm tenen mida fixa, ordenar aquest text també ordena cronològicament.
        .sort((a, b) => (a.dateStr + a.timeStr).localeCompare(b.dateStr + b.timeStr));
}
// Buscar només les cites que tenen aquest usuari com a propietari.
// Rep l’identificador del compte propietari de les cites.
// Retorna la consulta de cites filtrada per userId.
export function obtenerCitasUsuario(uid: string) {
    return consultarCitas(where("userId", "==", uid));
}
// Buscar les cites d’una data per mostrar-les a l’agenda.
// Rep la data que ha triat l’administrador a l’agenda.
// Retorna la consulta de cites filtrada per dateStr.
export function obtenerCitasDia(fecha: string) {
    return consultarCitas(where("dateStr", "==", fecha));
}
