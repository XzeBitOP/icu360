import data from "../data/antimicrobials.json";
import type { Antimicrobial } from "../data/antimicrobial.types";
import { toRow, type AmRow } from "./antimicrobial-search";

export * from "./antimicrobial-search";

/** Full dataset — server components only (it is ~400 KB). */
export const ANTIMICROBIALS = data as Antimicrobial[];
export const ROWS: AmRow[] = ANTIMICROBIALS.map(toRow);

export function getAntimicrobial(id: string) {
  return ANTIMICROBIALS.find((a) => a.id === id);
}
