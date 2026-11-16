// Carreguem els serveis que es poden reservar i el catàleg que pot editar l’administrador.
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { obtenerServiciosFirebase } from "./firebase";
import type { Servicio, ServicioAdministrable } from "../modelos/agenda";
// Carregar els serveis actius que tenen una durada vàlida per reservar.
// No rep paràmetres: consulta els serveis actius del projecte configurat.
// Retorna els serveis amb preu i durada vàlids, ordenats pel nom.
export async function obtenerServicios(): Promise<Servicio[]> {
    const servicios = obtenerServiciosFirebase();
    if (!servicios) {
        throw new Error("Firebase no està configurat.");
    }
    // El client només consulta serveis amb active igual a true.
    const documentos = await getDocs(query(collection(servicios.baseDatos, "services"), where("active", "==", true)));
    const resultado: Servicio[] = [];
    for (const documento of documentos.docs) {
        const datos = documento.data();
        // ?? posa un valor per defecte quan el camp falta; després igualment comprovem que la durada sigui vàlida.
        const duracion = Number(datos.durationMin ?? 30);
        const precio = Number(datos.price ?? 0);
        // No oferim serveis amb durades o preus que aquesta versió no pot reservar.
        if (!Number.isInteger(duracion) || ![30, 60].includes(duracion) || !Number.isFinite(precio) || precio < 0) {
            continue;
        }
        resultado.push({
            id: documento.id, name: String(datos.name || "Servei"), durationMin: duracion, price: precio
        });
    }
    // Ordenem els serveis pel nom abans d’omplir el selector.
    resultado.sort((primero, segundo) => primero.name.localeCompare(segundo.name));
    return resultado;
}
// Carregar tots els serveis perquè l’administrador també pugui editar els inactius.
// No rep paràmetres; aquesta lectura l’utilitza la pantalla d’administració.
// Retorna també els serveis inactius perquè es puguin tornar a activar.
export async function obtenerCatalogoCompleto(): Promise<ServicioAdministrable[]> {
    const servicios = obtenerServiciosFirebase();
    if (!servicios) {
        throw new Error("Firebase no està configurat.");
    }
    // L’administrador necessita també els serveis inactius; per això aquesta consulta no filtra per active.
    const documentos = await getDocs(query(collection(servicios.baseDatos, "services"), orderBy("name", "asc")));
    const resultado: ServicioAdministrable[] = [];
    for (const documento of documentos.docs) {
        const datos = documento.data();
        resultado.push({
            id: documento.id, name: String(datos.name || ""), durationMin: Number(datos.durationMin ?? 30), price: Number(datos.price ?? 0), active: datos.active !== false
        });
    }
    return resultado;
}
