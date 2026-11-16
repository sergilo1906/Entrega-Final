// Canviem els errors de Firebase per missatges que es puguin entendre a la web.
// Agafar el codi de l’error; si no en té, retornar text buit.
// Rep un error del qual encara no sabem la forma.
// Retorna el seu codi com a text o una cadena buida si no en té.
export function obtenerCodigoError(error: unknown): string {
    // Abans de llegir code comprovem que l’error sigui un objecte i no sigui null.
    if (typeof error === "object" && error !== null && "code" in error) {
        return String(error.code);
    }
    return "";
}
// Explicar per què no s’ha pogut entrar, sense revelar si un correu existeix.
// Rep un error d’Authentication, com una contrasenya incorrecta.
// Retorna el missatge que es mostrarà al formulari, no l’error tècnic complet.
export function explicarErrorAcceso(error: unknown): string {
    const codigo = obtenerCodigoError(error);
    // Fem servir el mateix avís per a compte inexistent i contrasenya incorrecta; no revelem quins correus estan registrats.
    if (["auth/invalid-credential", "auth/wrong-password", "auth/user-not-found"].includes(codigo)) {
        return "El correu o la contrasenya no són correctes.";
    }
    if (codigo === "auth/email-already-in-use") {
        return "Aquest correu ja està en ús.";
    }
    if (codigo === "auth/invalid-email") {
        return "El correu no és vàlid.";
    }
    if (codigo === "auth/weak-password") {
        return "La contrasenya és massa feble.";
    }
    // Si s’han fet massa intents, cal esperar en lloc de continuar enviant el formulari.
    if (codigo === "auth/too-many-requests") {
        return "Massa intents. Espera un minut i torna-ho a provar.";
    }
    if (codigo === "auth/network-request-failed" || codigo === "unavailable") {
        return "No s’ha pogut connectar. Comprova la connexió i torna-ho a provar.";
    }
    if (codigo === "auth/user-disabled" || codigo === "auth/user-token-expired" || codigo === "auth/invalid-user-token") {
        return "La sessió ja no és vàlida. Torna a iniciar sessió.";
    }
    return "No s’ha pogut completar l’operació. Torna-ho a provar.";
}
// Avisar què pot fer l’usuari si no s’envia la verificació.
// Rep l’error que ha retornat l’enviament del correu.
// Retorna un text que indica si cal esperar o tornar-ho a provar.
export function explicarErrorVerificacion(error: unknown): string {
    if (obtenerCodigoError(error) === "auth/too-many-requests") {
        return "Has demanat massa correus. Espera un minut i torna-ho a provar.";
    }
    return "No s’ha pogut enviar el correu de verificació. Torna-ho a provar des del perfil.";
}
// Mostrar un missatge entenedor quan falla una reserva.
// Rep l’error d’una petició de reserva o de disponibilitat.
// Retorna un missatge sobre permisos, dades, hora ocupada o resposta desconeguda.
export function explicarErrorReserva(error: unknown): string {
    const codigo = obtenerCodigoError(error);
    // Aquest error acostuma a indicar que una altra reserva ha ocupat el buit que es veia lliure.
    if (codigo === "functions/already-exists") {
        return "Aquesta hora ja no està disponible. Tria’n una altra.";
    }
    if (codigo === "functions/permission-denied" || codigo === "functions/unauthenticated") {
        return "No tens permís per fer aquesta operació. Revisa la sessió i verifica el correu.";
    }
    if (codigo === "functions/not-found") {
        return "La reserva no existeix.";
    }
    if (codigo === "functions/invalid-argument") {
        return "Revisa el servei, la data i l’hora seleccionats.";
    }
    // El servidor ha detectat que alguna condició del servei, horari o data ja no permet reservar.
    if (codigo === "functions/failed-precondition") {
        return "La selecció ja no és vàlida. Revisa les dades i actualitza la disponibilitat.";
    }
    return "No s’ha pogut confirmar la resposta. Revisa les teves cites o reintenta la mateixa sol·licitud.";
}
// Mirar si no sabem el resultat o si el servidor ja ha rebutjat la reserva.
// Rep l’error de la reserva que acabem d’enviar.
// Retorna true si encara podria haver-se guardat; false si el rebuig és conegut.
export function esRespuestaReservaIncierta(error: unknown): boolean {
    // Aquests codis són rebutjos coneguts. Amb altres errors no podem assegurar si la reserva s’ha guardat.
    return !["functions/permission-denied", "functions/unauthenticated", "functions/not-found", "functions/already-exists", "functions/invalid-argument", "functions/failed-precondition", "functions/resource-exhausted"].includes(obtenerCodigoError(error));
}
// Explicar un error dels formularis de gestió sense ensenyar detalls interns.
// Rep un error de consulta o d’un canvi administratiu.
// Retorna un text segur per mostrar a la pantalla de gestió.
export function explicarErrorAdministracion(error: unknown): string {
    const codigo = obtenerCodigoError(error);
    if (codigo.includes("permission-denied") || codigo.includes("unauthenticated")) {
        return "No tens permís per fer aquesta operació. Revisa la sessió.";
    }
    if (codigo.includes("invalid-argument")) {
        return "Revisa les dades del formulari.";
    }
    if (codigo.includes("not-found")) {
        return "El registre ja no existeix. Torna a carregar les dades.";
    }
    // Un horari pot tenir format correcte però deixar fora una cita existent; també ho hem d’explicar.
    if (codigo.includes("failed-precondition")) {
        return "Les dades han canviat o el canvi afecta cites existents. Recarrega i revisa la configuració.";
    }
    return "No s’ha pogut confirmar l’operació. Comprova el resultat abans de repetir-la.";
}
