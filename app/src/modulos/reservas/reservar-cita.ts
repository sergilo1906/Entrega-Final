import { observarAreaAutorizada, type ContextoAutorizado } from "../../comun/permisos";
import { obtenerServicios } from "../../datos/catalogo";
import { obtenerConfiguracionAgenda } from "../../datos/configuracion";
import { consultarDisponibilidad, solicitarReserva } from "../../datos/funciones-remotas";
import { formatearFechaNegocio, sumarDiasCalendario } from "../../comun/fechas";
import { explicarErrorReserva, esRespuestaReservaIncierta } from "../../comun/errores";
import type { SolicitudReserva } from "../../modelos/agenda";
const servicio = document.querySelector<HTMLSelectElement>("#service-select")!;
const fecha = document.querySelector<HTMLInputElement>("#date-select")!;
const lista = document.getElementById("slots-list")!;
const mensaje = document.getElementById("slots-msg")!;
const exito = document.getElementById("booking-success")!;
const resumen = document.getElementById("booking-summary")!;
const reintentar = document.querySelector<HTMLButtonElement>("#booking-retry")!;
let contexto: ContextoAutorizado | null = null;
let revision = 0;
let ocupada = false;
let pendiente: SolicitudReserva | null = null;
function clave() {
    return "barberpro-reserva-" + contexto!.usuario.uid;
}
function guardarPendiente() {
    try {
        if (pendiente) {
            sessionStorage.setItem(clave(), JSON.stringify(pendiente));
        }
        else {
            sessionStorage.removeItem(clave());
        }
    }
    catch { /* La sol·licitud es conserva en memòria. */
    }
}
function bloquear(valor: boolean) {
    ocupada = valor;
    // Si no sabem el resultat, primer resolem la mateixa sol·licitud.
    servicio.disabled = valor || pendiente !== null;
    fecha.disabled = valor || pendiente !== null;
    reintentar.disabled = valor;
    lista.querySelectorAll("button").forEach(boton => {
        boton.disabled = valor || pendiente !== null;
    });
}
// Conservem la sol·licitud fins a saber-ne el resultat per evitar duplicats.
async function reservar(datos: SolicitudReserva) {
    const actual = contexto;
    if (!actual?.esVigente() || ocupada) {
        return;
    }
    pendiente = datos;
    guardarPendiente();
    bloquear(true);
    mensaje.textContent = "Confirmant la reserva…";
    try {
        const resultado = await solicitarReserva(datos);
        if (!actual.esVigente()) {
            return;
        }
        pendiente = null;
        guardarPendiente();
        reintentar.hidden = true;
        if (resultado.status === "confirmed") {
            resumen.textContent = "Cita confirmada: " + datos.dateStr + " a les " + datos.timeStr;
        }
        else if (resultado.status === "cancelled") {
            resumen.textContent = "Aquesta sol·licitud correspon a una cita cancel·lada. Consulta Les meves cites.";
        }
        else {
            resumen.textContent = "Aquesta sol·licitud correspon a una cita completada. Consulta Les meves cites.";
        }
        exito.classList.remove("hidden");
        mensaje.textContent = "";
        lista.replaceChildren();
    }
    catch (error) {
        if (!actual.esVigente()) {
            return;
        }
        mensaje.textContent = explicarErrorReserva(error);
        reintentar.hidden = !esRespuestaReservaIncierta(error);
        if (reintentar.hidden) {
            pendiente = null;
            guardarPendiente();
            lista.replaceChildren();
        }
    }
    finally {
        if (actual.esVigente()) {
            bloquear(false);
        }
    }
}
// Descartem consultes anteriors si canvia el servei o la data.
async function cargarHoras() {
    const actual = contexto;
    if (!actual?.esVigente() || ocupada) {
        return;
    }
    const consulta = ++revision;
    lista.replaceChildren();
    exito.classList.add("hidden");
    // Una selecció nova inicia una sol·licitud; els reintents conserven l’ID.
    pendiente = null;
    guardarPendiente();
    reintentar.hidden = true;
    if (!servicio.value || !fecha.value) {
        mensaje.textContent = "Tria un servei i una data.";
        return;
    }
    mensaje.textContent = "Consultant la disponibilitat…";
    try {
        const datos = { serviceId: servicio.value, dateStr: fecha.value };
        const resultado = await consultarDisponibilidad(datos);
        if (!actual.esVigente() || consulta !== revision) {
            return;
        }
        mensaje.textContent = resultado.slots.length ? "Tria una hora per confirmar la cita." : "No hi ha hores disponibles per a aquesta data.";
        for (const hueco of resultado.slots) {
            const boton = document.createElement("button");
            boton.type = "button";
            boton.textContent = hueco.timeStr;
            boton.className = "rounded border border-blue-300 px-3 py-2 hover:bg-blue-50";
            boton.addEventListener("click", () => void reservar({
                ...datos, timeStr: hueco.timeStr, requestId: crypto.randomUUID()
            }));
            lista.append(boton);
        }
    }
    catch (error) {
        if (actual.esVigente() && consulta === revision) {
            mensaje.textContent = explicarErrorReserva(error);
        }
    }
}
servicio.addEventListener("change", () => void cargarHoras());
fecha.addEventListener("change", () => void cargarHoras());
reintentar.addEventListener("click", () => {
    if (pendiente) {
        void reservar(pendiente);
    }
});
observarAreaAutorizada(["client", "admin"], actual => {
    contexto = actual;
    void (async () => {
        try {
            const [catalogo, config] = await Promise.all([obtenerServicios(), obtenerConfiguracionAgenda()]);
            if (!actual.esVigente()) {
                return;
            }
            servicio.replaceChildren(new Option("Tria un servei", ""));
            for (const item of catalogo) {
                servicio.add(new Option(item.name + " · " + item.durationMin + " min · " + item.price + " EUR", item.id));
            }
            fecha.min = formatearFechaNegocio(config.timezone);
            fecha.max = sumarDiasCalendario(fecha.min, 30);
            document.getElementById("booking-zone")!.textContent = config.timezone;
            document.getElementById("booking-professional")!.textContent = config.professionalName || "Professional principal";
            mensaje.textContent = catalogo.length ? "Tria un servei i una data." : "No hi ha serveis actius.";
            bloquear(false);
            try {
                const guardada = JSON.parse(sessionStorage.getItem(clave()) || "null");
                if (guardada && typeof guardada.serviceId === "string" && typeof guardada.dateStr === "string" && typeof guardada.timeStr === "string" && typeof guardada.requestId === "string") {
                    pendiente = guardada;
                    servicio.value = guardada.serviceId;
                    fecha.value = guardada.dateStr;
                    reintentar.hidden = false;
                    mensaje.textContent = "Hi ha una sol·licitud sense confirmar. Reintenta-la per consultar-ne el resultat sense duplicar-la.";
                    bloquear(false);
                }
            }
            catch { /* No executem una sol·licitud malmesa. */
            }
        }
        catch (error) {
            if (actual.esVigente()) {
                mensaje.textContent = explicarErrorReserva(error);
            }
        }
    })();
}, () => {
    revision++;
    contexto = null;
    pendiente = null;
    bloquear(true);
    lista.replaceChildren();
    servicio.replaceChildren();
    fecha.value = "";
    mensaje.textContent = "";
    resumen.textContent = "";
    exito.classList.add("hidden");
    reintentar.hidden = true;
});
