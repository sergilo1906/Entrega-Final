// Un token és el comprovant de sessió que envia Firebase. El comparem amb el compte i el perfil actuals.
import { HttpsError } from "firebase-functions/v2/https";
import { obtenerServiciosAdministrativos } from "./firebase.js";
export const ROLES = ["client", "admin"];
// Acceptar només els rols de l’aplicació i rebutjar els antics.
// Rep el rol escrit a l’eina privada, que pot portar espais o majúscules.
// Retorna client/admin; l’àlies cliente també dona client, però els rols antics es rebutgen.
export function normalizarRolEntrada(valor) {
    // No convertim automàticament números ni altres objectes en noms de rol.
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
// Rep l’identificador que utilitzarem en un camí de Firestore.
// Retorna el mateix identificador si compleix longitud i caràcters permesos.
export function comprobarUid(uid) {
    // Un espai, una barra o un caràcter de control no s’accepta dins aquest identificador.
    if (typeof uid !== "string" || uid.length < 1 || uid.length > 128 || /[\s/\u0000-\u001f]/.test(uid)) {
        throw new HttpsError("invalid-argument", "L’identificador no és vàlid.");
    }
    return uid;
}
// Comprovar el compte actual, el correu i els permisos abans de fer l’operació.
// Rep la petició callable i si és obligatori tenir el correu verificat.
// Retorna el compte actual, el rol i la versió després de comparar Auth, token i perfil.
export async function comprobarSesion(peticion, correoObligatorio = false) {
    // Sense identitat adjuntada per Firebase, la petició no pot consultar ni modificar negoci.
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
    // Exigim que tant el compte actual com el token indiquin correu verificat.
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
    // Si Auth i el perfil no coincideixen, no triem la versió més permissiva: deneguem l’operació.
    if ((perfil.exists && (perfil.get("role") !== rol || (perfil.get("roleVersion") || 0) !== version))
        || (!perfil.exists && rol !== "client")) {
        throw new HttpsError("permission-denied", "No s’han pogut confirmar els permisos.");
    }
    return {
        usuario, rol, version
    };
}
// Fer les comprovacions de sessió i exigir també el rol admin.
// Rep la petició que vol fer una operació de gestió.
// Retorna la identitat autoritzada només si és administrador i té el correu verificat.
export async function comprobarAdministrador(peticion) {
    const identidad = await comprobarSesion(peticion, true);
    // Un client verificat continua sense permís per modificar serveis, horaris o cites d’altres persones.
    if (identidad.rol !== "admin") {
        throw new HttpsError("permission-denied", "Accés denegat.");
    }
    return identidad;
}
// Tornar a llegir els permisos mentre fem la transacció, per si acaben de canviar.
// Rep la transacció, Firestore i la identitat que s’havia comprovat abans.
// Retorna les dades del perfil si els permisos encara coincideixen, o falla la transacció.
export async function comprobarIdentidadTransaccion(transaccion, baseDatos, identidad) {
    const perfil = await transaccion.get(baseDatos.doc("users/" + identidad.usuario.uid));
    if ((perfil.exists && (perfil.get("role") !== identidad.rol || (perfil.get("roleVersion") || 0) !== identidad.version)) || (!perfil.exists && identidad.rol !== "client")) {
        throw new HttpsError("permission-denied", "Els permisos han canviat. Actualitza la sessió.");
    }
    return perfil.data() || {};
}
