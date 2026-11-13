import { HttpsError } from "firebase-functions/v2/https";
import { obtenerServiciosAdministrativos } from "./firebase.js";
export const ROLES = ["client", "admin"];
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
export function comprobarUid(uid) {
    if (typeof uid !== "string" || uid.length < 1 || uid.length > 128 || /[\s/\u0000-\u001f]/.test(uid)) {
        throw new HttpsError("invalid-argument", "L’identificador no és vàlid.");
    }
    return uid;
}
// Comparem el token amb el compte i el perfil per descartar permisos antics.
export async function comprobarSesion(peticion, correoObligatorio = false) {
    if (!peticion.auth?.uid) {
        throw new HttpsError("unauthenticated", "Inicia sessió per continuar.");
    }
    if (typeof peticion.auth.token.exp !== "number" || peticion.auth.token.exp <= Date.now() / 1000) {
        throw new HttpsError("unauthenticated", "La sessió ha caducat. Torna a iniciar sessió.");
    }
    const { autenticacion, baseDatos } = obtenerServiciosAdministrativos();
    let usuario;
    try {
        usuario = await autenticacion.getUser(peticion.auth.uid);
    }
    catch {
        throw new HttpsError("unauthenticated", "La sessió ja no és vàlida.");
    }
    if (usuario.disabled) {
        throw new HttpsError("unauthenticated", "La sessió ja no és vàlida.");
    }
    const instanteValido = Math.floor(Date.parse(usuario.tokensValidAfterTime || "1970-01-01") / 1000);
    if (Number(peticion.auth.token.auth_time || 0) < instanteValido) {
        throw new HttpsError("unauthenticated", "Torna a iniciar sessió.");
    }
    if (correoObligatorio && (!usuario.emailVerified || peticion.auth.token.email_verified !== true)) {
        throw new HttpsError("permission-denied", "Verifica el correu per continuar.");
    }
    const rol = usuario.customClaims?.role || "client";
    const version = usuario.customClaims?.roleVersion || 0;
    if (!ROLES.includes(rol) || (peticion.auth.token.role || "client") !== rol
        || (peticion.auth.token.roleVersion || 0) !== version) {
        throw new HttpsError("permission-denied", "Els permisos han canviat. Actualitza la sessió.");
    }
    const perfil = await baseDatos.doc("users/" + usuario.uid).get();
    if ((perfil.exists && (perfil.get("role") !== rol || (perfil.get("roleVersion") || 0) !== version))
        || (!perfil.exists && rol !== "client")) {
        throw new HttpsError("permission-denied", "No s’han pogut confirmar els permisos.");
    }
    return {
        usuario, rol, version
    };
}
// La gestió demana un administrador amb el correu verificat.
export async function comprobarAdministrador(peticion) {
    const identidad = await comprobarSesion(peticion, true);
    if (identidad.rol !== "admin") {
        throw new HttpsError("permission-denied", "Accés denegat.");
    }
    return identidad;
}
// Tornem a llegir el perfil dins la transacció per si han canviat els permisos.
export async function comprobarIdentidadTransaccion(transaccion, baseDatos, identidad) {
    const perfil = await transaccion.get(baseDatos.doc("users/" + identidad.usuario.uid));
    if ((perfil.exists && (perfil.get("role") !== identidad.rol || (perfil.get("roleVersion") || 0) !== identidad.version)) || (!perfil.exists && identidad.rol !== "client")) {
        throw new HttpsError("permission-denied", "Els permisos han canviat. Actualitza la sessió.");
    }
    return perfil.data() || {};
}
