import { actualizarUsuarioSesion, aplicarVerificacion, esperarEstadoSesion, obtenerUsuarioActual } from "../../datos/sesion";
import { obtenerDestinoInicial } from "../../comun/permisos";
const mensaje = document.getElementById("verify-msg");
function leerParametroUrl(nombre: string): string {
    return new URLSearchParams(location.search).get(nombre) || "";
}
function irAlInicioDelRol(): void {
    const usuario = obtenerUsuarioActual().usuario;
    window.location.replace(usuario ? obtenerDestinoInicial(usuario.rol) : "/login?verified=1");
}
// Verifiquem el codi del correu i obrim la pantalla permesa.
async function procesarVerificacion(): Promise<void> {
    if (!mensaje) {
        return;
    }
    const estado = await esperarEstadoSesion();
    if (estado.estado === "desactivado" || estado.estado === "error") {
        mensaje.textContent = estado.mensaje;
        return;
    }
    const codigo = leerParametroUrl("oobCode");
    if (leerParametroUrl("mode") === "verifyEmail" && codigo) {
        mensaje.textContent = "Verificant…";
        try {
            await aplicarVerificacion(codigo);
            await esperarEstadoSesion();
            mensaje.textContent = "Correu verificat. Redirigint…";
            // El codi s’usa una sola vegada; no seguim el continueUrl rebut.
            window.history.replaceState(null, "", "/verify");
            irAlInicioDelRol();
        }
        catch {
            mensaje.textContent = "L’enllaç no és vàlid o ha caducat. Ves al perfil i torna a enviar la verificació.";
        }
        return;
    }
    if (estado.usuario) {
        try {
            await actualizarUsuarioSesion();
        }
        catch {
            mensaje.textContent = "No s’ha pogut comprovar el correu. Torna-ho a provar.";
            return;
        }
        await esperarEstadoSesion();
        if (obtenerUsuarioActual().usuario?.correoVerificado) {
            irAlInicioDelRol();
            return;
        }
    }
    if (leerParametroUrl("sendError")) {
        mensaje.textContent = "El compte s’ha creat, però el correu no s’ha pogut enviar. Ves al perfil i prem Torna a enviar la verificació.";
    }
    else if (leerParametroUrl("sent")) {
        mensaje.textContent = "T’hem enviat un correu de verificació. Obre’l i prem l’enllaç.";
    }
    else {
        mensaje.textContent = "Obre l’enllaç del correu de verificació per completar l’accés.";
    }
}
void procesarVerificacion();
