// Un token és el comprovant de sessió que envia Firebase. El comparem amb el compte i el perfil actuals.
import { HttpsError } from "firebase-functions/v2/https";
import { obtenerServiciosAdministrativos } from "./firebase.js";
export const ROLES = ["client", "admin"];
// Acceptar només els rols de l’aplicació i rebutjar els antics.
export function normalizarRolEntrada(valor) {
    if (typeof valor !== "string") {
        throw new HttpsError("invalid-argument", "El rol no és vàlid.");
    }
    const rol = valor.trim().toLowerCase();
    if (rol === "cliente") {
        return "client";
    }
    if (!ROLES.includes(rol)) {
        throw new HttpsError("invalid-argument", "El rol no és vàlid.");
    }
    return rol;
}
// Comprovar que l’identificador es pugui posar al camí d’un document.
export function comprobarUid(uid) {
    if (typeof uid !== "string" || uid.length < 1 || uid.length > 128 || /[\s/\u0000-\u001f]/.test(uid)) {
        throw new HttpsError("invalid-argument", "L’identificador no és vàlid.");
    }
    return uid;
}
// Comprovar el compte actual, el correu i els permisos abans de fer l’operació.
export async function comprobarSesion(peticion, correoObligatorio = false) {
    if (!peticion.auth?.uid) {
        throw new HttpsError("unauthenticated", "Inicia sessió per continuar.");
    }
    // exp està en segons; Date.now() en mil·lisegons, per això dividim entre 1000.
    if (typeof peticion.auth.token.exp !== "number" || peticion.auth.token.exp <= Date.now() / 1000) {
        throw new HttpsError("unauthenticated", "La sessió ha caducat. Torna a iniciar sessió.");
    }
    const { autenticacion, baseDatos } = obtenerServiciosAdministrativos();
    let usuario;
    try {
        // Llegim el compte actual d’Auth, en lloc de confiar només en un token antic.
        usuario = await autenticacion.getUser(peticion.auth.uid);
    }
    catch {
        throw new HttpsError("unauthenticated", "La sessió ja no és vàlida.");
    }
    // Un compte deshabilitat no pot continuar encara que abans hagués iniciat sessió.
    if (usuario.disabled) {
        throw new HttpsError("unauthenticated", "La sessió ja no és vàlida.");
    }
    // Si s’han invalidat sessions, comprovem que aquesta s’hagi iniciat després.
    const instanteValido = Math.floor(Date.parse(usuario.tokensValidAfterTime || "1970-01-01") / 1000);
    if (Number(peticion.auth.token.auth_time || 0) < instanteValido) {
        throw new HttpsError("unauthenticated", "Torna a iniciar sessió.");
    }
    if (correoObligatorio && (!usuario.emailVerified || peticion.auth.token.email_verified !== true)) {
        throw new HttpsError("permission-denied", "Verifica el correu per continuar.");
    }
    // Els claims són permisos guardats a Auth. Si no hi ha rol, el compte és client.
    const rol = usuario.customClaims?.role || "client";
    // La versió és un número que canvia quan s’assigna un rol, per detectar permisos antics.
    const version = usuario.customClaims?.roleVersion || 0;
    // El rol i la versió del token han de coincidir amb els que el compte té ara.
    if (!ROLES.includes(rol) || (peticion.auth.token.role || "client") !== rol
        || (peticion.auth.token.roleVersion || 0) !== version) {
        throw new HttpsError("permission-denied", "Els permisos han canviat. Actualitza la sessió.");
    }
    // Contrastem també el perfil de Firestore abans de donar els permisos per vàlids.
    const perfil = await baseDatos.doc("users/" + usuario.uid).get();
    if ((perfil.exists && (perfil.get("role") !== rol || (perfil.get("roleVersion") || 0) !== version))
        || (!perfil.exists && rol !== "client")) {
        throw new HttpsError("permission-denied", "No s’han pogut confirmar els permisos.");
    }
    return {
        usuario, rol, version
    };
}
// Fer les comprovacions de sessió i exigir també el rol admin.
export async function comprobarAdministrador(peticion) {
    const identidad = await comprobarSesion(peticion, true);
    if (identidad.rol !== "admin") {
        throw new HttpsError("permission-denied", "Accés denegat.");
    }
    return identidad;
}
// Tornar a llegir els permisos mentre fem la transacció, per si acaben de canviar.
export async function comprobarIdentidadTransaccion(transaccion, baseDatos, identidad) {
    const perfil = await transaccion.get(baseDatos.doc("users/" + identidad.usuario.uid));
    if ((perfil.exists && (perfil.get("role") !== identidad.rol || (perfil.get("roleVersion") || 0) !== identidad.version)) || (!perfil.exists && identidad.rol !== "client")) {
        throw new HttpsError("permission-denied", "Els permisos han canviat. Actualitza la sessió.");
    }
    return perfil.data() || {};
}
