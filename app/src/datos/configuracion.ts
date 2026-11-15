// Llegim l’horari habitual, la zona horària i els dies tancats.
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import { obtenerServiciosFirebase } from "./firebase";
import type { ConfiguracionAgenda } from "../modelos/aplicacion";
// Obtenir la connexió a Firestore o avisar si Firebase no està configurat.
function baseDatos() {
    const servicios = obtenerServiciosFirebase();
    if (!servicios) {
        throw new Error("Firebase no està configurat.");
    }
    return servicios.baseDatos;
}
// Llegir l’horari i la zona horària desats a config/app.
export async function obtenerConfiguracionAgenda(): Promise<ConfiguracionAgenda> {
    const documento = await getDoc(doc(baseDatos(), "config", "app"));
    if (!documento.exists()) {
        return { timezone: "Europe/Madrid", days: Array.from({ length: 7 }, () => ({ active: false, ranges: [] })) };
    }
    const datos = documento.data();
    if (!Array.isArray(datos.days) || datos.days.length !== 7) {
        throw new Error("L’horari anterior necessita una revisió de l’administrador.");
    }
    new Intl.DateTimeFormat("es", { timeZone: datos.timezone }).format();
    return { timezone: datos.timezone, days: datos.days, professionalName: String(datos.professionalName || "Professional principal") };
}
// Carregar i ordenar les dates en què la barberia està tancada.
export async function obtenerDiasCerrados(): Promise<string[]> {
    return (await getDocs(collection(baseDatos(), "closedDays"))).docs.map(d => d.id).sort();
}
