// Comprovem el formulari de login i portem el compte a la pantalla que li correspon.
import { esperarEstadoSesion, iniciarSesion, observarSesion } from "../../datos/sesion";
import { obtenerDestinoInicial } from "../../comun/permisos";
import { explicarErrorAcceso } from "../../comun/errores";
import { bloquearFormulario, comprobarFormulario } from "../../comun/formularios";
const formulario = document.querySelector<HTMLFormElement>("#login-form");
const mensaje = document.getElementById("login-msg");
// Aquesta variable evita enviar el login una altra vegada mentre encara esperem.
let solicitudEnCurso = false;
observarSesion((estado) => {
    // No canviem el formulari si falta un element o si el seu enviament ja està en curs.
    if (!formulario || !mensaje || solicitudEnCurso) {
        return;
    }
    bloquearFormulario(formulario, estado.estado === "cargando" || estado.estado === "desactivado");
    if (estado.estado === "autenticado" && estado.usuario) {
        window.location.replace(estado.usuario.correoVerificado ? obtenerDestinoInicial(estado.usuario.rol) : "/verify");
    }
    else if (estado.mensaje) {
        mensaje.textContent = estado.mensaje;
    }
    // Aquest indicador permet explicar el resultat d’un correu verificat quan arribem al login sense sessió.
    else if (new URLSearchParams(location.search).get("verified") === "1") {
        mensaje.textContent = "Correu verificat. Ja pots iniciar sessió.";
    }
});
formulario?.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    // No canviem el formulari si falta un element o si el seu enviament ja està en curs.
    if (!formulario || !mensaje || solicitudEnCurso) {
        return;
    }
    // Recollim els valors pels name dels inputs; no enviem dades d’altres elements de la pàgina.
    const campos = new FormData(formulario);
    const correo = String(campos.get("email") || "").trim();
    const contrasena = String(campos.get("password") || "");
    const errorValidacion = comprobarFormulario(correo, contrasena);
    if (errorValidacion) {
        mensaje.textContent = errorValidacion;
        return;
    }
    solicitudEnCurso = true;
    bloquearFormulario(formulario, true);
    mensaje.textContent = "Iniciant la sessió…";
    try {
        // Esperem que Firebase comprovi les credencials; després mirem els permisos.
        await iniciarSesion(correo, contrasena);
        const estado = await esperarEstadoSesion();
        // Entrar no és suficient si després no podem confirmar la sessió; tractem aquesta situació com un error.
        if (!estado.usuario) {
            throw new Error("No s’ha pogut comprovar la sessió.");
        }
        window.location.replace(estado.usuario.correoVerificado ? obtenerDestinoInicial(estado.usuario.rol) : "/verify");
    }
    catch (error) {
        mensaje.textContent = explicarErrorAcceso(error);
        // En un error deixem corregir els camps i tornar a enviar el mateix formulari.
        solicitudEnCurso = false;
        bloquearFormulario(formulario, false);
    }
});
