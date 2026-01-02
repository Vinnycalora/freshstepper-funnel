import type { ShoeType } from "@/components/funnelStore";

export const BASE_PRICES_GBP: Record<ShoeType, number> = {
    trainers: 35,
    heels: 45,
    other: 40,
};

export const SERVICE_PRICES_GBP: Record<string, number> = {
    deep_clean: 0,          // included in base for prototype
    colour_restore: 20,
    sole_repaint: 18,
    heel_repair: 22,
    stitch_repair: 15,
    suede_renewal: 18,
    odour_treatment: 10,
    fabric_refresh: 12,
    lace_replacement: 8,
    unsure: 0,
};

export const UPSELL_PRICES_GBP: Record<string, number> = {
    protector_spray: 8,
    whitening: 6,
    crease_guard: 7,
    premium_finish: 10,
    odour_plus: 6,
};

// Care plan (subscription)
export const CARE_PLAN_GBP_PER_MONTH = 25;
