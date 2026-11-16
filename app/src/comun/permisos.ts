// Mirem quines pantalles pot veure cada compte. El servidor també comprova els permisos abans de guardar res.
import { observarSesion, obtenerUsuarioActual } from "../datos/sesion";
import type { EstadoSesion, Rol, UsuarioSesion } from "../modelos/cuentas";
// Llista de rols que poden obrir cada ruta privada.
export const PERMISOS_RUTA: Record<string, Rol[]> = {
    "/perfil": ["client", "admin"], "/reservar": ["client", "admin"], "/mis-citas": ["client", "admin"],
    "/admin": ["admin"], "/agenda": ["admin"], "/servicios": ["admin"], "/horarios": ["admin"],
};
export interface ContextoAutorizado {
    usuario: UsuarioSesion;
    esVigente: () => boolean;
}
// Carregar les dades només si el compte té permís i netejar-les quan canvia de compte.
// Rep els rols permesos i dues funcions: carregar dades i netejar la pantalla.
// No retorna dades: avisa de cada compte autoritzat i invalida les càrregues antigues.
export function observarAreaAutorizada(roles: readonly Rol[], cargar: (contexto: ContextoAutorizado) => void, limpiar: () => void): void {
    let claveAnterior = "";
    let revision = 0;
    observarSesion((estado) => {
        if (estado.estado === "cargando") {
            return;
        }
        const usuario = estado.usuario;
        // La clau identifica el compte i la versió de permisos que tenim carregats.
        const clave = comprobarPermiso(estado, roles) && usuario ? usuario.uid + ":" + usuario.rol + ":" + usuario.versionRol : "";
        // Una renovació del mateix compte no ha de reiniciar un formulari que s’està editant.
        if (clave === claveAnterior) {
            return;
        }
        // Invalidem les consultes anteriors abans de netejar i carregar les del compte nou.
        revision++;
        claveAnterior = clave;
        limpiar();
        // Si no tenim una identitat autoritzada, deixem la pantalla neta i no comencem cap consulta.
        if (!clave || !usuario) {
            return;
        }
        const actual = revision;
        // esVigente permet a cada pantalla comprovar que no està mostrant una resposta antiga.
        cargar({ usuario, esVigente: () => actual === revision && comprobarPermiso(obtenerUsuarioActual(), roles)
                && obtenerUsuarioActual().usuario?.uid === usuario.uid && obtenerUsuarioActual().usuario?.rol === usuario.rol });
    });
}
// Retornar el nom del rol que mostrem al perfil.
// Rep client o admin.
// Retorna el nom del rol que llegirà l’usuari al perfil.
export function obtenerEtiquetaRol(rol: Rol): string {
    return rol === "admin" ? "Administrador" : "Client";
}
// Triar la pantalla inicial: administració o reserva.
// Rep el rol del compte que acaba d’entrar.
// Retorna /admin per a administradors o /reservar per a clients.
export function obtenerDestinoInicial(rol: Rol): string {
    return rol === "admin" ? "/admin" : "/reservar";
}
// Mirar si tenim sessió, el correu verificat i un dels rols permesos.
// Rep l’estat de sessió, els rols permesos i si cal verificar el correu.
// Retorna un booleà; aquest resultat ajuda la pantalla, però no substitueix el servidor.
export function comprobarPermiso(estado: EstadoSesion, roles: readonly Rol[], correoObligatorio = true): boolean {
    if (estado.estado !== "autenticado" || !estado.usuario) {
        return false;
    }
    // En les àrees de negoci, tenir correu i contrasenya no és suficient: cal haver verificat el correu.
    if (correoObligatorio && !estado.usuario.correoVerificado) {
        return false;
    }
    return roles.includes(estado.usuario.rol);
}
// Mostrar el contingut de la pàgina després de comprovar l’accés.
// No rep paràmetres: treballa amb el document que tenim obert.
// No retorna dades: retira l’atribut que mantenia ocult el contingut privat.
export function mostrarPaginaAutorizada(): void {
    document.documentElement.removeAttribute("data-auth-pending");
}
// Comprovar la ruta oberta i canviar de pantalla si el compte no hi pot entrar.
// No rep paràmetres: llegeix la ruta actual i escolta la sessió.
// No retorna dades: mostra la pàgina autoritzada o redirigeix a una altra ruta.
export function protegerRutaActual(): void {
    // Traiem les barres finals perquè /admin i /admin/ es comprovin igual.
    const ruta = window.location.pathname.replace(/\/+$/, "") || "/";
    const roles = PERMISOS_RUTA[ruta];
    // Les rutes públiques no apareixen al mapa i no necessiten aquesta protecció de pantalla.
    if (!roles) {
        return;
    }
    observarSesion((estado) => {
        // Amaguem el contingut mentre encara no podem assegurar a quin compte correspon.
        document.documentElement.setAttribute("data-auth-pending", "");
        const aviso = document.getElementById("acceso-msg");
        if (aviso) {
            aviso.hidden = true;
        }
        if (estado.estado === "cargando") {
            return;
        }
        // Sense sessió enviem el compte al login.
        if (estado.estado === "invitado" || estado.estado === "desactivado") {
            window.location.replace("/login");
            return;
        }
        if (estado.estado === "error") {
            if (aviso) {
                aviso.textContent = estado.mensaje;
                aviso.hidden = false;
            }
            return;
        }
        // Deixem obrir Perfil sense verificar perquè es pugui reenviar el correu.
        if (ruta !== "/perfil" && !estado.usuario?.correoVerificado) {
            window.location.replace("/verify");
            return;
        }
        if (!comprobarPermiso(estado, roles, ruta !== "/perfil")) {
            // replace evita deixar la ruta denegada com una pàgina útil a l’historial del navegador.
            window.location.replace("/?acceso=denegado");
            return;
        }
        mostrarPaginaAutorizada();
    });
}
