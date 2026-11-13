import { observarAreaAutorizada, type ContextoAutorizado } from "../../comun/permisos";
import { obtenerCitasUsuario, obtenerCitasDia } from "../../datos/agenda";
import { cancelarReserva, completarReserva } from "../../datos/funciones-remotas";
import { obtenerConfiguracionAgenda } from "../../datos/configuracion";
import { formatearFechaNegocio, obtenerInicioCita } from "../../comun/fechas";
import { obtenerEtiquetaEstadoCliente } from "../../comun/estados-cita";
import { explicarErrorAdministracion } from "../../comun/errores";
import type { Cita } from "../../modelos/agenda";
// Les meves cites i Agenda comparteixen el llistat i les accions bàsiques.
export function iniciarListado(administrador: boolean): void {
    const lista = document.getElementById(administrador ? "agenda-list" : "my-list")!;
    const mensaje = document.getElementById(administrador ? "agenda-msg" : "my-msg")!;
    const fecha = document.querySelector<HTMLInputElement>(administrador ? "#agenda-date" : "#filter-date")!;
    const estado = document.querySelector<HTMLSelectElement>(administrador ? "#agenda-status" : "#filter-status")!;
    let contexto: ContextoAutorizado | null = null;
    let zona = "Europe/Madrid";
    let revision = 0;
    let citas: Cita[] = [];
    let procesando = false;
    fecha.disabled = true;
    // Mostrem les cites autoritzades i les accions que permet el seu estat.
    function pintar() {
        lista.replaceChildren();
        const visibles = citas.filter(cita => (!fecha.value || cita.dateStr === fecha.value) && (estado.value === "all" || cita.status === estado.value));
        mensaje.textContent = visibles.length ? "" : "No hi ha cites amb aquests filtres.";
        for (const cita of visibles) {
            const tarjeta = document.createElement("article");
            tarjeta.className = "p-3 space-y-2";
            tarjeta.dataset.bookingId = cita.id;
            const titulo = document.createElement("h3");
            titulo.className = "font-semibold";
            titulo.textContent = cita.dateStr + " · " + cita.timeStr + " · " + (cita.serviceSnapshot?.name || "Servei històric");
            const datos = document.createElement("p");
            datos.textContent = obtenerEtiquetaEstadoCliente(cita.status) + " · " + cita.durationMin + " min · " + (cita.serviceSnapshot?.price ?? "—") + " EUR";
            tarjeta.append(titulo, datos);
            if (administrador) {
                const cliente = document.createElement("p");
                cliente.textContent = [cita.userName, cita.userEmail, cita.userPhone].filter(Boolean).join(" · ");
                tarjeta.append(cliente);
            }
            if (cita.status === "confirmed") {
                if (administrador) {
                    accion("Marca com a completada", () => completarReserva(cita.id));
                }
                if (administrador || obtenerInicioCita(cita, zona).getTime() > Date.now()) {
                    accion("Cancel·la la cita", () => cancelarReserva(cita.id));
                }
            }
            function accion(texto: string, ejecutar: () => Promise<unknown>) {
                const boton = document.createElement("button");
                boton.type = "button";
                boton.textContent = texto;
                boton.className = "border rounded px-3 py-2 mr-2";
                boton.disabled = procesando;
                boton.addEventListener("click", async () => {
                    const actual = contexto;
                    if (!actual?.esVigente() || procesando || !window.confirm(texto + "?")) {
                        return;
                    }
                    procesando = true;
                    pintar();
                    try {
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
    // El client consulta només el seu UID; l’agenda demana administrador.
    async function cargar() {
        const actual = contexto;
        const consulta = ++revision;
        if (!actual?.esVigente()) {
            return;
        }
        mensaje.textContent = "Carregant les cites…";
        lista.replaceChildren();
        try {
            const resultado = administrador ? await obtenerCitasDia(fecha.value) : await obtenerCitasUsuario(actual.usuario.uid);
            if (!actual.esVigente() || consulta !== revision) {
                return;
            }
            citas = resultado;
            pintar();
        }
        catch (error) {
            if (actual.esVigente() && consulta === revision) {
                mensaje.textContent = explicarErrorAdministracion(error);
            }
        }
    }
    fecha.addEventListener("change", () => {
        if (administrador) {
            void cargar();
        }
        else {
            pintar();
        }
    });
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
