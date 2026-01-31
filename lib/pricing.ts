export type ShoeType = "trainers" | "heels" | "other" | "kids" | "caps";

function normalizeShoeType(v: unknown): ShoeType {
  const s = String(v ?? "").toLowerCase();
  if (s === "trainers" || s === "heels" || s === "other" || s === "kids" || s === "caps") return s as ShoeType;
  return "other";
}

function ensureStringArray(v: any): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch {}
    return v.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

// Client prices (pence)
const BASE_BY_SHOE: Record<ShoeType, number> = {
  trainers: 4000,
  heels: 4000,
  other: 3500,
  kids: 2500,
  caps: 2500,
};

const SERVICE_PRICE: Record<string, number> = {
  louboutin_sole_refresh: 2000,
  deoxidisation: 2500,
  new_laces: 1000,
};

const UPGRADE_PRICE: Record<string, number> = {
  shoe_trees: 500,
  stain_protect: 1000,
  express_priority: 2000,
};

/**
 * Compute one-off total (in minor units, e.g. pence) from given order parts.
 * Returns null if the order is subscription/care_plan and no one-off total should be shown.
 */
export function computeOneTimeTotal(
  rawShoeType: unknown,
  rawServices?: unknown,
  rawUpgrades?: unknown
): number | null {
  const shoeType = normalizeShoeType(rawShoeType);
  const services = ensureStringArray(rawServices);
  const upgrades = ensureStringArray(rawUpgrades);

  // If care_plan present, this is a subscription product; no one-off total
  if (upgrades.includes("care_plan")) return null;

  const base = BASE_BY_SHOE[shoeType] ?? BASE_BY_SHOE.other;
  const serviceTotal = services.reduce((s, id) => s + (SERVICE_PRICE[id] ?? 0), 0);
  const upgradeTotal = upgrades.reduce((s, id) => s + (UPGRADE_PRICE[id] ?? 0), 0);

  const total = Math.max(0, Math.round(base + serviceTotal + upgradeTotal));
  return total;
}