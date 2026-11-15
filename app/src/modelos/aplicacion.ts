// Dades que necessitem per mostrar l’horari i el professional de la barberia.
import type { DiaHorario } from "./agenda";
// Un únic horari setmanal i una zona horària per a tota la barberia.
export interface ConfiguracionAgenda {
    timezone: string;
    days: DiaHorario[];
    professionalName?: string;
}
