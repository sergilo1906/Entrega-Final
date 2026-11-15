// Provem camps buits, dades massa llargues i missatges d’accés sense mostrar dades d’altres comptes.
import { describe, expect, it } from "vitest";
import { comprobarContacto, comprobarCorreo, comprobarFormulario } from "../../src/comun/formularios";
import { explicarErrorAcceso } from "../../src/comun/errores";
// Cada it és un cas de prova. expect comprova el resultat; si no coincideix, la prova falla.
describe("formularios de cuentas", () => {
    it("rechaza campos vacios, correo invalido y contrasena corta", () => {
        expect(comprobarFormulario("", "")).not.toBe("");
        expect(comprobarCorreo("correo-invalido")).not.toBe("");
        expect(comprobarFormulario("ficticio@example.test", "123")).not.toBe("");
        expect(comprobarFormulario("ficticio@example.test", "Prueba123!")).toBe("");
    });
    it("limita los datos del perfil y permite telefono opcional", () => {
        expect(comprobarContacto(" ", "")).not.toBe("");
        expect(comprobarContacto("a".repeat(101), "")).not.toBe("");
        expect(comprobarContacto("Ana", "1".repeat(31))).not.toBe("");
        expect(comprobarContacto("Ana", "")).toBe("");
    });
    it("no distingue una cuenta inexistente de una clave equivocada", () => {
        expect(explicarErrorAcceso({ code: "auth/user-not-found" })).toBe(explicarErrorAcceso({ code: "auth/wrong-password" }));
        expect(explicarErrorAcceso({ code: "auth/network-request-failed" })).toContain("connexió");
    });
});
