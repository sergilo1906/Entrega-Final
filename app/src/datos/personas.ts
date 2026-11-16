// Llegim i guardem el perfil del compte actual, sense permetre que canviï el seu propi rol.
import { doc, onSnapshot, runTransaction, serverTimestamp, updateDoc } from "firebase/firestore";
import { obtenerServiciosFirebase } from "./firebase";
import type { PerfilUsuario } from "../modelos/cuentas";
// Preparar el camí del perfil d’aquest usuari a Firestore.
// Rep el UID del compte del qual volem llegir o editar el perfil.
// Retorna la referència users/UID, encara sense llegir-ne les dades.
function referenciaPerfil(uid: string) {
    const servicios = obtenerServiciosFirebase();
    if (!servicios) {
        throw new Error("Firebase no està configurat.");
    }
    return doc(servicios.baseDatos, "users", uid);
}
// Rebre el perfil actual i els canvis que s’hi facin després.
// Rep el UID i les funcions que rebran el perfil o l’error de lectura.
// Retorna una funció per deixar d’escoltar els canvis del document.
export function observarPerfilUsuario(uid: string, recibir: (perfil: PerfilUsuario | null) => void, fallar: () => void) {
    // onSnapshot envia el perfil inicial i torna a avisar si el document canvia.
    return onSnapshot(referenciaPerfil(uid), (documento) => {
        // Si encara no hi ha perfil, enviem null perquè la pantalla pugui oferir completar-lo.
        recibir(documento.exists() ? documento.data() as PerfilUsuario : null);
    }, fallar);
}
// Crear el perfil només si falta; si ja existeix, no sobreescriure’l.
// Rep UID, correu, nom i telèfon de l’alta.
// La promesa acaba quan el perfil ja existeix; no substitueix un perfil anterior.
export async function crearPerfilUsuario(uid: string, correo: string, nombre: string, telefono: string): Promise<void> {
    const referencia = referenciaPerfil(uid);
    // Recuperar una alta incompleta no sobreescriu el perfil ni els permisos.
    await runTransaction(referencia.firestore, async (transaccion) => {
        // Llegim abans de crear per evitar que dues càrregues d’una alta parcial se sobreescriguin.
        const documento = await transaccion.get(referencia);
        // Només creem un perfil client si no existia; no toquem un rol que ja estigui assignat.
        if (!documento.exists()) {
            transaccion.set(referencia, {
                name: nombre.trim(), phone: telefono.trim(), email: correo,
                // Un compte creat des de la web sempre comença com a client, mai com a administrador.
                role: "client", roleVersion: 0, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
            });
        }
    });
}
// Guardar el nom i el telèfon del perfil, sense modificar el rol.
// Rep el UID i el nou nom i telèfon.
// La promesa acaba després d’actualitzar aquests camps i la data del canvi.
export async function guardarPerfilUsuario(uid: string, nombre: string, telefono: string): Promise<void> {
    await updateDoc(referenciaPerfil(uid), {
        name: nombre.trim(), phone: telefono.trim(), updatedAt: serverTimestamp(),
    });
}
