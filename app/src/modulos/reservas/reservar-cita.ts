// Preparem el selector de serveis, consultem hores i enviem la reserva escollida.
import { observarAreaAutorizada, type ContextoAutorizado } from "../../comun/permisos";
import { obtenerServicios } from "../../datos/catalogo";
import { obtenerConfiguracionAgenda } from "../../datos/configuracion";
import { consultarDisponibilidad, solicitarReserva } from "../../datos/funciones-remotas";
import { formatearFechaNegocio, sumarDiasCalendario } from "../../comun/fechas";
import { explicarErrorReserva, esRespuestaReservaIncierta } from "../../comun/errores";
import type { SolicitudReserva } from "../../modelos/agenda";
// Agafem els controls de l’HTML per llegir la selecció i escriure el resultat.
// El ! final indica a TypeScript que aquest control existeix en aquesta pàgina.
const servicio = document.querySelector<HTMLSelectElement>("#service-select")!;
const fecha = document.querySelector<HTMLInputElement>("#date-select")!;
const lista = document.getElementById("slots-list")!;
const mensaje = document.getElementById("slots-msg")!;
const exito = document.getElementById("booking-success")!;
const resumen = document.getElementById("booking-summary")!;
const reintentar = document.querySelector<HTMLButtonElement>("#booking-retry")!;
// Guardem quin compte està fent servir la pantalla i si té una petició en marxa.
let contexto: ContextoAutorizado | null = null;
// Aquest comptador correspon a consultes de disponibilitat, no al número de canvi que guarda el servidor.
let revision = 0;
let ocupada = false;
let pendiente: SolicitudReserva | null = null;
// Preparar una clau diferent per guardar la sol·licitud de cada usuari.
// No rep paràmetres: utilitza el UID del compte autoritzat actual.
// Retorna la clau de sessionStorage que separa la reserva pendent de cada compte.
function clave() {
    return "barberpro-reserva-" + contexto!.usuario.uid;
}
// Guardar la sol·licitud a la pestanya o esborrar-la quan ja s’ha resolt.
// No rep paràmetres: utilitza la sol·licitud pendent del mòdul.
// No retorna dades: la desa a la pestanya o treu la clau quan ja no n’hi ha cap.
function guardarPendiente() {
    try {
        if (pendiente) {
            // Convertim l’objecte a JSON perquè l’emmagatzematge del navegador desa text.
            sessionStorage.setItem(clave(), JSON.stringify(pendiente));
        }
        else {
            // Quan ja coneixem el resultat traiem la petició guardada, perquè no es recuperi en recarregar.
            sessionStorage.removeItem(clave());
        }
    }
    catch { /* La sol·licitud es conserva en memòria. */
    }
}
// Bloquejar la selecció mentre es guarda o mentre hi ha una reserva amb resultat desconegut.
// Rep true per bloquejar controls o false per tornar-los a activar.
// No retorna dades: canvia disabled i l’estat de petició en curs del mòdul.
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
// Enviar la reserva i conservar la mateixa sol·licitud si encara no en sabem el resultat.
// Rep les dades de la intenció de reserva, incloent un requestId.
// La promesa mostra el resultat o conserva les dades per poder repetir la mateixa petició.
async function reservar(datos: SolicitudReserva) {
    const actual = contexto;
    // No enviem una altra operació mentre la pantalla no estigui autoritzada o ja hi hagi una petició en curs.
    if (!actual?.esVigente() || ocupada) {
        return;
    }
    // Conservem les dades abans d’enviar-les per poder repetir la mateixa petició si falla la resposta.
    pendiente = datos;
    guardarPendiente();
    bloquear(true);
    mensaje.textContent = "Confirmant la reserva…";
    try {
        // Esperem la resposta real del servidor abans de mostrar la confirmació.
        const resultado = await solicitarReserva(datos);
        if (!actual.esVigente()) {
            return;
        }
        // Una resposta coneguda permet deixar de conservar la intenció com a pendent.
        pendiente = null;
        guardarPendiente();
        reintentar.hidden = true;
        // Un reintent pot retornar una cita que després s’ha cancel·lat; mostrem l’estat que retorna el servidor.
        if (resultado.status === "confirmed") {
            resumen.textContent = "Cita confirmada: " + datos.dateStr + " a les " + datos.timeStr;
        }
        // Un reintent d’una cita cancel·lada ha de mostrar aquell estat, no anunciar una reserva nova.
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
        // Només oferim reintentar la mateixa sol·licitud si encara no en sabem el resultat.
        reintentar.hidden = !esRespuestaReservaIncierta(error);
        // Si el rebuig és segur, eliminem la intenció pendent i deixem que l’usuari faci una selecció nova.
        if (reintentar.hidden) {
            pendiente = null;
            guardarPendiente();
            lista.replaceChildren();
        }
    }
    finally {
        // El finally recupera els controls encara que el servidor hagi retornat un error.
        if (actual.esVigente()) {
            bloquear(false);
        }
    }
}
// Consultar les hores del servei i la data triats i crear un botó per cada hora lliure.
// No rep paràmetres: llegeix el servei i la data seleccionats.
// La promesa actualitza els botons d’hora o explica per què no s’han pogut consultar.
async function cargarHoras() {
    const actual = contexto;
    // No enviem una altra operació mentre la pantalla no estigui autoritzada o ja hi hagi una petició en curs.
    if (!actual?.esVigente() || ocupada) {
        return;
    }
    // Així podem descartar una resposta si el servei o la data han canviat abans que arribi.
    const consulta = ++revision;
    // Abans de consultar un altre servei o dia retirem els botons i el resultat de la consulta anterior.
    lista.replaceChildren();
    exito.classList.add("hidden");
    // Una selecció nova inicia una sol·licitud; els reintents conserven l’ID.
    pendiente = null;
    guardarPendiente();
    reintentar.hidden = true;
    // No consultem disponibilitat fins que s’han escollit tant el servei com la data.
    if (!servicio.value || !fecha.value) {
        mensaje.textContent = "Tria un servei i una data.";
        return;
    }
    mensaje.textContent = "Consultant la disponibilitat…";
    try {
        const datos = { serviceId: servicio.value, dateStr: fecha.value };
        const resultado = await consultarDisponibilidad(datos);
        // La resposta només serveix si encara és del mateix compte i de l’última selecció.
        if (!actual.esVigente() || consulta !== revision) {
            return;
        }
        mensaje.textContent = resultado.slots.length ? "Tria una hora per confirmar la cita." : "No hi ha hores disponibles per a aquesta data.";
        // Recorrem les hores lliures i creem un botó per a cadascuna.
        for (const hueco of resultado.slots) {
            const boton = document.createElement("button");
            boton.type = "button";
            // El text del botó mostra l’hora retornada; no fem servir hores inventades al navegador.
            boton.textContent = hueco.timeStr;
            boton.className = "rounded border border-blue-300 px-3 py-2 hover:bg-blue-50";
            boton.addEventListener("click", () => void reservar({
                // Cada intenció nova té un requestId; en reintentar conservem aquest mateix valor.
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
// Canviar servei o data torna a consultar les hores. El botó de reintentar conserva la petició anterior.
// void indica que aquí no utilitzem el valor retornat; la mateixa funció gestiona la resposta i els errors.
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
            // Carreguem catàleg i configuració alhora perquè són dues lectures independents.
            const [catalogo, config] = await Promise.all([obtenerServicios(), obtenerConfiguracionAgenda()]);
            if (!actual.esVigente()) {
                return;
            }
            servicio.replaceChildren(new Option("Tria un servei", ""));
            for (const item of catalogo) {
                servicio.add(new Option(item.name + " · " + item.durationMin + " min · " + item.price + " EUR", item.id));
            }
            // El selector mostra el límit al client, però el servidor també el comprova quan es reserva.
            fecha.min = formatearFechaNegocio(config.timezone);
            fecha.max = sumarDiasCalendario(fecha.min, 30);
            document.getElementById("booking-zone")!.textContent = config.timezone;
            document.getElementById("booking-professional")!.textContent = config.professionalName || "Professional principal";
            mensaje.textContent = catalogo.length ? "Tria un servei i una data." : "No hi ha serveis actius.";
            bloquear(false);
            try {
                // En recarregar la pestanya podem recuperar una sol·licitud que havia quedat sense resposta.
                const guardada = JSON.parse(sessionStorage.getItem(clave()) || "null");
                // Només recuperem una sol·licitud guardada si els quatre camps tenen la forma esperada.
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
    // En perdre l’accés invalidem respostes pendents i netegem tot el que havia carregat el compte.
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
