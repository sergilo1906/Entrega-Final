// Llegim l’horari habitual, la zona horària i els dies tancats.
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import { obtenerServiciosFirebase } from "./firebase";
import type { ConfiguracionAgenda } from "../modelos/aplicacion";
// Obtenir la connexió a Firestore o avisar si Firebase no està configurat.
// No rep paràmetres: utilitza la configuració compartida de Firebase.
// Retorna Firestore o llança un error si la connexió no està preparada.
function baseDatos() {
    const servicios = obtenerServiciosFirebase();
    if (!servicios) {
        throw new Error("Firebase no està configurat.");
    }
    return servicios.baseDatos;
}
// Llegir l’horari i la zona horària desats a config/app.
// No rep paràmetres: llegeix la configuració que necessita la pantalla.
// Retorna zona, set dies i nom del professional si està configurat; sense document mostra dies tancats.
export async function obtenerConfiguracionAgenda(): Promise<ConfiguracionAgenda> {
    const documento = await getDoc(doc(baseDatos(), "config", "app"));
    // Sense document de configuració no inventem hores obertes: la pantalla rep els set dies tancats.
    if (!documento.exists()) {
        return { timezone: "Europe/Madrid", days: Array.from({ length: 7 }, () => ({ active: false, ranges: [] })) };
    }
    const datos = documento.data();
    // Un horari antic amb una altra forma s’ha de revisar, no es transforma silenciosament.
    if (!Array.isArray(datos.days) || datos.days.length !== 7) {
        throw new Error("L’horari anterior necessita una revisió de l’administrador.");
    }
    // Aquesta crida també comprova que el nom de zona sigui reconegut pel navegador.
    new Intl.DateTimeFormat("es", { timeZone: datos.timezone }).format();
    return { timezone: datos.timezone, days: datos.days, professionalName: String(datos.professionalName || "Professional principal") };
}
// Carregar i ordenar les dates en què la barberia està tancada.
// No rep paràmetres: llegeix la col·lecció closedDays.
// Retorna una llista ordenada de dates amb què s’omple el llistat de tancaments.
export async function obtenerDiasCerrados(): Promise<string[]> {
    return (await getDocs(collection(baseDatos(), "closedDays"))).docs.map(d => d.id).sort();
}
