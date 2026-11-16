// Arrenquem Firebase al nostre ordinador amb un projecte demo, sense reutilitzar credencials de la web real.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
const raiz = fileURLToPath(new URL("../../", import.meta.url));
const modoPruebas = process.argv.includes("--pruebas");
// Utilitzem el projecte demo explícitament perquè no s’agafi per error el projecte real.
const argumentos = [fileURLToPath(new URL("../../node_modules/firebase-tools/lib/bin/firebase.js", import.meta.url)),
    modoPruebas ? "emulators:exec" : "emulators:start", "--only", "auth,firestore,functions", "--project", "demo-barberpro-m13"];
// En mode proves, emulators:exec arrenca els serveis, executa la bateria i els apaga quan acaba.
if (modoPruebas) {
    argumentos.push('node functions/tests/emuladores/ejecutar-pruebas.mjs');
}
// Creem un perfil CLI temporal sense comptes globals ni memòria cau al projecte.
const carpetaTemporal = realpathSync(tmpdir());
// Cada execució rep una carpeta temporal pròpia per no compartir la sessió global de Firebase CLI.
const configuracionCli = mkdtempSync(join(carpetaTemporal, "barberpro-m13-cli-"));
// Esborrar només la carpeta temporal que hem creat per executar els emuladors.
// No rep paràmetres: només coneix el directori temporal creat per aquest procés.
// No retorna dades: comprova la ruta abans d’esborrar el perfil CLI temporal.
function limpiarConfiguracionCli() {
    const destino = resolve(configuracionCli);
    if (!destino.startsWith(carpetaTemporal + sep) || !destino.startsWith(join(carpetaTemporal, "barberpro-m13-cli-"))) {
        throw new Error("Ruta temporal de Firebase no valida.");
    }
    rmSync(destino, { recursive: true, force: true });
}
const entorno = {
    ...process.env, XDG_CONFIG_HOME: configuracionCli,
    FUNCTIONS_DISCOVERY_TIMEOUT: "60", FIREBASE_CLI_DISABLE_UPDATE_CHECK: "true", CI: "true",
};
// La CLI local no fa servir la sessió global ni credencials reals.
// Traiem credencials reals de l’entorn del procés local abans d’arrencar-lo.
delete entorno.GOOGLE_APPLICATION_CREDENTIALS;
delete entorno.FIREBASE_TOKEN;
delete entorno.DEBUG;
// Arrenquem la CLI com un procés fill i deixem veure els seus missatges a la terminal.
const proceso = spawn(process.execPath, argumentos, {
    cwd: raiz, env: entorno, stdio: "inherit"
});
// Si el procés ni tan sols pot arrencar, també hem de netejar el perfil temporal i retornar un error.
proceso.on("error", () => {
    limpiarConfiguracionCli();
    process.exitCode = 1;
});
// Un procés interromput retorna null i ha de comptar com un error.
proceso.on("exit", (codigo) => {
    limpiarConfiguracionCli();
    process.exitCode = typeof codigo === "number" ? codigo : 1;
});
