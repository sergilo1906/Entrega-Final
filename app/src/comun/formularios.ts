// Comprovacions dels formularis que es comparteixen entre pantalles.
// Comprovar que el correu no sigui buit i tingui un format vàlid.
// Rep el correu escrit al formulari.
// Retorna el primer missatge d’error o text buit si és correcte.
export function comprobarCorreo(correo: string): string {
    // trim treu els espais dels extrems; un correu format només per espais també és buit.
    if (!correo.trim()) {
        return "Escriu el correu.";
    }
    // L’expressió comprova la forma del correu, però la verificació real es fa amb l’enllaç d’Auth.
    if (correo.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
        return "El correu no és vàlid.";
    }
    return "";
}
// Comprovar el correu i la contrasenya abans d’enviar el formulari.
// Rep el correu i la contrasenya del formulari.
// Retorna un error de validació o text buit si es poden enviar.
export function comprobarFormulario(correo: string, contrasena: string): string {
    const mensaje = comprobarCorreo(correo);
    // Si el correu ja és incorrecte, retornem aquell primer error i no continuem amb la contrasenya.
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
// Comprovar que hi hagi nom i que el nom i el telèfon no siguin massa llargs.
// Rep el nom i el telèfon, que pot quedar buit.
// Retorna el primer problema de contacte o text buit si no n’hi ha.
export function comprobarContacto(nombre: string, telefono: string): string {
    if (!nombre.trim()) {
        return "Escriu el nom.";
    }
    if (nombre.trim().length > 100) {
        return "El nom no pot superar els 100 caràcters.";
    }
    // El telèfon és opcional, però si s’omple no pot superar el límit del perfil.
    if (telefono.trim().length > 30) {
        return "El telèfon no pot superar els 30 caràcters.";
    }
    return "";
}
// Desactivar els camps mentre esperem la resposta per evitar enviaments repetits.
// Rep el formulari HTML i true per bloquejar-lo o false per activar-lo.
// No retorna dades: canvia els camps, l’aspecte i l’indicador aria-busy.
export function bloquearFormulario(formulario: HTMLFormElement, bloqueado: boolean): void {
    formulario.classList.toggle("opacity-50", bloqueado);
    formulario.classList.toggle("pointer-events-none", bloqueado);
    // A més de desactivar camps, indiquem que el formulari està ocupat a les eines d’accessibilitat.
    formulario.setAttribute("aria-busy", String(bloqueado));
    const controles = formulario.querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLSelectElement | HTMLTextAreaElement>("input, button, select, textarea");
    // Recorrem tots els tipus de control, no només el botó d’enviar.
    for (let indice = 0; indice < controles.length; indice++) {
        controles[indice].disabled = bloqueado;
    }
}
