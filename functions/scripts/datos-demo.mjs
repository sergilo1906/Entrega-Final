// Preparem noms, serveis i cites fictícies per ensenyar la web. No reiniciem les dades que ja existeixen.
import fs from "node:fs";
import path from "node:path";
import { randomBytes, createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { obtenerServiciosAdministrativos, comprobarEntornoLocal } from "../src/firebase.js";
import { validarHorario } from "../src/horarios.js";
import { obtenerConfiguracionAgenda, actualizarControlAgenda, UID_PROFESIONAL } from "../src/configuracion.js";
import { cargarServicio, cargarOcupacion, calcularHorasLibres } from "../src/disponibilidad.js";
import { crearReserva, cambiarEstado } from "../src/persistencia-reservas.js";
import { comprobarIdentidadTransaccion } from "../src/permisos.js";
import { formatearFechaZona, sumarDiasCalendario, obtenerIntervaloUtc, convertirHoraAMinutos, convertirMinutosAHora } from "../src/fechas.js";
// La marca permet distingir aquests documents ficticis de qualsevol dada que ja existís al projecte.
export const MARCA_DEMO = "m13-entrega-final";
// Noms ficticis que es faran servir a la mostra, no dades de clients reals.
export const CLIENTES = [
    { clave: "laia-soler", nombre: "Laia Soler" },
    { clave: "pau-rovira", nombre: "Pau Rovira" },
    { clave: "julia-font", nombre: "Júlia Font" },
    { clave: "arnau-puig", nombre: "Arnau Puig" },
    { clave: "mariona-valls", nombre: "Mariona Valls" },
    { clave: "nil-casals", nombre: "Nil Casals" },
];
// Aquests sis administradors només es creen en LOCAL, no al projecte WEB.
export const ADMINISTRADORES_LOCALES = [
    { clave: "marta-roca", nombre: "Marta Roca" },
    { clave: "jordi-vidal", nombre: "Jordi Vidal" },
    { clave: "nuria-pons", nombre: "Núria Pons" },
    { clave: "pere-casas", nombre: "Pere Casas" },
    { clave: "anna-ferrer", nombre: "Anna Ferrer" },
    { clave: "oriol-serra", nombre: "Oriol Serra" },
];
export const SERVICIOS = [
    {
        id: "m13-demo-cabell", name: "Tall de cabell", durationMin: 30, price: 15
    },
    {
        id: "m13-demo-barba", name: "Arreglar barba", durationMin: 30, price: 10
    },
    {
        id: "m13-demo-complet", name: "Tall + barba", durationMin: 60, price: 23
    },
    {
        id: "m13-demo-infantil", name: "Tall infantil", durationMin: 30, price: 12
    },
    {
        id: "m13-demo-pentinat", name: "Rentat i pentinat", durationMin: 30, price: 10
    },
    {
        id: "m13-demo-classic", name: "Tall clàssic", durationMin: 30, price: 17
    },
];
const raiz = fileURLToPath(new URL("../../", import.meta.url));
// Convertir el text en un identificador fix: el mateix text dona el mateix resultat.
// Rep un text que identifica una intenció o unes dades.
// Retorna el resum SHA-256 en hexadecimal; no és un xifrat que es pugui desfer.
const hash = texto => createHash("sha256").update(texto).digest("hex");
// Preparar l’identificador reservat per a un client de demostració.
// Rep la clau del nom fictici, per exemple laia-soler.
// Retorna el UID amb el prefix reservat per als clients d’aquesta mostra.
export const uidCliente = clave => "m13-demo-client-" + clave;
// Preparar un identificador fix per no crear dues vegades la mateixa cita de mostra.
// Rep el UID del client i el tipus de cita de demostració.
// Retorna sempre el mateix ID per poder repetir la preparació sense duplicats.
export const idCitaDemo = (uid, tipo) => hash(JSON.stringify([uid, "m13-demo-" + tipo]));
// Llegir els accessos d’un arxiu privat que ha d’estar fora del projecte.
// Rep la ruta de l’arxiu privat i el projecte al qual ha de pertànyer.
// Retorna la ruta i les dades llegides, o una estructura buida si encara no existeix.
function leerAccesos(archivo, proyecto) {
    // Convertim la ruta privada a una forma absoluta abans de comprovar que no sigui dins del repositori.
    const destino = path.resolve(archivo);
    if (!path.isAbsolute(archivo) || destino.toLowerCase().startsWith(path.resolve(raiz).toLowerCase() + path.sep)) {
        throw new Error("Las credenciales deben guardarse en una ruta absoluta fuera del proyecto.");
    }
    const datos = fs.existsSync(destino) ? JSON.parse(fs.readFileSync(destino, "utf8")) : { proyecto, cuentas: [] };
    // Un arxiu d’accessos d’un altre entorn no s’ha de reutilitzar per completar aquesta mostra.
    if (datos.proyecto !== proyecto || !Array.isArray(datos.cuentas)) {
        throw new Error("El archivo de accesos pertenece a otro entorno.");
    }
    return { destino, datos };
}
// Guardar els accessos al seu arxiu privat, mai a Git ni als missatges de consola.
// Rep la ruta validada i les dades privades dels comptes de mostra.
// No retorna dades: crea el directori necessari i guarda l’arxiu fora del repositori.
function guardarAccesos(accesos) {
    fs.mkdirSync(path.dirname(accesos.destino), { recursive: true });
    fs.writeFileSync(accesos.destino, JSON.stringify(accesos.datos, null, 2) + "\n", { mode: 0o600 });
}
// Crear només el compte fictici que falta i conservar el que ja existeix.
// Rep la persona fictícia, el rol que li correspon i l’arxiu privat d’accessos.
// Retorna el compte, el rol i la versió per utilitzar-los en preparar les seves cites.
async function prepararCuenta(persona, rol, accesos) {
    const { autenticacion, baseDatos } = obtenerServiciosAdministrativos();
    const uid = rol === "client" ? uidCliente(persona.clave) : "m13-demo-admin-" + persona.clave;
    const email = "m13.demo." + persona.clave + "@example.test";
    let cuenta;
    try {
        cuenta = await autenticacion.getUser(uid);
    }
    catch (error) {
        if (error.code !== "auth/user-not-found") {
            throw error;
        }
    }
    let acceso = accesos.datos.cuentas.find(fila => fila.uid === uid);
    // Si el UID ja pertany a una altra identitat o rol, parem en lloc de modificar aquell compte.
    if (cuenta && (cuenta.email !== email || (cuenta.customClaims?.role || "client") !== rol)) {
        throw new Error("Conflicto con una cuenta existente. No se cambia su identidad ni su rol.");
    }
    if (!acceso) {
        // Si falta la contrasenya privada d’un compte existent, no la restablim automàticament.
        if (cuenta) {
            throw new Error("Falta el archivo privado de acceso de una cuenta existente; no se restablece su contraseña.");
        }
        // Generem una contrasenya diferent per compte i la guardem només a l’arxiu privat.
        acceso = {
            uid, nombre: persona.nombre, email, rol, password: randomBytes(24).toString("base64url")
        };
        accesos.datos.cuentas.push(acceso);
        guardarAccesos(accesos);
    }
    if (!cuenta) {
        cuenta = await autenticacion.createUser({
            uid, email, displayName: persona.nombre, password: acceso.password, emailVerified: true
        });
        await autenticacion.setCustomUserClaims(uid, { role: rol, roleVersion: rol === "admin" ? 1 : 0 });
    }
    if (!cuenta.emailVerified || cuenta.disabled) {
        throw new Error("Revisa la cuenta de demostracion: debe estar habilitada y verificada.");
    }
    const version = rol === "admin" ? 1 : 0;
    const referencia = baseDatos.doc("users/" + uid);
    const perfil = await referencia.get();
    if (perfil.exists && (perfil.get("demoTag") !== MARCA_DEMO || perfil.get("role") !== rol || perfil.get("roleVersion") !== version)) {
        throw new Error("El perfil existente no pertenece a esta preparacion demo.");
    }
    // Creem el perfil demo només si encara no existia, conservant els canvis posteriors de l’avaluador.
    if (!perfil.exists) {
        await referencia.create({
            name: persona.nombre, email, phone: "", role: rol, roleVersion: version, demoTag: MARCA_DEMO
        });
    }
    return {
        usuario: await autenticacion.getUser(uid), rol, version
    };
}
// Preparar serveis i horari de mostra sense substituir l’horari que ja s’està utilitzant.
// No rep paràmetres: utilitza el catàleg fictici definit en aquest fitxer.
// La promesa prepara només el que falta i conserva l’horari que ja existia.
async function prepararCatalogoYHorario() {
    const { baseDatos } = obtenerServiciosAdministrativos();
    const referencia = baseDatos.doc("config/app");
    const configuracion = await referencia.get();
    // Si ja hi ha un horari, el conservem; aquest només és per començar una base buida.
    if (!configuracion.exists) {
        const days = Array.from({ length: 7 }, (_, dia) => ({ active: dia !== 0, ranges: dia === 0 ? [] : [{ start: "09:00", end: "14:00" }, { start: "16:00", end: "20:00" }] }));
        await referencia.create({
            timezone: "Europe/Madrid", days: validarHorario(days), revision: 0
        });
    }
    await obtenerConfiguracionAgenda();
    await referencia.set({ professionalId: UID_PROFESIONAL, professionalName: "Marc Vidal" }, { merge: true });
    for (const servicio of SERVICIOS) {
        const destino = baseDatos.doc("services/" + servicio.id);
        const existente = await destino.get();
        if (existente.exists && existente.get("demoTag") !== MARCA_DEMO) {
            throw new Error("Conflicto con un servicio que no es demo.");
        }
        if (!existente.exists) {
            await destino.create({
                ...servicio, active: true, demoTag: MARCA_DEMO
            });
        }
    }
}
// Buscar una hora lliure vàlida per a una cita futura o una cita de l’historial.
// Rep l’ID del servei i si busquem una cita de l’historial passat.
// Retorna dateStr i timeStr d’un buit vàlid, o un error si no en troba cap.
async function buscarHueco(serviceId, pasado = false) {
    const { baseDatos } = obtenerServiciosAdministrativos();
    const config = await obtenerConfiguracionAgenda();
    const servicio = await cargarServicio(serviceId);
    const hoy = formatearFechaZona(new Date(), config.timezone).slice(0, 10);
    // Provem fins a trenta dies de calendari; per a l’historial anem cap enrere en lloc de cap endavant.
    for (let indice = 0; indice <= 29; indice++) {
        const fecha = sumarDiasCalendario(hoy, pasado ? -indice : indice);
        if ((await baseDatos.doc("closedDays/" + fecha).get()).exists) {
            continue;
        }
        let ocupacion;
        try {
            ocupacion = await cargarOcupacion(fecha);
        }
        catch (error) {
            if (error.code === "failed-precondition") {
                continue;
            }
            throw error;
        }
        // Les cancel·lades deixen l’hora lliure; evitem repetir-les a la mostra.
        const canceladas = await baseDatos.collection("bookings").where("dateStr", "==", fecha).get();
        for (const documento of canceladas.docs) {
            const cita = documento.data();
            if (cita.demoTag === MARCA_DEMO && cita.status === "cancelled") {
                const inicio = convertirHoraAMinutos(cita.timeStr);
                ocupacion.push({ inicio, fin: inicio + cita.durationMin });
            }
        }
        // Per buscar historial permetem calcular hores passades, però després exigim que la cita ja hagi acabat.
        const ahora = pasado ? new Date("2000-01-01T00:00:00Z") : new Date();
        for (const hora of calcularHorasLibres(config, fecha, servicio.durationMin, ocupacion, ahora)) {
            const intervalo = obtenerIntervaloUtc(fecha, hora, servicio.durationMin, config.timezone);
            // Una cita marcada done de la mostra ha de tenir el final real en el passat.
            if (!pasado || intervalo.fin < new Date()) {
                return { dateStr: fecha, timeStr: hora };
            }
        }
    }
    throw new Error("No hay huecos validos para preparar la demostracion; revisa horario, cierres y datos antiguos.");
}
// Crear una cita de mostra amb les mateixes funcions que utilitza la web.
// Rep el compte, el servei, el tipus de mostra i si la cita s’ha de cancel·lar.
// La promesa conserva una cita existent o crea la nova amb les funcions normals de negoci.
async function prepararCitaFutura(identidad, servicio, tipo, cancelar = false) {
    const { baseDatos } = obtenerServiciosAdministrativos();
    const id = idCitaDemo(identidad.usuario.uid, tipo);
    const referencia = baseDatos.doc("bookings/" + id);
    const existente = await referencia.get();
    // Si la cita de mostra ja existeix, no canviem la data ni el seu estat.
    if (existente.exists) {
        if (existente.get("userId") !== identidad.usuario.uid || existente.get("demoTag") !== MARCA_DEMO) {
            throw new Error("La cita existente no pertenece a esta muestra.");
        }
        return;
    }
    const hueco = await buscarHueco(servicio.id);
    await crearReserva(identidad, {
        ...hueco, serviceId: servicio.id, requestId: "m13-demo-" + tipo
    });
    // Etiquetem la cita creada amb el motor normal per identificar-la al resum de la mostra.
    await referencia.update({ demoTag: MARCA_DEMO });
    // Algunes cites es creen i es cancel·len amb la funció de negoci per demostrar que alliberen la seva hora.
    if (cancelar) {
        await cambiarEstado(identidad, { bookingId: id }, "cancelled");
    }
}
// Crear una cita fictícia ja acabada després de comprovar horari i ocupació.
// Rep el compte fictici i el servei per a una cita ja acabada.
// La promesa crea una cita done només si el seu final és anterior al moment actual.
async function prepararHistorial(identidad, servicio) {
    const { baseDatos } = obtenerServiciosAdministrativos();
    const id = idCitaDemo(identidad.usuario.uid, "historial");
    const referencia = baseDatos.doc("bookings/" + id);
    const existente = await referencia.get();
    if (existente.exists) {
        if (existente.get("demoTag") !== MARCA_DEMO || existente.get("userId") !== identidad.usuario.uid) {
            throw new Error("Historial ajeno a la demo.");
        }
        return;
    }
    const hueco = await buscarHueco(servicio.id, true);
    await baseDatos.runTransaction(async (transaccion) => {
        await comprobarIdentidadTransaccion(transaccion, baseDatos, identidad);
        const guardada = await transaccion.get(referencia);
        if (guardada.exists) {
            return;
        }
        const config = await obtenerConfiguracionAgenda(transaccion);
        if ((await transaccion.get(baseDatos.doc("closedDays/" + hueco.dateStr))).exists) {
            throw new Error("El dia esta cerrado.");
        }
        const snapshot = await cargarServicio(servicio.id, transaccion);
        const ocupacion = await cargarOcupacion(hueco.dateStr, transaccion);
        if (!calcularHorasLibres(config, hueco.dateStr, snapshot.durationMin, ocupacion, new Date("2000-01-01")).includes(hueco.timeStr)) {
            throw new Error("Historial incompatible con la agenda.");
        }
        const intervalo = obtenerIntervaloUtc(hueco.dateStr, hueco.timeStr, snapshot.durationMin, config.timezone);
        // L’operador privat pot preparar historial, però no pot presentar una cita futura com si ja hagués acabat.
        if (intervalo.fin >= new Date()) {
            throw new Error("Una cita hecha debe estar en el pasado.");
        }
        const lockKeys = [];
        const inicio = convertirHoraAMinutos(hueco.timeStr);
        for (let minuto = inicio; minuto < inicio + snapshot.durationMin; minuto += 30) {
            const clave = UID_PROFESIONAL + "_" + hueco.dateStr + "_" + convertirMinutosAHora(minuto);
            if ((await transaccion.get(baseDatos.doc("bookingLocks/" + clave))).exists) {
                throw new Error("Celda ocupada.");
            }
            lockKeys.push(clave);
        }
        transaccion.create(referencia, {
            userId: identidad.usuario.uid, userName: identidad.usuario.displayName, userEmail: identidad.usuario.email, userPhone: "",
            barberUid: UID_PROFESIONAL, serviceId: servicio.id, serviceSnapshot: snapshot, durationMin: snapshot.durationMin,
            ...hueco, status: "done", startAt: Timestamp.fromDate(intervalo.inicio), endAt: Timestamp.fromDate(intervalo.fin),
            lockKeys, demoTag: MARCA_DEMO, createdAt: FieldValue.serverTimestamp(),
        });
        for (const clave of lockKeys) {
            transaccion.create(baseDatos.doc("bookingLocks/" + clave), { bookingId: id });
        }
        actualizarControlAgenda(transaccion, baseDatos, config);
    });
}
// Preparar els comptes, serveis i dotze cites i comprovar el resum final.
// Rep el mode LOCAL/WEB, un administrador WEB si cal i la ruta privada d’accessos.
// Retorna el resum de comptes, serveis, dates i estats de les dotze cites de mostra.
export async function prepararDemostracion({ real = false, adminUid = "", archivoAccesos }) {
    if (!real) {
        comprobarEntornoLocal();
    }
    const { autenticacion, baseDatos } = obtenerServiciosAdministrativos();
    const proyecto = process.env.GCLOUD_PROJECT;
    const accesos = leerAccesos(archivoAccesos, proyecto);
    // Per escriure a WEB comprovem també que l’administrador indicat ja tingui permisos.
    if (real) {
        const administrador = await autenticacion.getUser(adminUid);
        const perfil = await baseDatos.doc("users/" + adminUid).get();
        if (!administrador.emailVerified || administrador.disabled || administrador.customClaims?.role !== "admin" || perfil.get("role") !== "admin" || perfil.get("roleVersion") !== administrador.customClaims.roleVersion) {
            throw new Error("Se requiere un administrador inicial ya autorizado.");
        }
    }
    const identidades = [];
    for (const cliente of CLIENTES) {
        identidades.push(await prepararCuenta(cliente, "client", accesos));
    }
    // Els comptes administradors de prova es preparen exclusivament als emuladors.
    if (!real) {
        for (const administrador of ADMINISTRADORES_LOCALES) {
            await prepararCuenta(administrador, "admin", accesos);
        }
    }
    await prepararCatalogoYHorario();
    // Repartim els serveis entre les sis persones per tenir una agenda de mostra variada.
    const serviciosFuturos = [0, 2, 3, 1, 5, 4];
    for (let indice = 0; indice < identidades.length; indice++) {
        await prepararCitaFutura(identidades[indice], SERVICIOS[serviciosFuturos[indice]], "proxima");
    }
    for (let indice = 0; indice < identidades.length; indice++) {
        if (indice === 1 || indice === 5) {
            await prepararCitaFutura(identidades[indice], SERVICIOS[0], "historial", true);
        }
        else {
            await prepararHistorial(identidades[indice], SERVICIOS[indice === 0 ? 0 : 5]);
        }
    }
    const citas = await baseDatos.collection("bookings").where("demoTag", "==", MARCA_DEMO).get();
    // Si hi ha una quantitat inesperada de cites, no esborrem dades per forçar el recompte.
    if (citas.size !== 12) {
        throw new Error("La muestra debe contener exactamente doce citas; no se borran registros para corregirla.");
    }
    const estados = {};
    const fechas = new Set();
    const citasPorFecha = {};
    for (const cita of citas.docs) {
        const estado = cita.get("status");
        const fecha = cita.get("dateStr");
        estados[estado] = (estados[estado] || 0) + 1;
        fechas.add(fecha);
        citasPorFecha[fecha] = (citasPorFecha[fecha] || 0) + 1;
    }
    await prepararCierres([...fechas].sort().at(-1));
    guardarAccesos(accesos);
    const resumen = {
        proyecto, modo: real ? "WEB" : "LOCAL", clientes: 6, administradoresDemo: real ? 0 : 6, administradorInicial: real ? adminUid : null, profesional: "Marc Vidal", servicios: 6, citas: citas.size, estados, fechas: [...fechas].sort(), citasPorFecha, archivoAccesos: accesos.destino
    };
    // El resum mostra dates i quantitats, però les contrasenyes continuen només a l’arxiu privat.
    console.log(JSON.stringify(resumen, null, 2));
    return resumen;
}
// Afegir dies tancats de mostra una sola vegada, sense tocar dies que després s’han reobert.
// Rep l’última data de les cites de la mostra.
// La promesa prepara tancaments una sola vegada i en registra les dates a config/app.
async function prepararCierres(ultimaFecha) {
    const { baseDatos } = obtenerServiciosAdministrativos();
    await baseDatos.runTransaction(async transaccion => {
        const configuracion = await obtenerConfiguracionAgenda(transaccion);
        const referencia = baseDatos.doc("config/app");
        // Si ja vam preparar els tancaments, no els tornem a crear ni tanquem una reobertura.
        if ((await transaccion.get(referencia)).get("demoClosedDates")) {
            return;
        }
        const fechas = [];
        for (const dias of [7, 14]) {
            const fecha = sumarDiasCalendario(ultimaFecha, dias);
            const cierre = await transaccion.get(baseDatos.doc("closedDays/" + fecha));
            const citas = await transaccion.get(baseDatos.collection("bookings").where("dateStr", "==", fecha));
            // Només preparem un tancament de mostra si aquell dia no té ja cap tancament ni cites.
            if (!cierre.exists && citas.empty) {
                fechas.push(fecha);
            }
        }
        for (const fecha of fechas) {
            transaccion.create(baseDatos.doc("closedDays/" + fecha), { dateStr: fecha, demoTag: MARCA_DEMO });
        }
        transaccion.update(referencia, { demoClosedDates: fechas });
        actualizarControlAgenda(transaccion, baseDatos, configuracion);
    });
}
