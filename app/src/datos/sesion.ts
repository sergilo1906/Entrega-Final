import { applyActionCode, createUserWithEmailAndPassword, getIdTokenResult, onIdTokenChanged, reload, sendEmailVerification, signInWithEmailAndPassword, signOut, updateProfile, type User, } from "firebase/auth";
import { obtenerServiciosFirebase } from "./firebase";
import { crearPerfilUsuario, observarPerfilUsuario } from "./personas";
import type { EstadoSesion, Rol } from "../modelos/cuentas";
let estadoSesion: EstadoSesion = {
    estado: "cargando", usuario: null, perfil: null, errorPerfil: false, mensaje: ""
};
const suscriptores = new Set<(estado: EstadoSesion) => void>();
let iniciado = false;
let revisionSesion = 0;
let cancelarPerfil: (() => void) | null = null;
let actualizacion: Promise<void> | null = null;
let ultimoCambioPermisos = "";
export function normalizarRol(valor: unknown): Rol | null {
    if (valor === undefined) {
        return "client";
    }
    if (valor === "client" || valor === "admin") {
        return valor;
    }
    return null;
}
function publicarEstado(estado: EstadoSesion): void {
    estadoSesion = estado;
    for (const recibir of suscriptores) {
        recibir(estadoSesion);
    }
}
function estadoVacio(estado: EstadoSesion["estado"], mensaje = ""): EstadoSesion {
    return {
        estado, usuario: null, perfil: null, errorPerfil: false, mensaje
    };
}
function limpiarDatosTemporalesSesion(): void {
    try {
        // Netegem només les dades temporals d’aquesta aplicació.
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
function exigirServicios() {
    const servicios = obtenerServiciosFirebase();
    if (!servicios) {
        throw new Error("Firebase no està configurat.");
    }
    return servicios;
}
// Carreguem el token i comprovem que coincideixi amb el perfil actual.
async function cargarUsuario(usuario: User | null): Promise<void> {
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
            if (!perfil && rol !== "client") {
                publicarEstado(estadoVacio("error", "No s’han pogut confirmar els permisos. Contacta amb l’administrador."));
                return;
            }
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
// Escoltem la sessió i la refresquem en tornar a la finestra.
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
        onIdTokenChanged(servicios.autenticacion, (usuario) => {
            void cargarUsuario(usuario);
        }, () => {
            revisionSesion++;
            cancelarPerfil?.();
            publicarEstado(estadoVacio("error", "No s’ha pogut comprovar la sessió. Torna a iniciar sessió."));
        });
        window.addEventListener("focus", () => {
            void actualizarUsuarioSesion().catch(() => {
            });
        });
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
// Avisem cada pantalla quan canvia la sessió.
export function observarSesion(recibir: (estado: EstadoSesion) => void): () => void {
    suscriptores.add(recibir);
    recibir(estadoSesion);
    iniciarObservacion();
    return () => {
        suscriptores.delete(recibir);
    };
}
export function obtenerUsuarioActual(): EstadoSesion {
    return estadoSesion;
}
// Esperem que acabi la càrrega abans de prendre decisions d’accés.
export function esperarEstadoSesion(): Promise<EstadoSesion> {
    iniciarObservacion();
    if (estadoSesion.estado !== "cargando") {
        return Promise.resolve(estadoSesion);
    }
    return new Promise((resolver) => {
        const recibir = (estado: EstadoSesion) => {
            if (estado.estado !== "cargando") {
                suscriptores.delete(recibir);
                resolver(estado);
            }
        };
        suscriptores.add(recibir);
    });
}
// Iniciem sessió amb Auth i actualitzem el token i el perfil.
export async function iniciarSesion(correo: string, contrasena: string): Promise<void> {
    await signInWithEmailAndPassword(exigirServicios().autenticacion, correo, contrasena);
    await actualizarUsuarioSesion();
}
// Creem el compte i distingim una alta parcial d’un correu no enviat.
export async function registrarUsuario(correo: string, contrasena: string, nombre: string, telefono: string) {
    const credencial = await createUserWithEmailAndPassword(exigirServicios().autenticacion, correo, contrasena);
    try {
        await updateProfile(credencial.user, { displayName: nombre.trim() });
        await crearPerfilUsuario(credencial.user.uid, credencial.user.email || correo, nombre, telefono);
    }
    catch {
        return { perfilCreado: false, correoEnviado: false };
    }
    try {
        await enviarVerificacion();
        return { perfilCreado: true, correoEnviado: true };
    }
    catch {
        return { perfilCreado: true, correoEnviado: false };
    }
}
// Refresquem el compte i el token sense encadenar actualitzacions repetides.
export async function actualizarUsuarioSesion(): Promise<void> {
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
        if (exigirServicios().autenticacion.currentUser?.uid === usuario.uid) {
            await cargarUsuario(usuario);
        }
    })().finally(() => {
        actualizacion = null;
    });
    return actualizacion;
}
// Netegem les dades privades i tanquem la sessió d’Auth.
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
export function obtenerUrlVerificacion(): string {
    return window.location.origin + "/verify";
}
// Enviem la verificació amb una adreça de retorn del mateix lloc.
export async function enviarVerificacion(): Promise<void> {
    const usuario = exigirServicios().autenticacion.currentUser;
    if (!usuario) {
        throw new Error("Cal iniciar sessió.");
    }
    await sendEmailVerification(usuario, { url: obtenerUrlVerificacion(), handleCodeInApp: false });
}
// Apliquem el codi d’Auth i tornem a comprovar la sessió.
export async function aplicarVerificacion(codigo: string): Promise<void> {
    await applyActionCode(exigirServicios().autenticacion, codigo);
    await actualizarUsuarioSesion();
}
