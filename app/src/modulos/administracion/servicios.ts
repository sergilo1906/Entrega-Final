// Formularis per crear i editar serveis: nom, durada, preu i si es poden reservar.
import { observarAreaAutorizada, type ContextoAutorizado } from "../../comun/permisos";
import { obtenerCatalogoCompleto } from "../../datos/catalogo";
import { guardarServicio } from "../../datos/funciones-remotas";
import { bloquearFormulario } from "../../comun/formularios";
import { explicarErrorAdministracion } from "../../comun/errores";
import type { ServicioAdministrable } from "../../modelos/agenda";
const formulario = document.querySelector<HTMLFormElement>("#service-create-form")!;
const lista = document.getElementById("services-list")!;
const mensaje = document.getElementById("services-msg")!;
const nombre = document.querySelector<HTMLInputElement>("#service-name")!;
const duracion = document.querySelector<HTMLInputElement>("#service-duration")!;
const precio = document.querySelector<HTMLInputElement>("#service-price")!;
const activo = document.querySelector<HTMLInputElement>("#service-active")!;
let contexto: ContextoAutorizado | null = null;
// Preparem l’ID del servei nou. Si repetim l’enviament, no crearem un segon servei.
let nuevoId = crypto.randomUUID();
let ocupada = false;
// Enviar el servei, tornar a carregar la llista i avisar si s’ha guardat.
async function guardar(item: ServicioAdministrable) {
    const actual = contexto;
    if (!actual?.esVigente() || ocupada) {
        return;
    }
    ocupada = true;
    bloquearFormulario(formulario, true);
    lista.querySelectorAll<HTMLInputElement | HTMLButtonElement>("input, button").forEach(c => {
        c.disabled = true;
    });
    mensaje.textContent = "Desant el servei…";
    try {
        await guardarServicio(item);
        if (!actual.esVigente()) {
            return;
        }
        // Després d’una alta correcta ja podem preparar un ID per al servei següent.
        if (item.id === nuevoId) {
            nuevoId = crypto.randomUUID();
            formulario.reset();
        }
        await cargar(actual);
        if (actual.esVigente()) {
            mensaje.textContent = "Servei desat.";
        }
    }
    catch (error) {
        if (actual.esVigente()) {
            mensaje.textContent = explicarErrorAdministracion(error);
        }
    }
    finally {
        if (actual.esVigente()) {
            ocupada = false;
            bloquearFormulario(formulario, false);
            lista.querySelectorAll<HTMLInputElement | HTMLButtonElement>("input, button").forEach(c => {
                c.disabled = false;
            });
        }
    }
}
// Llegir les dades actuals i mostrar-les només si seguim amb el mateix compte.
async function cargar(actual: ContextoAutorizado) {
    try {
        const catalogo = await obtenerCatalogoCompleto();
        if (!actual.esVigente()) {
            return;
        }
        lista.replaceChildren();
        // Creem un formulari per a cada servei perquè es puguin editar els seus camps.
        for (const item of catalogo) {
            const fila = document.createElement("form");
            fila.className = "border rounded p-3 grid gap-3 sm:grid-cols-2";
            const nombreFila = campo("Nom", item.name, "text");
            const duracionFila = campo("Durada (30 o 60 min)", String(item.durationMin), "number");
            duracionFila.min = "30";
            duracionFila.max = "60";
            duracionFila.step = "30";
            const precioFila = campo("Preu (EUR)", String(item.price), "number");
            precioFila.min = "0";
            precioFila.step = "0.5";
            const etiqueta = document.createElement("label");
            etiqueta.textContent = " Actiu ";
            const activoFila = document.createElement("input");
            activoFila.type = "checkbox";
            activoFila.defaultChecked = item.active;
            etiqueta.prepend(activoFila);
            fila.append(etiqueta);
            const guardarFila = document.createElement("button");
            guardarFila.type = "submit";
            guardarFila.className = "border rounded px-3 py-2";
            guardarFila.textContent = "Desa el servei";
            fila.append(guardarFila);
            // Crear una etiqueta i un camp amb el valor del servei que estem editant.
            function campo(texto: string, valor: string, tipo: string) {
                const etiqueta = document.createElement("label");
                etiqueta.textContent = texto;
                const entrada = document.createElement("input");
                entrada.type = tipo;
                entrada.required = true;
                // Posem el valor inicial del servei al camp; l’usuari després el pot canviar.
                entrada.defaultValue = valor;
                entrada.className = "w-full border rounded px-3 py-2";
                etiqueta.append(entrada);
                fila.append(etiqueta);
                return entrada;
            }
            // Llegim els camps d’aquesta fila i els passem a la mateixa funció de guardar.
            fila.addEventListener("submit", evento => {
                evento.preventDefault();
                void guardar({
                    id: item.id, name: nombreFila.value, durationMin: Number(duracionFila.value), price: Number(precioFila.value), active: activoFila.checked
                });
            });
            lista.append(fila);
        }
        mensaje.textContent = catalogo.length ? "" : "No hi ha serveis.";
    }
    catch (error) {
        if (actual.esVigente()) {
            mensaje.textContent = explicarErrorAdministracion(error);
        }
    }
}
formulario.addEventListener("submit", evento => {
    evento.preventDefault();
    void guardar({
        id: nuevoId, name: nombre.value, durationMin: Number(duracion.value), price: Number(precio.value), active: activo.checked
    });
});
// El botó Recarrega torna a llegir els serveis des de Firestore.
document.getElementById("services-refresh")!.addEventListener("click", () => {
    if (contexto?.esVigente() && !ocupada) {
        void cargar(contexto);
    }
});
observarAreaAutorizada(["admin"], actual => {
    contexto = actual;
    bloquearFormulario(formulario, false);
    void cargar(actual);
}, () => {
    contexto = null;
    ocupada = false;
    nuevoId = crypto.randomUUID();
    formulario.reset();
    bloquearFormulario(formulario, true);
    lista.replaceChildren();
    mensaje.textContent = "";
});
