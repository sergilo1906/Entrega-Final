// Mostrem els enllaços que pot utilitzar cada compte i preparem el botó de sortir.
import { cerrarSesion, observarSesion } from "../../datos/sesion";
import { comprobarPermiso, obtenerDestinoInicial, protegerRutaActual } from "../../comun/permisos";
import type { EstadoSesion } from "../../modelos/cuentas";
// Mostrar o amagar un element del menú.
// Rep un selector CSS i si volem mostrar l’element.
// No retorna dades: afegeix o treu la classe hidden.
function mostrarElemento(selector: string, mostrar: boolean): void {
    document.querySelector(selector)?.classList.toggle("hidden", !mostrar);
}
// Canviar els enllaços visibles segons el compte i els seus permisos.
// Rep l’estat actualitzat de la sessió.
// No retorna dades: adapta l’avatar, els enllaços i els botons d’entrada i sortida.
function actualizarNavegacion(estado: EstadoSesion): void {
    // El menú no depèn només de si hi ha un objecte d’usuari; també cal que l’estat de sessió estigui resolt.
    const autenticado = estado.estado === "autenticado";
    const usuario = estado.usuario;
    const invitado = estado.estado === "invitado" || estado.estado === "desactivado" || estado.estado === "error";
    mostrarElemento("#btn-login", invitado);
    mostrarElemento("#btn-register", invitado);
    mostrarElemento("#btn-profile", autenticado);
    mostrarElemento("#btn-logout", autenticado || estado.estado === "error");
    mostrarElemento("#user-avatar", autenticado);
    mostrarElemento("#link-citas", autenticado && usuario?.correoVerificado === true);
    const avatar = document.getElementById("user-avatar");
    if (avatar) {
        // Mostrem una inicial del contacte, del nom d’Auth o del correu, sense inserir HTML.
        avatar.textContent = autenticado ? (estado.perfil?.name || usuario?.nombre || usuario?.correo || "?").trim().slice(0, 1).toUpperCase() : "";
    }
    // Recorrem els enllaços que indiquen rols i amaguem els que el compte no pot utilitzar.
    const enlaces = document.querySelectorAll<HTMLElement>("[data-roles]");
    for (let indice = 0; indice < enlaces.length; indice++) {
        const roles = enlaces[indice].dataset.roles?.split(" ") || [];
        // Els enllaços d’administració requereixen correu verificat i un rol inclòs a data-roles.
        const permitido = autenticado && usuario?.correoVerificado === true && roles.includes(usuario.rol);
        enlaces[indice].classList.toggle("hidden", !permitido);
    }
    // La targeta d’administració de l’inici segueix els mateixos permisos que el menú.
    const tarjeta = document.querySelector<HTMLAnchorElement>("#admin-card");
    if (tarjeta) {
        const permitido = comprobarPermiso(estado, ["admin"]);
        tarjeta.classList.toggle("hidden", !permitido);
        tarjeta.classList.toggle("flex", permitido);
        if (usuario) {
            tarjeta.href = obtenerDestinoInicial(usuario.rol);
        }
    }
}
const botonSalir = document.querySelector<HTMLButtonElement>("#btn-logout");
let cierreEnCurso = false;
if (botonSalir) {
    botonSalir.disabled = false;
    // Durant la sortida desactivem el botó per no enviar-la dues vegades.
    botonSalir.addEventListener("click", async () => {
        // Ignorem un segon clic de sortida si la primera petició encara no s’ha acabat.
        if (cierreEnCurso) {
            return;
        }
        cierreEnCurso = true;
        botonSalir.disabled = true;
        botonSalir.textContent = "Tancant la sessió…";
        try {
            await cerrarSesion();
            window.location.assign("/login");
        }
        catch {
            botonSalir.textContent = "Torna a provar de sortir";
        }
        finally {
            cierreEnCurso = false;
            botonSalir.disabled = false;
        }
    });
}
observarSesion(actualizarNavegacion);
// Amagar enllaços no basta: també comprovem l’adreça que l’usuari ha escrit directament.
protegerRutaActual();
if (new URLSearchParams(location.search).get("acceso") === "denegado") {
    const aviso = document.getElementById("acceso-msg");
    if (aviso) {
        aviso.textContent = "No tens permís per accedir a aquesta secció.";
        aviso.hidden = false;
    }
}
