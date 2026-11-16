// Noms que mostrem per a cada estat de cita. Les paraules desades a Firebase es conserven igual.
// Retornar el nom que es veu a la pantalla segons l’estat guardat.
// Rep el text d’estat desat a la cita, per exemple confirmed.
// Retorna l’etiqueta en català; un estat desconegut es mostra com a històric.
export function obtenerEtiquetaEstadoCliente(estado: string): string {
    if (estado === "confirmed") {
        return "Confirmada";
    }
    if (estado === "cancelled") {
        return "Cancel·lada";
    }
    if (estado === "done") {
        return "Completada";
    }
    return "Històrica (només lectura): " + (estado || "sense estat");
}
