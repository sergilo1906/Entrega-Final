import { doc, onSnapshot, runTransaction, serverTimestamp, updateDoc } from "firebase/firestore";
import { obtenerServiciosFirebase } from "./firebase";
import type { PerfilUsuario } from "../modelos/cuentas";
function referenciaPerfil(uid: string) {
    const servicios = obtenerServiciosFirebase();
    if (!servicios) {
        throw new Error("Firebase no està configurat.");
    }
    return doc(servicios.baseDatos, "users", uid);
}
// Escoltem els canvis de contacte i permisos del compte actual.
export function observarPerfilUsuario(uid: string, recibir: (perfil: PerfilUsuario | null) => void, fallar: () => void) {
    return onSnapshot(referenciaPerfil(uid), (documento) => {
        recibir(documento.exists() ? documento.data() as PerfilUsuario : null);
    }, fallar);
}
export async function crearPerfilUsuario(uid: string, correo: string, nombre: string, telefono: string): Promise<void> {
    const referencia = referenciaPerfil(uid);
    // Recuperar una alta incompleta no sobreescriu el perfil ni els permisos.
    await runTransaction(referencia.firestore, async (transaccion) => {
        const documento = await transaccion.get(referencia);
        if (!documento.exists()) {
            transaccion.set(referencia, {
                name: nombre.trim(), phone: telefono.trim(), email: correo,
                role: "client", roleVersion: 0, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
            });
        }
    });
}
// Desem només el contacte; les regles impedeixen canviar el rol.
export async function guardarPerfilUsuario(uid: string, nombre: string, telefono: string): Promise<void> {
    await updateDoc(referenciaPerfil(uid), {
        name: nombre.trim(), phone: telefono.trim(), updatedAt: serverTimestamp(),
    });
}
