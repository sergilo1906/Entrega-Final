// Noms que mostrem per a cada estat de cita. Les paraules desades a Firebase es conserven igual.
// Retornar el nom que es veu a la pantalla segons l’estat guardat.
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
