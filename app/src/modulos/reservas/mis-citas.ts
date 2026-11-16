// Compartim el llistat entre Les meves cites i Agenda. Canvien la consulta i els botons segons el rol.
import { observarAreaAutorizada, type ContextoAutorizado } from "../../comun/permisos";
import { obtenerCitasUsuario, obtenerCitasDia } from "../../datos/agenda";
import { cancelarReserva, completarReserva } from "../../datos/funciones-remotas";
import { obtenerConfiguracionAgenda } from "../../datos/configuracion";
import { formatearFechaNegocio, obtenerInicioCita } from "../../comun/fechas";
import { obtenerEtiquetaEstadoCliente } from "../../comun/estados-cita";
import { explicarErrorAdministracion } from "../../comun/errores";
import type { Cita } from "../../modelos/agenda";
// Preparar el mateix llistat per a un client o per a l’administrador.
// Rep true per a l’agenda admin o false per a les cites pròpies.
// No retorna dades: prepara filtres, botons i consultes que reutilitzen el mateix llistat.
export function iniciarListado(administrador: boolean): void {
    const lista = document.getElementById(administrador ? "agenda-list" : "my-list")!;
    const mensaje = document.getElementById(administrador ? "agenda-msg" : "my-msg")!;
    const fecha = document.querySelector<HTMLInputElement>(administrador ? "#agenda-date" : "#filter-date")!;
    const estado = document.querySelector<HTMLSelectElement>(administrador ? "#agenda-status" : "#filter-status")!;
    let contexto: ContextoAutorizado | null = null;
    let zona = "Europe/Madrid";
    let revision = 0;
    // Conservem la llista llegida per poder aplicar filtres sense canviar les dades guardades.
    let citas: Cita[] = [];
    let procesando = false;
    fecha.disabled = true;
    // Aplicar els filtres i crear les targetes amb els botons permesos.
    // No rep paràmetres: fa servir les cites i els filtres que tenim al mòdul.
    // No retorna dades: buida el llistat anterior i crea les targetes visibles.
    function pintar() {
        lista.replaceChildren();
        // Ens quedem només les cites que coincideixen amb la data i l’estat triats.
        const visibles = citas.filter(cita => (!fecha.value || cita.dateStr === fecha.value) && (estado.value === "all" || cita.status === estado.value));
        mensaje.textContent = visibles.length ? "" : "No hi ha cites amb aquests filtres.";
        for (const cita of visibles) {
            const tarjeta = document.createElement("article");
            tarjeta.className = "p-3 space-y-2";
            // La targeta queda associada al document exacte; així el botó actua sobre aquella cita.
            tarjeta.dataset.bookingId = cita.id;
            const titulo = document.createElement("h3");
            titulo.className = "font-semibold";
            titulo.textContent = cita.dateStr + " · " + cita.timeStr + " · " + (cita.serviceSnapshot?.name || "Servei històric");
            const datos = document.createElement("p");
            // Mostrem l’estat llegible i el preu i durada que consten a la còpia del servei.
            datos.textContent = obtenerEtiquetaEstadoCliente(cita.status) + " · " + cita.durationMin + " min · " + (cita.serviceSnapshot?.price ?? "—") + " EUR";
            tarjeta.append(titulo, datos);
            // Només l’agenda de l’administrador mostra les dades de contacte de la cita.
            if (administrador) {
                const cliente = document.createElement("p");
                cliente.textContent = [cita.userName, cita.userEmail, cita.userPhone].filter(Boolean).join(" · ");
                tarjeta.append(cliente);
            }
            // Els altres estats es poden llegir, però no tenen botons per tornar-los a modificar.
            if (cita.status === "confirmed") {
                if (administrador) {
                    accion("Marca com a completada", () => completarReserva(cita.id));
                }
                // El client només veu el botó de cancel·lar si la cita encara no ha començat.
                if (administrador || obtenerInicioCita(cita, zona).getTime() > Date.now()) {
                    accion("Cancel·la la cita", () => cancelarReserva(cita.id));
                }
            }
            // Crear un botó de cita que demana confirmació abans d’enviar el canvi.
            // Rep el text del botó i la funció que farà la petició al servidor.
            // No retorna dades: afegeix el botó a la targeta de cita actual.
            function accion(texto: string, ejecutar: () => Promise<unknown>) {
                const boton = document.createElement("button");
                boton.type = "button";
                boton.textContent = texto;
                boton.className = "border rounded px-3 py-2 mr-2";
                // Mentre un canvi està en curs, les altres accions del llistat també queden desactivades.
                boton.disabled = procesando;
                boton.addEventListener("click", async () => {
                    const actual = contexto;
                    // Demanem confirmació i evitem que es facin dos canvis mentre el primer encara s’està guardant.
                    if (!actual?.esVigente() || procesando || !window.confirm(texto + "?")) {
                        return;
                    }
                    procesando = true;
                    pintar();
                    try {
                        // Primer esperem el canvi real; després tornem a consultar per mostrar l’estat guardat.
                        await ejecutar();
                        if (actual.esVigente()) {
                            await cargar();
                        }
                    }
                    catch (error) {
                        if (actual.esVigente()) {
                            mensaje.textContent = explicarErrorAdministracion(error);
                        }
                    }
                    finally {
                        if (actual.esVigente()) {
                            procesando = false;
                            lista.querySelectorAll("button").forEach(b => {
                                b.disabled = false;
                            });
                        }
                    }
                });
                tarjeta.append(boton);
            }
            lista.append(tarjeta);
        }
    }
    // Llegir les dades actuals i mostrar-les només si seguim amb el mateix compte.
    // No rep paràmetres: utilitza el compte autoritzat, el mode del llistat i la data actual.
    // La promesa llegeix les cites i actualitza la pantalla només si la consulta continua vigent.
    async function cargar() {
        const actual = contexto;
        // Numerem les consultes per no mostrar una data antiga si l’administrador en tria una altra ràpidament.
        const consulta = ++revision;
        if (!actual?.esVigente()) {
            return;
        }
        mensaje.textContent = "Carregant les cites…";
        lista.replaceChildren();
        try {
            // L’administrador consulta per data; el client consulta només pel seu propi identificador.
            const resultado = administrador ? await obtenerCitasDia(fecha.value) : await obtenerCitasUsuario(actual.usuario.uid);
            if (!actual.esVigente() || consulta !== revision) {
                return;
            }
            // Substituïm la llista en memòria amb la resposta actual i després la representem.
            citas = resultado;
            pintar();
        }
        catch (error) {
            if (actual.esVigente() && consulta === revision) {
                mensaje.textContent = explicarErrorAdministracion(error);
            }
        }
    }
    // A Agenda canviem la consulta; a Les meves cites filtrem la llista que ja hem carregat.
    fecha.addEventListener("change", () => {
        if (administrador) {
            void cargar();
        }
        else {
            pintar();
        }
    });
    // El filtre d’estat només afecta la presentació; no modifica cap cita.
    estado.addEventListener("change", pintar);
    observarAreaAutorizada(administrador ? ["admin"] : ["client", "admin"], actual => {
        contexto = actual;
        void (async () => {
            try {
                const config = await obtenerConfiguracionAgenda();
                if (!actual.esVigente()) {
                    return;
                }
                zona = config.timezone;
                if (administrador) {
                    fecha.value = formatearFechaNegocio(zona);
                }
                fecha.disabled = false;
                await cargar();
            }
            catch (error) {
                if (actual.esVigente()) {
                    mensaje.textContent = explicarErrorAdministracion(error);
                }
            }
        })();
    }, () => {
        revision++;
        contexto = null;
        citas = [];
        procesando = false;
        fecha.disabled = true;
        fecha.value = "";
        lista.replaceChildren();
        mensaje.textContent = "";
    });
}
if (document.getElementById("my-list")) {
    iniciarListado(false);
}
