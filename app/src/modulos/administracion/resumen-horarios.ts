// Llegim els camps d’Horari i enviem els canvis al servidor. També podem tancar o reobrir un dia.
import { observarAreaAutorizada, type ContextoAutorizado } from "../../comun/permisos";
import { obtenerConfiguracionAgenda, obtenerDiasCerrados } from "../../datos/configuracion";
import { guardarHorario, cerrarDia } from "../../datos/funciones-remotas";
import { bloquearFormulario } from "../../comun/formularios";
import { explicarErrorAdministracion } from "../../comun/errores";
import type { DiaHorario } from "../../modelos/agenda";
const formulario = document.querySelector<HTMLFormElement>("#schedule-form")!;
const cierre = document.querySelector<HTMLFormElement>("#closed-form")!;
const zona = document.querySelector<HTMLInputElement>("#schedule-zone")!;
const mensaje = document.getElementById("hours-msg")!;
const mensajeCierre = document.getElementById("closed-msg")!;
const dias = Array.from(document.querySelectorAll<HTMLFieldSetElement>("[data-day]"));
let contexto: ContextoAutorizado | null = null;
let ocupada = false;
// Bloquejar els dos formularis mentre es guarda un canvi.
// Rep true per bloquejar controls o false per tornar-los a activar.
// No retorna dades: canvia disabled i l’estat de petició en curs del mòdul.
function bloquear(valor: boolean) {
    ocupada = valor;
    bloquearFormulario(formulario, valor);
    bloquearFormulario(cierre, valor);
}
// Recórrer els set dies i recollir les franges que s’han escrit al formulari.
// No rep paràmetres: recorre els fieldset del formulari d’horari.
// Retorna els set dies amb active i les franges que s’han emplenat.
function leerDias(): DiaHorario[] {
    const resultado: DiaHorario[] = [];
    // Cada fila és un dia de la setmana; recollim si està obert i les dues possibles franges.
    for (const fila of dias) {
        const active = fila.querySelector<HTMLInputElement>("[data-active]")!.checked;
        // Comencem sense franges i afegim només les que s’han emplenat en aquest dia.
        const ranges: DiaHorario["ranges"] = [];
        // El formulari ofereix dues franges com a màxim; l’índex tria els camps 0 i 1.
        for (let indice = 0; indice < 2; indice++) {
            const start = fila.querySelector<HTMLInputElement>('[data-start="' + indice + '"]')!.value;
            const end = fila.querySelector<HTMLInputElement>('[data-end="' + indice + '"]')!.value;
            // Si s’ha omplert algun extrem, enviem la franja perquè el servidor comprovi si està completa.
            if (start || end) {
                ranges.push({ start, end });
            }
        }
        // Guardem també els dies tancats per mantenir les set posicions de la setmana.
        resultado.push({ active, ranges });
    }
    return resultado;
}
// Buidar la llista i afegir les dates que estan tancades.
// Rep el context autoritzat per comprovar que encara és el mateix compte.
// La promesa omple la llista de dates; si el context ha canviat, descarta el resultat.
async function listarCierres(actual: ContextoAutorizado) {
    const fechas = await obtenerDiasCerrados();
    if (!actual.esVigente()) {
        return;
    }
    const lista = document.getElementById("closed-list")!;
    // El llistat es reconstrueix, en lloc d’afegir dates duplicades a cada recàrrega.
    lista.replaceChildren();
    for (const fecha of fechas) {
        const li = document.createElement("li");
        li.textContent = fecha;
        lista.append(li);
    }
}
// Fer una operació i esperar que acabi abans de tornar a activar els controls.
// Rep l’operació que retorna una promesa i l’element on mostrarem l’avís.
// La promesa espera el canvi, actualitza el llistat i recupera els controls.
async function ejecutar(operacion: () => Promise<unknown>, aviso: HTMLElement) {
    const actual = contexto;
    // Comprovem l’autorització i que no hi hagi un altre canvi pendent abans de bloquejar els formularis.
    if (!actual?.esVigente() || ocupada) {
        return;
    }
    bloquear(true);
    aviso.textContent = "Desant…";
    try {
        // Esperem el servidor abans d’avisar que s’ha guardat el canvi.
        await operacion();
        if (actual.esVigente()) {
            await listarCierres(actual);
            if (actual.esVigente()) {
                aviso.textContent = "Canvis desats.";
            }
        }
    }
    catch (error) {
        if (actual.esVigente()) {
            aviso.textContent = explicarErrorAdministracion(error);
        }
    }
    finally {
        if (actual.esVigente()) {
            bloquear(false);
        }
    }
}
// Enviar l’horari no recarrega la pàgina: llegim els camps i cridem el servidor.
formulario.addEventListener("submit", evento => {
    evento.preventDefault();
    // Enviem una estructura de dades, no l’HTML del formulari.
    const datos = { timezone: zona.value, days: leerDias() };
    void ejecutar(() => guardarHorario(datos), mensaje);
});
// Aquest segon formulari envia només una data i si la volem tancada o oberta.
cierre.addEventListener("submit", evento => {
    evento.preventDefault();
    const fecha = document.querySelector<HTMLInputElement>("#closed-date")!.value;
    // La mateixa pantalla serveix per tancar i reobrir; el valor de la casella decideix l’operació.
    const closed = document.querySelector<HTMLInputElement>("#closed-state")!.checked;
    void ejecutar(() => cerrarDia(fecha, closed), mensajeCierre);
});
observarAreaAutorizada(["admin"], actual => {
    contexto = actual;
    void (async () => {
        try {
            const config = await obtenerConfiguracionAgenda();
            if (!actual.esVigente()) {
                return;
            }
            zona.value = config.timezone;
            // Omplim cada dia del formulari amb les dades guardades, de diumenge a dissabte.
            dias.forEach((fila, i) => {
                fila.querySelector<HTMLInputElement>("[data-active]")!.checked = config.days[i].active;
                // Si la segona franja no existeix a la configuració, deixem els seus dos camps buits.
                [0, 1].forEach(j => {
                    fila.querySelector<HTMLInputElement>('[data-start="' + j + '"]')!.value = config.days[i].ranges[j]?.start || "";
                    fila.querySelector<HTMLInputElement>('[data-end="' + j + '"]')!.value = config.days[i].ranges[j]?.end || "";
                });
            });
            await listarCierres(actual);
        }
        catch (error) {
            if (actual.esVigente()) {
                mensaje.textContent = explicarErrorAdministracion(error);
            }
        }
        finally {
            if (actual.esVigente()) {
                bloquear(false);
            }
        }
    })();
}, () => {
    contexto = null;
    bloquear(true);
    formulario.reset();
    cierre.reset();
    mensaje.textContent = "";
    mensajeCierre.textContent = "";
    document.getElementById("closed-list")!.replaceChildren();
});
