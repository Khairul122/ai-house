import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { settings } from "../../db/schema/index.js";

// "auto": rencana disetujui dan aksi level 3 dijalankan otomatis (tetap dicatat di laporan).
// "ask": seperti semula, menunggu keputusan pemilik. Aksi level 4 selalu ditolak di kedua mode.
export type Autonomy = "auto" | "ask";

const KEY = "autonomy";

export async function getAutonomy(): Promise<Autonomy> {
  const row = await db.query.settings.findFirst({
    where: eq(settings.key, KEY),
  });
  if (row) return JSON.parse(row.valueJson) === "ask" ? "ask" : "auto";
  return process.env.AUTONOMY === "ask" ? "ask" : "auto";
}

export async function setAutonomy(mode: Autonomy) {
  const valueJson = JSON.stringify(mode);
  await db
    .insert(settings)
    .values({ key: KEY, valueJson })
    .onConflictDoUpdate({ target: settings.key, set: { valueJson } });
}
