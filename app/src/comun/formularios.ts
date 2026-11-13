// Validem el formulari; el servidor també comprova les dades.
export function comprobarCorreo(correo: string): string {
    if (!correo.trim()) {
        return "Escriu el correu.";
    }
    if (correo.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
        return "El correu no és vàlid.";
    }
    return "";
}
export function comprobarFormulario(correo: string, contrasena: string): string {
    const mensaje = comprobarCorreo(correo);
    if (mensaje) {
        return mensaje;
    }
    if (!contrasena) {
        return "Escriu la contrasenya.";
    }
    if (contrasena.length < 6) {
        return "La contrasenya ha de tenir almenys 6 caràcters.";
    }
    return "";
}
export function comprobarContacto(nombre: string, telefono: string): string {
    if (!nombre.trim()) {
        return "Escriu el nom.";
    }
    if (nombre.trim().length > 100) {
        return "El nom no pot superar els 100 caràcters.";
    }
    if (telefono.trim().length > 30) {
        return "El telèfon no pot superar els 30 caràcters.";
    }
    return "";
}
export function bloquearFormulario(formulario: HTMLFormElement, bloqueado: boolean): void {
    formulario.classList.toggle("opacity-50", bloqueado);
    formulario.classList.toggle("pointer-events-none", bloqueado);
    formulario.setAttribute("aria-busy", String(bloqueado));
    const controles = formulario.querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLSelectElement | HTMLTextAreaElement>("input, button, select, textarea");
    for (let indice = 0; indice < controles.length; indice++) {
        controles[indice].disabled = bloqueado;
    }
}
