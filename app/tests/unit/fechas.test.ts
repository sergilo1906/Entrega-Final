// Comprovem les dates del negoci i els casos on una hora no existeix pel canvi d’hora.
import { expect, it } from "vitest";
import { esFechaCalendarioValida, formatearFechaNegocio, sumarDiasCalendario, obtenerInicioCita } from "../../src/comun/fechas";
// El mateix instant pot ser un dia diferent segons el país; hem de mostrar el dia del negoci.
it("usa la zona del negocio aunque el navegador este en otro dia", () => {
    const instante = new Date("2026-11-09T23:30:00Z");
    expect(formatearFechaNegocio("Europe/Madrid", instante)).toBe("2026-11-10");
    expect(formatearFechaNegocio("Pacific/Honolulu", instante)).toBe("2026-11-09");
    expect(sumarDiasCalendario("2026-12-20", 30)).toBe("2027-01-19");
});
it("rechaza fechas imposibles y horas inexistentes de datos antiguos", () => {
    expect(esFechaCalendarioValida("2030-02-30")).toBe(false);
    expect(Number.isNaN(obtenerInicioCita({ dateStr: "2027-03-28", timeStr: "02:00" }, "Europe/Madrid").getTime())).toBe(true);
});
