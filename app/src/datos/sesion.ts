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
// Rep el rol llegit dels permisos, que pot no estar definit.
// Retorna client si falta, client/admin si es reconeix o null per denegar un altre valor.
export function normalizarRol(valor: unknown): Rol | null {
    // Els comptes normals poden no tenir rol al token; en aquest cas són clients.
    if (valor === undefined) {
        return "client";
    }
    // Un rol diferent no es converteix en administrador per semblança amb el seu nom.
    if (valor === "client" || valor === "admin") {
        return valor;
    }
    return null;
}
// Guardar com està la sessió i avisar totes les pantalles que l’estan escoltant.
// Rep el nou estat de sessió que s’ha de compartir.
// No retorna dades: substitueix l’estat anterior i crida els seus observadors.
function publicarEstado(estado: EstadoSesion): void {
    estadoSesion = estado;
    // Cada pantalla registrada rep el mateix estat, així menú i formularis reaccionen al mateix compte.
    for (const recibir of suscriptores) {
        recibir(estadoSesion);
    }
}
// Preparar un estat de sessió sense dades de cap compte.
// Rep el nom d’estat i, si cal, un missatge per a l’usuari.
// Retorna un estat sense usuari ni perfil perquè no quedin dades del compte anterior.
function estadoVacio(estado: EstadoSesion["estado"], mensaje = ""): EstadoSesion {
    return {
        estado, usuario: null, perfil: null, errorPerfil: false, mensaje
    };
}
// Treure de la pestanya les dades temporals que són d’aquesta aplicació.
// No rep paràmetres: recorre sessionStorage de la pestanya.
// No retorna dades: esborra només claus que comencen per barberpro-.
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
// No rep paràmetres: demana els serveis compartits de Firebase.
// Retorna els serveis o atura l’operació amb un error si estan desactivats.
function exigirServicios() {
    const servicios = obtenerServiciosFirebase();
    if (!servicios) {
        throw new Error("Firebase no està configurat.");
    }
    return servicios;
}
// Carregar la sessió i comprovar que els permisos coincideixin amb el perfil.
// Rep el compte que indica Auth, o null si s’ha tancat la sessió.
// La promesa prepara l’estat i l’observació del perfil; els resultats arriben a publicarEstado.
async function cargarUsuario(usuario: User | null): Promise<void> {
    // Ens quedem el número d’aquesta càrrega per saber si després encara és la vigent.
    const revision = ++revisionSesion;
    // Abans de carregar un compte nou deixem d’escoltar el perfil de l’anterior.
    cancelarPerfil?.();
    cancelarPerfil = null;
    publicarEstado(estadoVacio("cargando"));
    // Sense usuari d’Auth passem a convidat i retirem les dades temporals de la sessió anterior.
    if (!usuario) {
        limpiarDatosTemporalesSesion();
        publicarEstado(estadoVacio("invitado"));
        return;
    }
    try {
        // await espera que Firebase retorni el comprovant de sessió i els permisos.
        const token = await getIdTokenResult(usuario);
        // Si una càrrega més nova ha començat mentrestant, aquesta resposta ja no s’ha de mostrar.
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
            // Si una càrrega més nova ha començat mentrestant, aquesta resposta ja no s’ha de mostrar.
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
                // Recordem aquest canvi per no demanar la mateixa actualització de permisos una vegada i una altra.
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
            // Si una càrrega més nova ha començat mentrestant, aquesta resposta ja no s’ha de mostrar.
            if (revision !== revisionSesion) {
                return;
            }
            // Un error en carregar el perfil no dona permisos d’administració.
            if (rol !== "client") {
                publicarEstado(estadoVacio("error", "No s’han pogut comprovar els permisos. Torna a iniciar sessió."));
            }
            else {
                publicarEstado({
                    // Un client amb error de perfil pot veure l’avís i recuperar el contacte; això no li concedeix permisos de gestió.
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
// No rep paràmetres: prepara els observadors globals de sessió.
// No retorna dades i no registra els mateixos observadors una segona vegada.
function iniciarObservacion(): void {
    // Les diferents pantalles poden demanar observar la sessió, però només registrem un observador global d’Auth.
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
// Rep la funció de la pantalla que vol conèixer l’estat de sessió.
// Retorna una funció per eliminar aquella pantalla de la llista d’observadors.
export function observarSesion(recibir: (estado: EstadoSesion) => void): () => void {
    // La pantalla rep l’estat que ja coneixem sense haver d’esperar el pròxim canvi.
    suscriptores.add(recibir);
    recibir(estadoSesion);
    iniciarObservacion();
    return () => {
        // Quan ja no cal escoltar, traiem aquesta funció de la llista per no tornar-la a avisar.
        suscriptores.delete(recibir);
    };
}
// Retornar l’estat de sessió que tenim guardat en memòria.
// No rep paràmetres i no fa cap consulta nova a Firebase.
// Retorna l’últim estat de sessió que tenim en memòria.
export function obtenerUsuarioActual(): EstadoSesion {
    return estadoSesion;
}
// Esperar que acabi la càrrega abans de fer servir les dades del compte.
// No rep paràmetres: espera l’observació de sessió si encara està carregant.
// Retorna una promesa amb el primer estat que ja no sigui cargando.
export function esperarEstadoSesion(): Promise<EstadoSesion> {
    iniciarObservacion();
    // Si la sessió ja estava resolta, retornem una promesa resolta i evitem una espera innecessària.
    if (estadoSesion.estado !== "cargando") {
        return Promise.resolve(estadoSesion);
    }
    return new Promise((resolver) => {
        // Quan la sessió ja ha carregat, retornar-la i deixar d’esperar més canvis.
        // Rep cada estat que publica l’observador mentre estem esperant.
        // No retorna dades: resol la promesa quan la càrrega de sessió s’ha acabat.
        const recibir = (estado: EstadoSesion) => {
            if (estado.estado !== "cargando") {
                // Quan ja no cal escoltar, traiem aquesta funció de la llista per no tornar-la a avisar.
                suscriptores.delete(recibir);
                resolver(estado);
            }
        };
        suscriptores.add(recibir);
    });
}
// Entrar amb correu i contrasenya i carregar els permisos actuals.
// Rep el correu i la contrasenya del login.
// La promesa acaba després d’entrar i demanar el compte i els permisos actualitzats.
export async function iniciarSesion(correo: string, contrasena: string): Promise<void> {
    await signInWithEmailAndPassword(exigirServicios().autenticacion, correo, contrasena);
    await actualizarUsuarioSesion();
}
// Crear el compte, el perfil i enviar la verificació; indicar quin pas ha fallat.
// Rep correu, contrasenya, nom i telèfon del formulari de registre.
// Retorna perfilCreado i correoEnviado per distingir una alta completa d’un pas pendent.
export async function registrarUsuario(correo: string, contrasena: string, nombre: string, telefono: string) {
    // Primer creem el compte d’Auth; després guardarem el nom i el perfil.
    const credencial = await createUserWithEmailAndPassword(exigirServicios().autenticacion, correo, contrasena);
    try {
        // El nom visible d’Auth i el perfil de Firestore són dues escriptures diferents.
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
// No rep paràmetres: treballa amb el compte actual d’Auth.
// Retorna la promesa d’actualització, compartint-la si ja hi ha una càrrega en marxa.
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
            // true obliga a demanar un token actualitzat perquè pugui incloure un canvi recent de rol.
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
        // En acabar, tant si ha anat bé com si ha fallat, permetem una actualització nova.
        actualizacion = null;
    });
    return actualizacion;
}
// Buidar les dades del compte i demanar a Firebase que tanqui la sessió.
// No rep paràmetres: surt del compte actual.
// Retorna una promesa; les dades temporals es netegen abans d’esperar la sortida d’Auth.
export async function cerrarSesion(): Promise<void> {
    // Buidem les dades abans d’esperar la xarxa perquè no quedin visibles.
    revisionSesion++;
    cancelarPerfil?.();
    limpiarDatosTemporalesSesion();
    publicarEstado(estadoVacio("cargando"));
    try {
        // Només passem definitivament a convidat quan Firebase confirma la sortida.
        await signOut(exigirServicios().autenticacion);
        publicarEstado(estadoVacio("invitado"));
    }
    catch (error) {
        publicarEstado(estadoVacio("error", "No s’ha pogut tancar la sessió. Torna-ho a provar."));
        throw error;
    }
}
// Retornar l’adreça de verificació de la mateixa web que tenim oberta.
// No rep paràmetres: llegeix l’origen del navegador.
// Retorna l’adreça /verify de la mateixa web, sense acceptar una adreça externa.
export function obtenerUrlVerificacion(): string {
    return window.location.origin + "/verify";
}
// Enviar el correu de verificació al compte que ha iniciat sessió.
// No rep paràmetres: utilitza el compte que té sessió oberta.
// La promesa confirma la petició d’enviament; no certifica que l’usuari hagi llegit el correu.
export async function enviarVerificacion(): Promise<void> {
    const usuario = exigirServicios().autenticacion.currentUser;
    if (!usuario) {
        throw new Error("Cal iniciar sessió.");
    }
    // La contrasenya no s’envia al correu: s’hi envia un enllaç de verificació del compte.
    await sendEmailVerification(usuario, { url: obtenerUrlVerificacion(), handleCodeInApp: false });
}
// Aplicar el codi del correu i actualitzar la sessió amb el resultat.
// Rep el codi que venia dins l’enllaç de verificació.
// La promesa aplica el codi i refresca l’estat de sessió que es mostra a la web.
export async function aplicarVerificacion(codigo: string): Promise<void> {
    await applyActionCode(exigirServicios().autenticacion, codigo);
    await actualizarUsuarioSesion();
}
