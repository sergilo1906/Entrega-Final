// Controlem qui ha entrat i avisem les pantalles quan canvia el compte o es tanca la sessió.
import { applyActionCode, createUserWithEmailAndPassword, getIdTokenResult, onIdTokenChanged, reload, sendEmailVerification, signInWithEmailAndPassword, signOut, updateProfile, type User, } from "firebase/auth";
import { obtenerServiciosFirebase } from "./firebase";
import { crearPerfilUsuario, observarPerfilUsuario } from "./personas";
import type { EstadoSesion, Rol } from "../modelos/cuentas";
// Estat actual que comparteixen les pantalles: carregant, convidat, autenticat o error.
let estadoSesion: EstadoSesion = {
    estado: "cargando", usuario: null, perfil: null, errorPerfil: false, mensaje: ""
};
// Guardem les funcions de les pantalles que volen rebre els canvis de sessió.
const suscriptores = new Set<(estado: EstadoSesion) => void>();
let iniciado = false;
// Augmentem aquest número en canviar de sessió per descartar respostes del compte anterior.
let revisionSesion = 0;
let cancelarPerfil: (() => void) | null = null;
let actualizacion: Promise<void> | null = null;
let ultimoCambioPermisos = "";
// Acceptar client o admin i retornar null si el rol no es reconeix.
export function normalizarRol(valor: unknown): Rol | null {
    // Els comptes normals poden no tenir rol al token; en aquest cas són clients.
    if (valor === undefined) {
        return "client";
    }
    if (valor === "client" || valor === "admin") {
        return valor;
    }
    return null;
}
// Guardar com està la sessió i avisar totes les pantalles que l’estan escoltant.
function publicarEstado(estado: EstadoSesion): void {
    estadoSesion = estado;
    for (const recibir of suscriptores) {
        recibir(estadoSesion);
    }
}
// Preparar un estat de sessió sense dades de cap compte.
function estadoVacio(estado: EstadoSesion["estado"], mensaje = ""): EstadoSesion {
    return {
        estado, usuario: null, perfil: null, errorPerfil: false, mensaje
    };
}
// Treure de la pestanya les dades temporals que són d’aquesta aplicació.
function limpiarDatosTemporalesSesion(): void {
    try {
        // Netegem només les dades temporals d’aquesta aplicació.
        // Anem del final al principi perquè esborrar una clau no ens faci saltar la següent.
        for (let indice = sessionStorage.length - 1; indice >= 0; indice--) {
            const clave = sessionStorage.key(indice);
            if (clave?.startsWith("barberpro-")) {
                sessionStorage.removeItem(clave);
            }
        }
    }
    catch { /* També podem sortir si l’emmagatzematge està desactivat. */
    }
}
// Obtenir Firebase o parar amb un error si no està configurat.
function exigirServicios() {
    const servicios = obtenerServiciosFirebase();
    if (!servicios) {
        throw new Error("Firebase no està configurat.");
    }
    return servicios;
}
// Carregar la sessió i comprovar que els permisos coincideixin amb el perfil.
async function cargarUsuario(usuario: User | null): Promise<void> {
    // Ens quedem el número d’aquesta càrrega per saber si després encara és la vigent.
    const revision = ++revisionSesion;
    cancelarPerfil?.();
    cancelarPerfil = null;
    publicarEstado(estadoVacio("cargando"));
    if (!usuario) {
        limpiarDatosTemporalesSesion();
        publicarEstado(estadoVacio("invitado"));
        return;
    }
    try {
        // await espera que Firebase retorni el comprovant de sessió i els permisos.
        const token = await getIdTokenResult(usuario);
        if (revision !== revisionSesion) {
            return;
        }
        const rol = normalizarRol(token.claims.role);
        if (!rol) {
            throw new Error("El rol no es reconeix.");
        }
        const usuarioSesion = {
            uid: usuario.uid, correo: usuario.email || "", correoVerificado: usuario.emailVerified,
            nombre: usuario.displayName || "", rol, versionRol: Number(token.claims.roleVersion || 0),
        };
        // Escoltem només el perfil actual i descartem respostes d’una altra sessió.
        cancelarPerfil = observarPerfilUsuario(usuario.uid, (perfil) => {
            if (revision !== revisionSesion) {
                return;
            }
            // Un administrador necessita un perfil coherent; no li donem accés si falta.
            if (!perfil && rol !== "client") {
                publicarEstado(estadoVacio("error", "No s’han pogut confirmar els permisos. Contacta amb l’administrador."));
                return;
            }
            // Si els permisos han canviat, parem de mostrar dades fins que la sessió s’actualitzi.
            if (perfil && (perfil.role !== rol || (perfil.roleVersion || 0) !== usuarioSesion.versionRol)) {
                publicarEstado(estadoVacio("error", "Els permisos han canviat. Actualitza la pàgina o torna a iniciar sessió."));
                const cambioPermisos = usuario.uid + ":" + perfil.role + ":" + (perfil.roleVersion || 0);
                if (ultimoCambioPermisos !== cambioPermisos) {
                    ultimoCambioPermisos = cambioPermisos;
                    void actualizarUsuarioSesion().catch(() => {
                    });
                }
                return;
            }
            publicarEstado({
                estado: "autenticado", usuario: usuarioSesion, perfil, errorPerfil: false, mensaje: ""
            });
        }, () => {
            if (revision !== revisionSesion) {
                return;
            }
            // Un error en carregar el perfil no dona permisos d’administració.
            if (rol !== "client") {
                publicarEstado(estadoVacio("error", "No s’han pogut comprovar els permisos. Torna a iniciar sessió."));
            }
            else {
                publicarEstado({
                    estado: "autenticado", usuario: usuarioSesion, perfil: null, errorPerfil: true, mensaje: "No s’han pogut carregar les teves dades."
                });
            }
        });
    }
    catch {
        if (revision === revisionSesion) {
            publicarEstado(estadoVacio("error", "No s’ha pogut comprovar la sessió. Torna a iniciar sessió."));
        }
    }
}
// Començar a escoltar els canvis d’Auth, però només una vegada.
function iniciarObservacion(): void {
    if (iniciado) {
        return;
    }
    iniciado = true;
    try {
        const servicios = obtenerServiciosFirebase();
        if (!servicios) {
            publicarEstado(estadoVacio("desactivado", "L’accés no està configurat. Revisa la configuració de l’aplicació."));
            return;
        }
        // Firebase ens avisa quan entra/surt un compte o es renova el seu token.
        onIdTokenChanged(servicios.autenticacion, (usuario) => {
            void cargarUsuario(usuario);
        }, () => {
            revisionSesion++;
            cancelarPerfil?.();
            publicarEstado(estadoVacio("error", "No s’ha pogut comprovar la sessió. Torna a iniciar sessió."));
        });
        // Quan tornem a la finestra, comprovem si els permisos han canviat.
        window.addEventListener("focus", () => {
            void actualizarUsuarioSesion().catch(() => {
            });
        });
        // Si el navegador recupera una pantalla antiga de l’historial, la tornem a carregar.
        window.addEventListener("pageshow", (evento) => {
            if (evento.persisted) {
                window.location.reload();
            }
        });
    }
    catch {
        publicarEstado(estadoVacio("error", "No s’ha pogut preparar l’accés. Revisa la configuració."));
    }
}
// Afegir una pantalla a la llista que avisem quan canvia la sessió.
export function observarSesion(recibir: (estado: EstadoSesion) => void): () => void {
    suscriptores.add(recibir);
    recibir(estadoSesion);
    iniciarObservacion();
    return () => {
        suscriptores.delete(recibir);
    };
}
// Retornar l’estat de sessió que tenim guardat en memòria.
export function obtenerUsuarioActual(): EstadoSesion {
    return estadoSesion;
}
// Esperar que acabi la càrrega abans de fer servir les dades del compte.
export function esperarEstadoSesion(): Promise<EstadoSesion> {
    iniciarObservacion();
    if (estadoSesion.estado !== "cargando") {
        return Promise.resolve(estadoSesion);
    }
    return new Promise((resolver) => {
        // Quan la sessió ja ha carregat, retornar-la i deixar d’esperar més canvis.
        const recibir = (estado: EstadoSesion) => {
            if (estado.estado !== "cargando") {
                suscriptores.delete(recibir);
                resolver(estado);
            }
        };
        suscriptores.add(recibir);
    });
}
// Entrar amb correu i contrasenya i carregar els permisos actuals.
export async function iniciarSesion(correo: string, contrasena: string): Promise<void> {
    await signInWithEmailAndPassword(exigirServicios().autenticacion, correo, contrasena);
    await actualizarUsuarioSesion();
}
// Crear el compte, el perfil i enviar la verificació; indicar quin pas ha fallat.
export async function registrarUsuario(correo: string, contrasena: string, nombre: string, telefono: string) {
    // Primer creem el compte d’Auth; després guardarem el nom i el perfil.
    const credencial = await createUserWithEmailAndPassword(exigirServicios().autenticacion, correo, contrasena);
    try {
        await updateProfile(credencial.user, { displayName: nombre.trim() });
        await crearPerfilUsuario(credencial.user.uid, credencial.user.email || correo, nombre, telefono);
    }
    catch {
        // El compte pot haver-se creat encara que el perfil falli; la pantalla permet completar-lo.
        return { perfilCreado: false, correoEnviado: false };
    }
    try {
        await enviarVerificacion();
        return { perfilCreado: true, correoEnviado: true };
    }
    catch {
        // No diem que s’ha enviat el correu si Firebase ha retornat un error.
        return { perfilCreado: true, correoEnviado: false };
    }
}
// Tornar a consultar el compte i els permisos sense repetir una càrrega que ja està en marxa.
export async function actualizarUsuarioSesion(): Promise<void> {
    // Si ja estem actualitzant la sessió, esperem aquella mateixa operació.
    if (actualizacion) {
        return actualizacion;
    }
    actualizacion = (async () => {
        const usuario = exigirServicios().autenticacion.currentUser;
        if (!usuario) {
            return;
        }
        try {
            await reload(usuario);
            await getIdTokenResult(usuario, true);
        }
        catch (error) {
            revisionSesion++;
            cancelarPerfil?.();
            publicarEstado(estadoVacio("error", "No s’ha pogut actualitzar la sessió. Torna a iniciar sessió."));
            throw error;
        }
        // Només apliquem el resultat si seguim amb el compte que havia començat la càrrega.
        if (exigirServicios().autenticacion.currentUser?.uid === usuario.uid) {
            await cargarUsuario(usuario);
        }
    })().finally(() => {
        actualizacion = null;
    });
    return actualizacion;
}
// Buidar les dades del compte i demanar a Firebase que tanqui la sessió.
export async function cerrarSesion(): Promise<void> {
    // Buidem les dades abans d’esperar la xarxa perquè no quedin visibles.
    revisionSesion++;
    cancelarPerfil?.();
    limpiarDatosTemporalesSesion();
    publicarEstado(estadoVacio("cargando"));
    try {
        await signOut(exigirServicios().autenticacion);
        publicarEstado(estadoVacio("invitado"));
    }
    catch (error) {
        publicarEstado(estadoVacio("error", "No s’ha pogut tancar la sessió. Torna-ho a provar."));
        throw error;
    }
}
// Retornar l’adreça de verificació de la mateixa web que tenim oberta.
export function obtenerUrlVerificacion(): string {
    return window.location.origin + "/verify";
}
// Enviar el correu de verificació al compte que ha iniciat sessió.
export async function enviarVerificacion(): Promise<void> {
    const usuario = exigirServicios().autenticacion.currentUser;
    if (!usuario) {
        throw new Error("Cal iniciar sessió.");
    }
    await sendEmailVerification(usuario, { url: obtenerUrlVerificacion(), handleCodeInApp: false });
}
// Aplicar el codi del correu i actualitzar la sessió amb el resultat.
export async function aplicarVerificacion(codigo: string): Promise<void> {
    await applyActionCode(exigirServicios().autenticacion, codigo);
    await actualizarUsuarioSesion();
}
