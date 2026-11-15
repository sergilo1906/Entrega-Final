// Llegim i guardem el perfil del compte actual, sense permetre que canviï el seu propi rol.
import { doc, onSnapshot, runTransaction, serverTimestamp, updateDoc } from "firebase/firestore";
import { obtenerServiciosFirebase } from "./firebase";
import type { PerfilUsuario } from "../modelos/cuentas";
// Preparar el camí del perfil d’aquest usuari a Firestore.
function referenciaPerfil(uid: string) {
    const servicios = obtenerServiciosFirebase();
    if (!servicios) {
        throw new Error("Firebase no està configurat.");
    }
    return doc(servicios.baseDatos, "users", uid);
}
// Rebre el perfil actual i els canvis que s’hi facin després.
export function observarPerfilUsuario(uid: string, recibir: (perfil: PerfilUsuario | null) => void, fallar: () => void) {
    // onSnapshot envia el perfil inicial i torna a avisar si el document canvia.
    return onSnapshot(referenciaPerfil(uid), (documento) => {
        recibir(documento.exists() ? documento.data() as PerfilUsuario : null);
    }, fallar);
}
// Crear el perfil només si falta; si ja existeix, no sobreescriure’l.
export async function crearPerfilUsuario(uid: string, correo: string, nombre: string, telefono: string): Promise<void> {
    const referencia = referenciaPerfil(uid);
    // Recuperar una alta incompleta no sobreescriu el perfil ni els permisos.
    await runTransaction(referencia.firestore, async (transaccion) => {
        const documento = await transaccion.get(referencia);
        // Només creem un perfil client si no existia; no toquem un rol que ja estigui assignat.
        if (!documento.exists()) {
            transaccion.set(referencia, {
                name: nombre.trim(), phone: telefono.trim(), email: correo,
                role: "client", roleVersion: 0, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
            });
        }
    });
}
// Guardar el nom i el telèfon del perfil, sense modificar el rol.
export async function guardarPerfilUsuario(uid: string, nombre: string, telefono: string): Promise<void> {
    await updateDoc(referenciaPerfil(uid), {
        name: nombre.trim(), phone: telefono.trim(), updatedAt: serverTimestamp(),
    });
}
