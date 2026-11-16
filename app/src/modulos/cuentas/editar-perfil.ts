// Mostrem el compte actual i deixem canviar el nom i el telèfon, reenviar el correu o sortir.
import { cerrarSesion, enviarVerificacion, observarSesion, obtenerUsuarioActual, esperarEstadoSesion } from "../../datos/sesion";
import { crearPerfilUsuario, guardarPerfilUsuario } from "../../datos/personas";
import { obtenerEtiquetaRol } from "../../comun/permisos";
import { comprobarContacto } from "../../comun/formularios";
import { explicarErrorAcceso, explicarErrorVerificacion } from "../../comun/errores";
import { mostrarAviso } from "../../comun/avisos";
const correo = document.getElementById("perfil-email");
const verificacion = document.getElementById("perfil-verif");
const rol = document.getElementById("perfil-role");
const nombre = document.querySelector<HTMLInputElement>("#perfil-name");
const telefono = document.querySelector<HTMLInputElement>("#perfil-phone");
const guardar = document.querySelector<HTMLButtonElement>("#perfil-save");
const reenviar = document.querySelector<HTMLButtonElement>("#perfil-send-verify");
const salir = document.querySelector<HTMLButtonElement>("#perfil-logout");
const mensaje = document.getElementById("perfil-msg");
let guardando = false;
let cerrando = false;
// Si s’han editat camps, no els sobreescrivim perquè arribi una actualització del perfil.
let perfilEditado = false;
let ultimoUid = "";
let revisionIdentidad = 0;
// Comprovar que no hem canviat de compte mentre esperàvem una resposta.
// Rep el UID i el número de revisió que teníem abans d’esperar la xarxa.
// Retorna true només si la resposta encara correspon al mateix compte i revisió.
function mismaIdentidad(uid: string, revision: number): boolean {
    return revision === revisionIdentidad && obtenerUsuarioActual().usuario?.uid === uid;
}
// Posar el text al missatge del perfil.
// Rep el text que volem escriure a l’avís del perfil.
// No retorna dades: posa el missatge amb textContent si existeix el contenidor.
function mostrarMensaje(texto: string): void {
    if (mensaje) {
        mensaje.textContent = texto;
    }
}
// Mostrar si el correu està verificat i si cal el botó de reenviar.
// Rep un booleà que indica si el correu ja està verificat.
// No retorna dades: actualitza la insígnia i amaga o mostra el botó de reenviar.
function mostrarEstadoVerificacion(verificado: boolean): void {
    if (!verificacion) {
        return;
    }
    verificacion.textContent = verificado ? "Verificat" : "Pendent";
    verificacion.className = "inline-block rounded px-2 py-0.5 text-xs font-medium "
        + (verificado ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-800");
    reenviar?.classList.toggle("hidden", verificado);
}
// Qualsevol edició del contacte marca el formulari com a modificat abans que arribi un possible canvi del perfil.
nombre?.addEventListener("input", () => {
    perfilEditado = true;
});
telefono?.addEventListener("input", () => {
    perfilEditado = true;
});
observarSesion((estado) => {
    if (estado.estado === "cargando") {
        return;
    }
    const usuario = estado.usuario;
    // En sortir del compte, buidem el contacte i els avisos de la pantalla.
    if (estado.estado !== "autenticado" || !usuario) {
        revisionIdentidad++;
        if (correo) {
            correo.textContent = "";
        }
        if (rol) {
            rol.textContent = "";
        }
        if (nombre) {
            nombre.value = "";
        }
        if (telefono) {
            telefono.value = "";
        }
        ultimoUid = "";
        perfilEditado = false;
        guardando = false;
        if (guardar) {
            guardar.disabled = false;
        }
        if (reenviar) {
            reenviar.disabled = false;
        }
        mostrarMensaje("");
        document.getElementById("toast-root")?.remove();
        return;
    }
    // Quan entra un compte diferent no conservem les dades editades ni els botons ocupats del compte anterior.
    if (ultimoUid !== usuario.uid) {
        revisionIdentidad++;
        mostrarMensaje("");
        perfilEditado = false;
        guardando = false;
        if (guardar) {
            guardar.disabled = false;
        }
        if (reenviar) {
            reenviar.disabled = false;
        }
    }
    if (correo) {
        correo.textContent = usuario.correo;
    }
    if (rol) {
        rol.textContent = obtenerEtiquetaRol(usuario.rol);
    }
    mostrarEstadoVerificacion(usuario.correoVerificado);
    // Carreguem els valors si no hi ha una edició pendent o acabem de canviar de compte.
    if (!perfilEditado || ultimoUid !== usuario.uid) {
        if (nombre) {
            nombre.value = estado.perfil?.name || usuario.nombre;
        }
        if (telefono) {
            telefono.value = estado.perfil?.phone || "";
        }
    }
    ultimoUid = usuario.uid;
    // Si ha fallat la lectura no omplim camps amb dades d’un altre usuari ni anunciem que estiguin guardats.
    if (estado.errorPerfil) {
        mostrarMensaje("No s’han pogut carregar les dades. Revisa la connexió abans de desar.");
    }
    else if (!estado.perfil) {
        mostrarMensaje("Completa les dades i prem Desa els canvis per acabar la configuració inicial.");
    }
});
// En prémer Desa, validem el contacte i enviem els canvis del compte actual.
guardar?.addEventListener("click", async () => {
    if (guardando || !nombre || !telefono) {
        return;
    }
    const estado = obtenerUsuarioActual();
    const usuario = estado.usuario;
    if (estado.estado !== "autenticado" || !usuario) {
        return;
    }
    // Apliquem els mateixos límits que utilitzem quan es crea el contacte.
    const errorValidacion = comprobarContacto(nombre.value, telefono.value);
    if (errorValidacion) {
        mostrarMensaje(errorValidacion);
        return;
    }
    guardando = true;
    guardar.disabled = true;
    // Guardem el compte i la revisió d’aquest enviament per no mostrar el resultat en una altra sessió.
    const revision = revisionIdentidad;
    // Copiem els valors d’aquest enviament perquè no canviïn si l’usuari escriu mentre esperem la xarxa.
    const nuevoNombre = nombre.value;
    const nuevoTelefono = telefono.value;
    mostrarMensaje("Desant els canvis…");
    try {
        // Primer assegurem que existeixi el perfil, cosa que també recupera una alta incompleta.
        await crearPerfilUsuario(usuario.uid, usuario.correo, nuevoNombre, nuevoTelefono);
        await esperarEstadoSesion();
        if (!mismaIdentidad(usuario.uid, revision)) {
            return;
        }
        // Només modifiquem nom i telèfon; el rol no es pot triar en aquest formulari.
        await guardarPerfilUsuario(usuario.uid, nuevoNombre, nuevoTelefono);
        await esperarEstadoSesion();
        if (mismaIdentidad(usuario.uid, revision)) {
            // Si s’han fet més canvis mentre esperàvem, continuen marcats com a edició pendent.
            perfilEditado = nombre.value !== nuevoNombre || telefono.value !== nuevoTelefono;
            mostrarMensaje("Canvis desats.");
            mostrarAviso("Perfil desat.", "success");
        }
    }
    catch (error) {
        if (mismaIdentidad(usuario.uid, revision)) {
            mostrarMensaje(explicarErrorAcceso(error));
        }
    }
    finally {
        // El resultat d’un compte anterior no ha de reactivar els botons d’una altra sessió.
        if (revision === revisionIdentidad) {
            guardando = false;
            guardar.disabled = false;
        }
    }
});
// El botó de reenviar demana un altre correu de verificació, sense canviar el contacte.
reenviar?.addEventListener("click", async () => {
    if (reenviar.disabled) {
        return;
    }
    const uid = obtenerUsuarioActual().usuario?.uid;
    if (!uid) {
        return;
    }
    // Guardem el compte i la revisió d’aquest enviament per no mostrar el resultat en una altra sessió.
    const revision = revisionIdentidad;
    // Desactivem temporalment el reenviament per no demanar diversos correus amb clics seguits.
    reenviar.disabled = true;
    mostrarMensaje("Enviant el correu de verificació…");
    try {
        await enviarVerificacion();
        await esperarEstadoSesion();
        if (mismaIdentidad(uid, revision)) {
            mostrarMensaje("Correu enviat. Revisa també la carpeta de correu brossa.");
        }
    }
    catch (error) {
        if (mismaIdentidad(uid, revision)) {
            mostrarMensaje(explicarErrorVerificacion(error));
        }
    }
    finally {
        // El resultat d’un compte anterior no ha de reactivar els botons d’una altra sessió.
        if (revision === revisionIdentidad) {
            reenviar.disabled = false;
        }
    }
});
// El botó propi del perfil també tanca la sessió i torna a l’inici.
salir?.addEventListener("click", async () => {
    if (cerrando) {
        return;
    }
    cerrando = true;
    // El botó de sortir també queda protegit davant un segon clic durant la petició.
    salir.disabled = true;
    try {
        await cerrarSesion();
        window.location.assign("/");
    }
    catch {
        mostrarMensaje("No s’ha pogut tancar la sessió. Torna-ho a provar.");
    }
    finally {
        cerrando = false;
        salir.disabled = false;
    }
});
