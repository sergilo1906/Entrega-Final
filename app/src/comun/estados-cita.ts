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
