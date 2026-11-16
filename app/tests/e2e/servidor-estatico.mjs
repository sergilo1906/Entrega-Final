// Servidor local per provar els HTML ja compilats. No és el servidor de la web publicada.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
// Només servim els fitxers que ha generat Astro dins de dist.
const publico = fileURLToPath(new URL("../../dist/", import.meta.url));
const tipos = {
    ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml"
};
createServer(async (peticion, respuesta) => {
    try {
        // Aquest servidor només llegeix pàgines; no accepta operacions que pretenguin modificar fitxers.
        if (!["GET", "HEAD"].includes(peticion.method)) {
            respuesta.writeHead(405).end();
            return;
        }
        const url = new URL(peticion.url || "/", "http://127.0.0.1");
        // Decodifiquem la ruta abans de comprovar que es mantingui dins el directori públic.
        const ruta = decodeURIComponent(url.pathname);
        let archivo = path.resolve(publico, "." + ruta);
        const relativa = path.relative(publico, archivo);
        // Impedim que una adreça intenti sortir de dist i llegir arxius de l’ordinador.
        if (relativa.startsWith("..") || path.isAbsolute(relativa)) {
            respuesta.writeHead(403).end();
            return;
        }
        let estado = 200;
        try {
            // Una ruta com /reservar correspon al seu directori i al fitxer index.html.
            if ((await stat(archivo)).isDirectory()) {
                archivo = path.join(archivo, "index.html");
            }
            await stat(archivo);
        }
        catch {
            // Si no trobem la ruta, retornem la mateixa pàgina 404 que genera Astro.
            archivo = path.join(publico, "404.html");
            if (ruta !== "/404") {
                estado = 404;
            }
        }
        const contenido = await readFile(archivo);
        respuesta.setHeader("Content-Type", tipos[path.extname(archivo)] || "application/octet-stream");
        // No guardem respostes en memòria cau perquè les proves sempre llegeixin el build actual.
        respuesta.setHeader("Cache-Control", "no-store");
        respuesta.setHeader("X-Content-Type-Options", "nosniff");
        respuesta.statusCode = estado;
        // HEAD retorna les capçaleres sense el cos del fitxer, mentre GET retorna el contingut complet.
        respuesta.end(peticion.method === "HEAD" ? undefined : contenido);
    }
    catch {
        respuesta.writeHead(400).end();
    }
}).listen(Number(process.argv[2] || "4331"), "127.0.0.1");
