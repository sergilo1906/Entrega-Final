// Dades que necessitem per mostrar l’horari i el professional de la barberia.
import type { DiaHorario } from "./agenda";
// Un únic horari setmanal i una zona horària per a tota la barberia.
export interface ConfiguracionAgenda {
    // Zona IANA del negoci, necessària per calcular el dia i els instants de les cites.
    timezone: string;
    // Set posicions en ordre de diumenge a dissabte; cada dia guarda les seves franges.
    days: DiaHorario[];
    // Nom visible del recurs principal; no introdueix un altre rol de compte.
    professionalName?: string;
}
