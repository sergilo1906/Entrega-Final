// Recollim les dades del registre i comprovem que les dues contrasenyes coincideixin.
import { observarSesion, registrarUsuario } from "../../datos/sesion";
import { obtenerDestinoInicial } from "../../comun/permisos";
import { explicarErrorAcceso } from "../../comun/errores";
import { bloquearFormulario, comprobarContacto, comprobarFormulario } from "../../comun/formularios";
const formulario = document.querySelector<HTMLFormElement>("#reg-form");
const mensaje = document.getElementById("reg-msg");
let solicitudEnCurso = false;
// Si ja hi ha una sessió, no oferim tornar a registrar el mateix compte: anem a la seva pantalla.
observarSesion((estado) => {
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
});
formulario?.addEventListener("submit", async (evento) => {
    // Aturem l’enviament HTML normal perquè el registre es farà amb JavaScript i Firebase.
    evento.preventDefault();
    if (!formulario || !mensaje || solicitudEnCurso) {
        return;
    }
    // FormData recull els valors dels inputs que tenen un name al formulari.
    const campos = new FormData(formulario);
    const nombre = String(campos.get("name") || "").trim();
    const telefono = String(campos.get("phone") || "").trim();
    const correo = String(campos.get("email") || "").trim();
    const contrasena = String(campos.get("password") || "");
    const confirmacion = String(campos.get("password2") || "");
    // L’operador || es queda amb el primer missatge no buit de les dues comprovacions.
    let errorValidacion = comprobarContacto(nombre, telefono) || comprobarFormulario(correo, contrasena);
    // Abans de crear el compte comprovem que les dues contrasenyes siguin iguals.
    if (!errorValidacion && contrasena !== confirmacion) {
        errorValidacion = "Les contrasenyes no coincideixen.";
    }
    // Un error del formulari es mostra aquí i evita fer la petició de creació del compte.
    if (errorValidacion) {
        mensaje.textContent = errorValidacion;
        return;
    }
    // A partir d’aquí ignorem altres enviaments fins que hi hagi un resultat.
    solicitudEnCurso = true;
    bloquearFormulario(formulario, true);
    mensaje.textContent = "Creant el compte…";
    try {
        const resultado = await registrarUsuario(correo, contrasena, nombre, telefono);
        // Si només s’ha pogut crear el compte, obrim Perfil per poder completar les dades.
        if (!resultado.perfilCreado) {
            window.location.assign("/perfil?alta=incompleta");
        }
        else {
            // La pantalla de verificació rep un indicador per explicar si l’enviament ha funcionat o queda pendent.
            window.location.assign(resultado.correoEnviado ? "/verify?sent=1" : "/verify?sendError=1");
        }
    }
    catch (error) {
        mensaje.textContent = explicarErrorAcceso(error);
        solicitudEnCurso = false;
        bloquearFormulario(formulario, false);
    }
});
