// Proves que obren la web i fan servir els formularis com un usuari. Només fan servir els emuladors.
import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
const raiz = fileURLToPath(new URL("../../../", import.meta.url));
// Preparar una data de prova a partir del dia actual de la barberia.
const fecha = (dias = 7) => {
    const partes = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(new Date());
    // Agafar una part de la data per poder formar any, mes i dia.
    const valor = (tipo: string) => partes.find(p => p.type === tipo)!.value;
    const instante = new Date(valor("year") + "-" + valor("month") + "-" + valor("day") + "T00:00:00Z");
    instante.setUTCDate(instante.getUTCDate() + dias);
    return instante.toISOString().slice(0, 10);
};
// Omplir el login de prova i comprovar que arribem a la pantalla correcta.
async function entrar(page: Page, cuenta = "client") {
    await page.goto("/login");
    await page.locator("#login-email").fill("demo-" + cuenta + "@example.test");
    await page.locator("#login-password").fill("Prueba123!");
    await page.locator("#login-form button").click();
    await expect(page).toHaveURL(cuenta === "admin" ? /\/admin\/?$/ : /\/reservar\/?$/);
    await expect(page.locator("html")).not.toHaveAttribute("data-auth-pending");
}
// Fer una reserva des dels formularis de prova i comprovar que es confirma.
async function reservar(page: Page, dias = 7, servicio = "corte", hora = "09:00") {
    await page.goto("/reservar");
    await expect(page.locator("#service-select option[value='corte']")).toBeAttached();
    await page.locator("#service-select").selectOption(servicio);
    await page.locator("#date-select").fill(fecha(dias));
    await page.locator("#slots-list button").filter({ hasText: hora }).click();
    await expect(page.locator("#booking-success")).toBeVisible();
    await expect(page.locator("#booking-summary")).toContainText("Cita confirmada");
}
// Abans dels recorreguts preparem els comptes i les dades de prova locals.
test.beforeAll(() => {
    execFileSync(process.execPath, ["functions/scripts/preparar-datos-reservas.mjs"], {
        cwd: raiz, env: process.env, stdio: "pipe"
    });
});
test("paginas publicas adaptadas, enlaces validos y anchura de pantalla", async ({ page }) => {
    for (const ruta of ["/", "/ayuda", "/legal", "/login", "/registro", "/verify", "/404"]) {
        await page.goto(ruta);
        await expect(page.locator("nav")).toBeVisible();
        await expect(page.locator("html")).toHaveAttribute("lang", "ca");
        await expect(page.locator("main h1")).toHaveCount(1);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        const enlaces = await page.locator("a[href^='/']").evaluateAll(elementos => elementos.map(e => e.getAttribute("href")));
        for (const enlace of enlaces) {
            expect(["/", "/ayuda", "/legal", "/login", "/registro", "/verify", "/perfil", "/reservar", "/mis-citas", "/admin", "/agenda", "/horarios", "/servicios"]).toContain(enlace);
        }
    }
    const respuesta = await page.goto("/panel-barbero");
    expect(respuesta?.status()).toBe(404);
});
test("registro, verificacion real en Auth local y cierre de sesion", async ({ page, request }) => {
    const correo = "alta-" + crypto.randomUUID() + "@example.test";
    await page.goto("/registro");
    await page.locator("#reg-name").fill("Cliente de prueba");
    await page.locator("#reg-email").fill(correo);
    await page.locator("#reg-password").fill("Prueba123!");
    await page.locator("#reg-password2").fill("Prueba123!");
    await page.locator("#reg-form button").click();
    await expect(page).toHaveURL(/\/verify/);
    const respuesta = await request.get("http://127.0.0.1:9099/emulator/v1/projects/demo-barberpro-m13/oobCodes");
    const codigos = (await respuesta.json()).oobCodes;
    const codigo = codigos.find((c: {
        email: string;
    }) => c.email === correo);
    expect(codigo).toBeTruthy();
    await page.goto("/verify?mode=verifyEmail&oobCode=" + encodeURIComponent(codigo.oobCode));
    await expect(page).toHaveURL(/\/reservar\/?$/);
    await page.goto("/perfil");
    await expect(page.locator("#perfil-role")).toHaveText("Client");
    await expect(page.locator("#perfil-verif")).toHaveText("Verificat");
    await page.locator("#btn-logout").click();
    await expect(page).toHaveURL(/\/login/);
    await page.goto("/mis-citas");
    await expect(page).toHaveURL(/\/login/);
});
test("cliente reserva, ve solo sus citas, cancela y recupera la hora", async ({ page }) => {
    await entrar(page);
    await reservar(page);
    await page.reload();
    await expect(page.locator("html")).not.toHaveAttribute("data-auth-pending");
    await page.goto("/mis-citas");
    await expect(page.locator("#my-list")).toContainText("Confirmada");
    page.once("dialog", dialogo => dialogo.accept());
    await page.getByRole("button", { name: "Cancel·la la cita", exact: true }).click();
    await expect(page.locator("#my-list")).toContainText("Cancel·lada");
    await page.goto("/reservar");
    await expect(page.locator("#service-select option[value='corte']")).toBeAttached();
    await page.locator("#service-select").selectOption("corte");
    await page.locator("#date-select").fill(fecha());
    await expect(page.getByRole("button", { name: "09:00", exact: true })).toBeVisible();
    for (const ruta of ["/admin", "/agenda", "/servicios", "/horarios"]) {
        await page.goto(ruta);
        await expect(page).toHaveURL(/acceso=denegado/);
    }
    await expect(page.locator("#link-admin")).toBeHidden();
});
test("perfil editado se conserva al recargar y se vacia al cambiar de cuenta", async ({ page }) => {
    await entrar(page);
    await page.goto("/perfil");
    await expect(page.locator("#perfil-email")).toHaveText("demo-client@example.test");
    await page.locator("#perfil-name").fill("Nombre revisado");
    await page.locator("#perfil-phone").fill("600123123");
    await page.locator("#perfil-save").click();
    await expect(page.locator("#perfil-msg")).toHaveText("Canvis desats.");
    await page.reload();
    await expect(page.locator("#perfil-name")).toHaveValue("Nombre revisado");
    await page.locator("#btn-logout").click();
    await expect(page).toHaveURL(/\/login/);
    await entrar(page, "otro");
    await page.goto("/perfil");
    await expect(page.locator("#perfil-name")).toHaveValue("Prueba otro");
    await expect(page.locator("#perfil-phone")).toHaveValue("");
});
test("admin consulta agenda y completa una reserva de 60 minutos", async ({ page }) => {
    await entrar(page);
    await reservar(page, 8, "completo", "10:00");
    await page.locator("#btn-logout").click();
    await expect(page).toHaveURL(/\/login/);
    await entrar(page, "admin");
    await page.goto("/agenda");
    await page.locator("#agenda-date").fill(fecha(8));
    await expect(page.locator("#agenda-list")).toContainText("Confirmada");
    page.once("dialog", dialogo => dialogo.accept());
    await page.getByRole("button", { name: "Marca com a completada", exact: true }).click();
    await expect(page.locator("#agenda-list")).toContainText("Completada");
    await expect(page.getByRole("button", { name: "Marca com a completada", exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
test("admin crea, edita y desactiva un servicio", async ({ page }) => {
    await entrar(page, "admin");
    await page.goto("/servicios");
    await page.locator("#service-name").fill("Servicio evaluacion");
    await page.locator("#service-duration").fill("60");
    await page.locator("#service-price").fill("30");
    await page.locator("#service-create-form button").click();
    await expect(page.locator("#services-msg")).toHaveText("Servei desat.");
    const fila = page.locator("#services-list form").filter({ has: page.locator("input[value='Servicio evaluacion']") });
    await expect(fila).toHaveCount(1);
    await fila.locator("input[type='checkbox']").uncheck();
    await fila.getByRole("button", { name: "Desa el servei" }).click();
    await expect(page.locator("#services-msg")).toHaveText("Servei desat.");
    await expect(fila.locator("input[type='checkbox']")).not.toBeChecked();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
test("admin cambia horario habitual, cierra y reabre una fecha", async ({ page }) => {
    await entrar(page, "admin");
    await page.goto("/horarios");
    await expect(page.locator("#schedule-form button")).toBeEnabled();
    await page.locator('[data-day="0"] [data-end="0"]').fill("13:30");
    await page.locator("#schedule-form button").click();
    await expect(page.locator("#hours-msg")).toHaveText("Canvis desats.");
    await page.reload();
    await expect(page.locator('[data-day="0"] [data-end="0"]')).toHaveValue("13:30");
    await page.locator('[data-day="0"] [data-end="0"]').fill("14:00");
    await page.locator("#schedule-form button").click();
    await expect(page.locator("#hours-msg")).toHaveText("Canvis desats.");
    await page.locator("#closed-date").fill(fecha(12));
    await page.locator("#closed-form button").click();
    await expect(page.locator("#closed-msg")).toHaveText("Canvis desats.");
    await expect(page.locator("#closed-list")).toContainText(fecha(12));
    await page.locator("#closed-state").uncheck();
    await page.locator("#closed-form button").click();
    await expect(page.locator("#closed-msg")).toHaveText("Canvis desats.");
    await expect(page.locator("#closed-list")).not.toContainText(fecha(12));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
test("la validació en català evita l’alta incorrecta i el llistat mostra l’estat buit", async ({ page }) => {
    await page.goto("/registro");
    await page.locator("#reg-name").fill("Laia de prova");
    await page.locator("#reg-email").fill("validacio@example.test");
    await page.locator("#reg-password").fill("Prova123!");
    await page.locator("#reg-password2").fill("Diferent123!");
    await page.locator("#reg-form button").click();
    await expect(page.locator("#reg-msg")).toHaveText("Les contrasenyes no coincideixen.");
    await expect(page).toHaveURL(/\/registro\/?$/);
    await entrar(page, "otro");
    await page.goto("/mis-citas");
    await expect(page.locator("#my-msg")).toHaveText("No hi ha cites amb aquests filtres.");
    await expect(page.locator("#my-list article")).toHaveCount(0);
});
test("doble clic i resposta perduda: recarregar i reintentar conserva una sola cita", async ({ page }) => {
    await entrar(page);
    let primera = true;
    const peticions: string[] = [];
    await page.route("**/createBooking", async ruta => {
        peticions.push(ruta.request().postDataJSON().data.requestId);
        if (primera) {
            primera = false;
            // El servidor desa la cita, però simulem que la resposta no arriba al client.
            // Deixem que el servidor guardi la cita abans de simular que es perd la resposta.
            const resposta = await ruta.fetch();
            expect(resposta.ok()).toBe(true);
            await ruta.fulfill({ status: 503, json: { error: { status: "UNAVAILABLE", message: "Resposta no disponible" } } });
        } else {
            await ruta.continue();
        }
    });
    await page.goto("/reservar");
    await expect(page.locator("#service-select")).toBeEnabled();
    await page.locator("#service-select").selectOption("corte");
    await page.locator("#date-select").fill(fecha(11));
    const hora = page.getByRole("button", { name: "09:00", exact: true });
    await expect(hora).toBeVisible();
    await hora.evaluate((b: HTMLButtonElement) => { b.click(); b.click(); });
    await expect(page.locator("#booking-retry")).toBeVisible();
    await expect(page.locator("#booking-success")).toBeHidden();
    await expect(page.locator("#service-select")).toBeDisabled();
    await page.reload();
    await expect(page.locator("#booking-retry")).toBeVisible();
    await expect(page.locator("#date-select")).toBeDisabled();
    await page.locator("#booking-retry").click();
    await expect(page.locator("#booking-summary")).toContainText("Cita confirmada");
    expect(peticions).toHaveLength(2);
    // El reintent ha de portar el mateix requestId: no és una reserva nova.
    expect(peticions[0]).toBe(peticions[1]);
    await page.goto("/mis-citas");
    await page.locator("#filter-date").fill(fecha(11));
    await expect(page.locator("#my-list article")).toHaveCount(1);
});
test("sin autenticar las siete rutas privadas requieren iniciar sesion", async ({ page }) => {
    for (const ruta of ["/perfil", "/reservar", "/mis-citas", "/admin", "/agenda", "/servicios", "/horarios"]) {
        await page.goto(ruta);
        await expect(page).toHaveURL(/\/login/);
    }
});
test("la demo catalana se usa desde la interfaz y el administrador ve las doce citas", async ({ page }, info) => {
    const archivo = path.join(tmpdir(), "m13-demo-browser-local.json");
    // Cada navegador prepara les cites; Auth conserva els comptes i l’arxiu privat.
    const archivoCompartido = process.env.M13_DEMO_BROWSER_ACCESOS || archivo;
    const salida = execFileSync(process.execPath, ["functions/scripts/preparar-demo-local.mjs", "--credenciales-salida", archivoCompartido], {
        cwd: raiz, env: process.env, encoding: "utf8"
    });
    const resumen = JSON.parse(salida);
    const accesos = JSON.parse(readFileSync(archivoCompartido, "utf8")).cuentas;
    // Entrar a la web amb un compte fictici preparat per la prova.
    async function entrarDemo(cuenta: {
        email: string;
        password: string;
    }, admin: boolean) {
        await page.goto("/login");
        await page.locator("#login-email").fill(cuenta.email);
        await page.locator("#login-password").fill(cuenta.password);
        await page.locator("#login-form button").click();
        await expect(page).toHaveURL(admin ? /\/admin\/?$/ : /\/reservar\/?$/);
    }
    await entrarDemo(accesos.find((c: {
        uid: string;
    }) => c.uid === "m13-demo-client-laia-soler"), false);
    await page.goto("/reservar");
    await expect(page.locator("#booking-professional")).toHaveText("Marc Vidal");
    await expect(page.locator("#service-select")).toContainText("Tall de cabell");
    await page.goto("/mis-citas");
    await expect(page.locator("#my-list article")).toHaveCount(2);
    await expect(page.locator("#my-list")).toContainText("Tall de cabell");
    await page.locator("#btn-logout").click();
    await expect(page).toHaveURL(/\/login/);
    await entrarDemo(accesos.find((c: {
        uid: string;
    }) => c.uid === "m13-demo-admin-marta-roca"), true);
    await page.goto("/agenda");
    const ids = new Set<string>();
    for (const fecha of resumen.fechas) {
        await page.locator("#agenda-date").fill(fecha);
        await expect(page.locator("#agenda-list article")).toHaveCount(resumen.citasPorFecha[fecha]);
        await expect(page.locator("#agenda-list")).toContainText(fecha);
        for (const id of await page.locator("#agenda-list article").evaluateAll(filas => filas.map(f => (f as HTMLElement).dataset.bookingId!))) {
            ids.add(id);
        }
    }
    expect(ids.size).toBe(12);
    await page.screenshot({ path: info.outputPath("agenda-demo.png"), fullPage: true });
});
