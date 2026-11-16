// Executem les proves del servidor, compilem LOCAL i després obrim el navegador de prova.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readFileSync, existsSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { comprobarEntornoLocal } from "../../src/firebase.js";
comprobarEntornoLocal();
const raiz = fileURLToPath(new URL("../../../", import.meta.url));
const app = fileURLToPath(new URL("../../../app/", import.meta.url));
// L’arxiu privat de prova té un nom nou per execució i es comparteix entre la integració demo i el navegador.
const accesosDemo = path.join(tmpdir(), "m13-demo-e2e-" + crypto.randomUUID() + ".json");
const env = {
    ...process.env, M13_DEMO_BROWSER_ACCESOS: accesosDemo, PUBLIC_FIREBASE_MODE: "local", PUBLIC_USE_FIREBASE_EMULATORS: "1", PUBLIC_USE_FUNCTIONS_EMULATOR: "1", PUBLIC_FIREBASE_API_KEY: "demo-api-key", PUBLIC_FIREBASE_AUTH_DOMAIN: "localhost", PUBLIC_FIREBASE_PROJECT_ID: "demo-barberpro-m13", PUBLIC_FIREBASE_APP_ID: "1:123456789:web:demo", PUBLIC_APP_URL: "http://127.0.0.1:4331"
};
// Executar una comprovació i aturar les proves si acaba amb un error.
// Rep els arguments de la comanda i el directori on s’ha d’executar.
// No retorna dades: llança un error si el procés de prova no acaba amb codi zero.
function ejecutar(args, cwd = raiz) {
    // Esperem que cada comprovació acabi abans de continuar amb la següent bateria.
    const r = spawnSync(process.execPath, args, {
        cwd, env, stdio: "inherit"
    });
    // Un procés interromput o amb error no compta com una prova superada.
    if (r.error || r.status !== 0) {
        throw new Error("Ha fallado una comprobacion: " + args[0]);
    }
}
try {
    // Primer validem les operacions i les regles; després preparem demo i recorreguts de navegador.
    ejecutar(["--test", "--test-concurrency=1", "functions/tests/emuladores/agenda.test.mjs"]);
    ejecutar(["--test", "--test-concurrency=1", "functions/tests/emuladores/demo.test.mjs"]);
    const astro = JSON.parse(readFileSync(new URL("../../../app/node_modules/astro/package.json", import.meta.url), "utf8"));
    // Compilem amb variables LOCAL abans d’obrir el navegador perquè no faci peticions al projecte real.
    ejecutar(["node_modules/astro/" + astro.bin.astro, "build"], app);
    ejecutar(["node_modules/@playwright/test/cli.js", "test"], app);
}
// Encara que una prova falli, retirem l’arxiu privat temporal d’aquesta execució.
finally {
    if (existsSync(accesosDemo)) {
        unlinkSync(accesosDemo);
    }
}
