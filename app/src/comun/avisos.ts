// Avisos curts que surten a la pantalla quan acabem una operació.
import type { TipoAviso } from "../modelos/interfaz";
// Mostrar un missatge uns segons i després treure’l de la pantalla.
// Rep el text i el tipus d’avís; si no indiquem tipus, és informatiu.
// No retorna dades: afegeix un avís temporal al document.
export function mostrarAviso(mensaje: string, tipo: TipoAviso = "info"): void {
    let contenedor = document.getElementById("toast-root");
    // Creem la zona d’avisos la primera vegada i la reutilitzem per als següents.
    if (!contenedor) {
        contenedor = document.createElement("div");
        contenedor.id = "toast-root";
        contenedor.className = "fixed bottom-4 right-4 z-[120] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2 sm:w-auto";
        // Aquest rol permet que el missatge també s’anunciï a qui utilitza un lector de pantalla.
        contenedor.setAttribute("role", "status");
        document.body.append(contenedor);
    }
    const aviso = document.createElement("div");
    let colores = "border-slate-300 bg-white text-slate-900";
    if (tipo === "success") {
        colores = "border-green-300 bg-green-50 text-green-900";
    }
    if (tipo === "error") {
        colores = "border-red-300 bg-red-50 text-red-900";
    }
    aviso.className = "rounded-lg border px-3 py-2 text-sm shadow transition-opacity duration-200 " + colores;
    // textContent mostra el text sense interpretar-lo com a HTML.
    aviso.textContent = mensaje;
    contenedor.append(aviso);
    // Al cap de tres segons comencem a amagar l’avís; després el traiem del document.
    setTimeout(() => {
        aviso.classList.add("opacity-0");
        setTimeout(() => aviso.remove(), 180);
    }, 3000);
}
