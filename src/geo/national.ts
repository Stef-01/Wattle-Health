// Every Australian suburb and postcode (founder 2026-10-20: "expand to all states"), from the
// GeoNames postal-code export (CC BY 4.0) in data/geo/au-postcodes.json. Server only (fs): the
// browser keeps the small hand table, and resolvePlace falls back to these rows once registered.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { registerPlaces, type SuburbPoint } from "./suburbs";

let done = false;
export function ensureNational(root = process.cwd()): void {
  if (done) return;
  done = true;
  const file = path.join(root, "data", "geo", "au-postcodes.json");
  if (!existsSync(file)) return;
  const { rows } = JSON.parse(readFileSync(file, "utf8")) as { rows: [string, string, string, number, number][] };
  registerPlaces(rows.map(([suburb, postcode, state, lat, lon]): SuburbPoint => ({ suburb, postcode, state, lat, lon })));
}
ensureNational();
