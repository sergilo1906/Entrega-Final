// Llegim cites de Firestore: les d’un client o les d’un dia de l’agenda.
import { collection, getDocs, query, where, type QueryConstraint } from "firebase/firestore";
import { obtenerServiciosFirebase } from "./firebase";
import type { Cita } from "../modelos/agenda";
// Llegir les cites que compleixen el filtre i ordenar-les per data i hora.
async function consultarCitas(condicion: QueryConstraint): Promise<Cita[]> {
    const servicios = obtenerServiciosFirebase();
    if (!servicios) {
        throw new Error("Firebase no està configurat.");
    }
    const documentos = await getDocs(query(collection(servicios.baseDatos, "bookings"), condicion));
    // Passem els documents a una llista de cites i les ordenem per mostrar-les.
    return documentos.docs.map(documento => ({ ...documento.data(), id: documento.id } as Cita))
        .sort((a, b) => (a.dateStr + a.timeStr).localeCompare(b.dateStr + b.timeStr));
}
// Buscar només les cites que tenen aquest usuari com a propietari.
export function obtenerCitasUsuario(uid: string) {
    return consultarCitas(where("userId", "==", uid));
}
// Buscar les cites d’una data per mostrar-les a l’agenda.
export function obtenerCitasDia(fecha: string) {
    return consultarCitas(where("dateStr", "==", fecha));
}
