// Llegim el codi de l’enllaç del correu i demanem a Firebase que el verifiqui.
import { actualizarUsuarioSesion, aplicarVerificacion, esperarEstadoSesion, obtenerUsuarioActual } from "../../datos/sesion";
import { obtenerDestinoInicial } from "../../comun/permisos";
const mensaje = document.getElementById("verify-msg");
// Llegir un valor de l’adreça de la pàgina o retornar text buit si no hi és.
// Rep el nom del paràmetre que busquem a l’adreça de la pàgina.
// Retorna el seu text o una cadena buida si no hi apareix.
function leerParametroUrl(nombre: string): string {
    return new URLSearchParams(location.search).get(nombre) || "";
}
// Anar a la pantalla inicial del compte o al login si no hi ha sessió.
// No rep paràmetres: consulta el compte de la sessió actual.
// No retorna dades: canvia de ruta segons el rol o obre el login de correu verificat.
function irAlInicioDelRol(): void {
    const usuario = obtenerUsuarioActual().usuario;
    window.location.replace(usuario ? obtenerDestinoInicial(usuario.rol) : "/login?verified=1");
}
// Llegir el codi, verificar-lo amb Firebase i mostrar el resultat.
// No rep paràmetres: llegeix el mode, el codi i l’estat actual de sessió.
// La promesa mostra un resultat o redirigeix després de verificar el correu.
async function procesarVerificacion(): Promise<void> {
    if (!mensaje) {
        return;
    }
    const estado = await esperarEstadoSesion();
    // Si no podem utilitzar la sessió o Firebase, mostrem aquell problema abans d’intentar llegir el codi.
    if (estado.estado === "desactivado" || estado.estado === "error") {
        mensaje.textContent = estado.mensaje;
        return;
    }
    const codigo = leerParametroUrl("oobCode");
    // Només apliquem un codi si l’enllaç és de verificació de correu.
    if (leerParametroUrl("mode") === "verifyEmail" && codigo) {
        mensaje.textContent = "Verificant…";
        try {
            // El codi el valida Authentication; tenir un text a la URL no significa que sigui vàlid.
            await aplicarVerificacion(codigo);
            await esperarEstadoSesion();
            mensaje.textContent = "Correu verificat. Redirigint…";
            // El codi s’usa una sola vegada; no seguim el continueUrl rebut.
            // Un cop utilitzat, traiem el codi de l’adreça perquè no es torni a aplicar en recarregar.
            window.history.replaceState(null, "", "/verify");
            irAlInicioDelRol();
        }
        catch {
            mensaje.textContent = "L’enllaç no és vàlid o ha caducat. Ves al perfil i torna a enviar la verificació.";
        }
        return;
    }
    // Sense un codi nou, comprovem si el compte s’ha verificat en una altra pestanya.
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
    // El compte pot existir encara que el correu no s’hagi enviat; l’usuari ha de poder recuperar aquest pas.
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
// Comencem el procés en carregar la pàgina; els seus missatges i errors es gestionen a dins.
void procesarVerificacion();
