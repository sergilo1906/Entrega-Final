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
export const MARCA_DEMO = "m13-entrega-final";
export const CLIENTES = [
    { clave: "laia-soler", nombre: "Laia Soler" },
    { clave: "pau-rovira", nombre: "Pau Rovira" },
    { clave: "julia-font", nombre: "Júlia Font" },
    { clave: "arnau-puig", nombre: "Arnau Puig" },
    { clave: "mariona-valls", nombre: "Mariona Valls" },
    { clave: "nil-casals", nombre: "Nil Casals" },
];
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
const hash = texto => createHash("sha256").update(texto).digest("hex");
export const uidCliente = clave => "m13-demo-client-" + clave;
export const idCitaDemo = (uid, tipo) => hash(JSON.stringify([uid, "m13-demo-" + tipo]));
// Las contraseñas se generan al ejecutar y se guardan fuera del proyecto, nunca en Git ni logs.
function leerAccesos(archivo, proyecto) {
    const destino = path.resolve(archivo);
    if (!path.isAbsolute(archivo) || destino.toLowerCase().startsWith(path.resolve(raiz).toLowerCase() + path.sep)) {
        throw new Error("Las credenciales deben guardarse en una ruta absoluta fuera del proyecto.");
    }
    const datos = fs.existsSync(destino) ? JSON.parse(fs.readFileSync(destino, "utf8")) : { proyecto, cuentas: [] };
    if (datos.proyecto !== proyecto || !Array.isArray(datos.cuentas)) {
        throw new Error("El archivo de accesos pertenece a otro entorno.");
    }
    return { destino, datos };
}
function guardarAccesos(accesos) {
    fs.mkdirSync(path.dirname(accesos.destino), { recursive: true });
    fs.writeFileSync(accesos.destino, JSON.stringify(accesos.datos, null, 2) + "\n", { mode: 0o600 });
}
// Solo gestionamos identificadores reservados de demo y nunca reutilizamos usuarios reales.
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
    if (cuenta && (cuenta.email !== email || (cuenta.customClaims?.role || "client") !== rol)) {
        throw new Error("Conflicto con una cuenta existente. No se cambia su identidad ni su rol.");
    }
    if (!acceso) {
        if (cuenta) {
            throw new Error("Falta el archivo privado de acceso de una cuenta existente; no se restablece su contraseña.");
        }
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
    if (!perfil.exists) {
        await referencia.create({
            name: persona.nombre, email, phone: "", role: rol, roleVersion: version, demoTag: MARCA_DEMO
        });
    }
    return {
        usuario: await autenticacion.getUser(uid), rol, version
    };
}
// El horario existente se conserva. Solo un entorno nuevo recibe el horario de ejemplo.
async function prepararCatalogoYHorario() {
    const { baseDatos } = obtenerServiciosAdministrativos();
    const referencia = baseDatos.doc("config/app");
    const configuracion = await referencia.get();
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
// Elegimos horas con el mismo motor del backend. Para el historial exigimos fin en el pasado.
async function buscarHueco(serviceId, pasado = false) {
    const { baseDatos } = obtenerServiciosAdministrativos();
    const config = await obtenerConfiguracionAgenda();
    const servicio = await cargarServicio(serviceId);
    const hoy = formatearFechaZona(new Date(), config.timezone).slice(0, 10);
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
        // Las canceladas siguen libres para el cliente; la muestra evita repetir sus horas al prepararse.
        const canceladas = await baseDatos.collection("bookings").where("dateStr", "==", fecha).get();
        for (const documento of canceladas.docs) {
            const cita = documento.data();
            if (cita.demoTag === MARCA_DEMO && cita.status === "cancelled") {
                const inicio = convertirHoraAMinutos(cita.timeStr);
                ocupacion.push({ inicio, fin: inicio + cita.durationMin });
            }
        }
        const ahora = pasado ? new Date("2000-01-01T00:00:00Z") : new Date();
        for (const hora of calcularHorasLibres(config, fecha, servicio.durationMin, ocupacion, ahora)) {
            const intervalo = obtenerIntervaloUtc(fecha, hora, servicio.durationMin, config.timezone);
            if (!pasado || intervalo.fin < new Date()) {
                return { dateStr: fecha, timeStr: hora };
            }
        }
    }
    throw new Error("No hay huecos validos para preparar la demostracion; revisa horario, cierres y datos antiguos.");
}
// Las citas futuras usan crearReserva y cambiarEstado, como la aplicacion real.
async function prepararCitaFutura(identidad, servicio, tipo, cancelar = false) {
    const { baseDatos } = obtenerServiciosAdministrativos();
    const id = idCitaDemo(identidad.usuario.uid, tipo);
    const referencia = baseDatos.doc("bookings/" + id);
    const existente = await referencia.get();
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
    await referencia.update({ demoTag: MARCA_DEMO });
    if (cancelar) {
        await cambiarEstado(identidad, { bookingId: id }, "cancelled");
    }
}
// El backend no permite reservar en el pasado. Solo este operador crea historial terminado,
// comprobando dentro de la transaccion horario, cierre, servicio, ocupacion y todos los locks.
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
export async function prepararDemostracion({ real = false, adminUid = "", archivoAccesos }) {
    if (!real) {
        comprobarEntornoLocal();
    }
    const { autenticacion, baseDatos } = obtenerServiciosAdministrativos();
    const proyecto = process.env.GCLOUD_PROJECT;
    const accesos = leerAccesos(archivoAccesos, proyecto);
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
    if (!real) {
        for (const administrador of ADMINISTRADORES_LOCALES) {
            await prepararCuenta(administrador, "admin", accesos);
        }
    }
    await prepararCatalogoYHorario();
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
    guardarAccesos(accesos);
    const resumen = {
        proyecto, modo: real ? "WEB" : "LOCAL", clientes: 6, administradoresDemo: real ? 0 : 6, administradorInicial: real ? adminUid : null, profesional: "Marc Vidal", servicios: 6, citas: citas.size, estados, fechas: [...fechas].sort(), citasPorFecha, archivoAccesos: accesos.destino
    };
    console.log(JSON.stringify(resumen, null, 2));
    return resumen;
}
