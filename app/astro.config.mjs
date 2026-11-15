// Configuració per generar les pàgines de la web com a fitxers HTML.
import { defineConfig } from "astro/config";

export default defineConfig({
  output: "static",
  integrations: [],
  devToolbar: { enabled: false },
  vite: { css: { devSourcemap: true } },
});
