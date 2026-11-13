import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { initializeApp, deleteApp } from "firebase/app";
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator, collection, query, where, getDocs, getDoc, doc } from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator, httpsCallable } from "firebase/functions";
import { prepararAgenda, baseDatos } from "./datos-reservas.mjs";
import { prepararDemostracion, CLIENTES, SERVICIOS, MARCA_DEMO, uidCliente } from "../../scripts/datos-demo.mjs";
import { cabeEnHorario } from "../../src/horarios.js";
import { convertirHoraAMinutos } from "../../src/fechas.js";
test("demo catalana: doce citas coherentes, doce cuentas locales, aislamiento y segunda ejecucion sin duplicados", async () => {
    await prepararAgenda();
    const archivoAccesos = process.env.M13_DEMO_BROWSER_ACCESOS || path.join(tmpdir(), "m13-demo-prueba-" + crypto.randomUUID() + ".json");
    const aplicaciones = [];
    try {
        const primero = await prepararDemostracion({ archivoAccesos });
        const segundo = await prepararDemostracion({ archivoAccesos });
        assert.equal(primero.citas, 12);
        assert.equal(segundo.citas, 12);
        assert.deepEqual(primero.estados, segundo.estados);
        assert.equal(primero.estados.confirmed, 6);
        assert.equal(primero.estados.done, 4);
        assert.equal(primero.estados.cancelled, 2);
        const cuentas = JSON.parse(fs.readFileSync(archivoAccesos, "utf8")).cuentas;
        assert.equal(cuentas.filter(c => c.rol === "client").length, 6);
        assert.equal(cuentas.filter(c => c.rol === "admin").length, 6);
        assert.equal(new Set(cuentas.map(c => c.password)).size, 12);
        const configuracion = (await baseDatos.doc("config/app").get()).data();
        assert.equal(configuracion.professionalName, "Marc Vidal");
        assert.equal(configuracion.demoClosedDates.length, 2);
        assert.equal((await baseDatos.collection("closedDays").get()).size, 2);
        const reapertura = configuracion.demoClosedDates[0];
        await baseDatos.doc("closedDays/" + reapertura).delete();
        await prepararDemostracion({ archivoAccesos });
        assert.equal((await baseDatos.doc("closedDays/" + reapertura).get()).exists, false);
        for (const servicio of SERVICIOS) {
            const actual = (await baseDatos.doc("services/" + servicio.id).get()).data();
            assert.equal(actual.name, servicio.name);
            assert.equal(actual.durationMin, servicio.durationMin);
            assert.equal(actual.price, servicio.price);
        }
        const filas = (await baseDatos.collection("bookings").where("demoTag", "==", MARCA_DEMO).get()).docs;
        for (const fila of filas) {
            const cita = fila.data();
            assert.equal(cita.barberUid, "principal");
            assert.equal(cita.durationMin, cita.serviceSnapshot.durationMin);
            assert.equal(cabeEnHorario(configuracion.days, cita.dateStr, convertirHoraAMinutos(cita.timeStr), cita.durationMin), true);
            if (cita.status === "confirmed") {
                assert.ok(cita.startAt.toDate() > new Date());
            }
            if (cita.status === "done") {
                assert.ok(cita.endAt.toDate() < new Date());
            }
            for (const clave of cita.lockKeys) {
                const lock = await baseDatos.doc("bookingLocks/" + clave).get();
                if (cita.status === "cancelled") {
                    assert.equal(lock.exists, false);
                }
                else {
                    assert.equal(lock.get("bookingId"), fila.id);
                }
            }
            if (cita.status !== "cancelled") {
                for (const otraFila of filas) {
                    const otra = otraFila.data();
                    if (fila.id >= otraFila.id || otra.status === "cancelled" || otra.dateStr !== cita.dateStr) {
                        continue;
                    }
                    assert.equal(cita.startAt.toMillis() < otra.endAt.toMillis() && otra.startAt.toMillis() < cita.endAt.toMillis(), false);
                }
            }
        }
        for (const cliente of CLIENTES) {
            const uid = uidCliente(cliente.clave);
            const acceso = cuentas.find(c => c.uid === uid);
            const app = initializeApp({ projectId: "demo-barberpro-m13", apiKey: "demo-api-key" }, uid);
            aplicaciones.push(app);
            const auth = getAuth(app);
            connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
            await signInWithEmailAndPassword(auth, acceso.email, acceso.password);
            const datos = getFirestore(app);
            connectFirestoreEmulator(datos, "127.0.0.1", 8088);
            const propias = await getDocs(query(collection(datos, "bookings"), where("userId", "==", uid)));
            assert.equal(propias.size, 2);
            assert.equal(propias.docs.every(d => d.get("userName") === cliente.nombre), true);
            const ajena = filas.find(f => f.get("userId") !== uid);
            await assert.rejects(getDoc(doc(datos, "bookings", ajena.id)));
            const cancelada = filas.find(f => f.get("userId") === uid && f.get("status") === "cancelled");
            if (cancelada) {
                const functions = getFunctions(app, "europe-west1");
                connectFunctionsEmulator(functions, "127.0.0.1", 5001);
                const disponible = (await httpsCallable(functions, "getAvailability")({ serviceId: cancelada.get("serviceId"), dateStr: cancelada.get("dateStr") })).data;
                assert.equal(disponible.slots.some(h => h.timeStr === cancelada.get("timeStr")), true);
            }
        }
    }
    finally {
        for (const app of aplicaciones) {
            await deleteApp(app);
        }
        if (!process.env.M13_DEMO_BROWSER_ACCESOS && fs.existsSync(archivoAccesos)) {
            fs.unlinkSync(archivoAccesos);
        }
    }
});
test("los procedimientos demo rechazan mezclar WEB y LOCAL antes de escribir", () => {
    const local = spawnSync(process.execPath, ["functions/scripts/preparar-demo-local.mjs"], {
        cwd: new URL("../../../", import.meta.url), env: { ...process.env, GCLOUD_PROJECT: "barber-pro-6fdf6" }, encoding: "utf8",
    });
    assert.notEqual(local.status, 0);
    const web = spawnSync(process.execPath, ["functions/scripts/preparar-demo-web.mjs", "--project", "barber-pro-6fdf6", "--confirmar-proyecto", "barber-pro-6fdf6", "--aplicar"], {
        cwd: new URL("../../../", import.meta.url), env: process.env, encoding: "utf8",
    });
    assert.notEqual(web.status, 0);
});
