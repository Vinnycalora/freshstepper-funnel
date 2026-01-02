import type { ShoeType } from "@/components/funnelStore";

export function shoeTypeLabel(t?: ShoeType) {
    if (t === "trainers") return "Trainers";
    if (t === "heels") return "Luxury Heels";
    if (t === "other") return "Boots / UGGs / Other";
    return "Not set";
}

export const SERVICE_LABELS: Record<string, string> = {
    deep_clean: "Deep clean",
    colour_restore: "Colour restoration",
    sole_repaint: "Sole repaint",
    heel_repair: "Heel repair",
    stitch_repair: "Stitch repair",
    suede_renewal: "Suede renewal",
    odour_treatment: "Odour treatment",
    fabric_refresh: "Fabric refresh",
    lace_replacement: "Lace replacement",
    unsure: "Unsure (we’ll assess)",
};

export const UPSELL_LABELS: Record<string, string> = {
    protector_spray: "Protector Finish",
    whitening: "Whitening Boost",
    crease_guard: "Crease Care",
    premium_finish: "Premium Finish",
    odour_plus: "Odour+ Upgrade",
    care_plan: "Freshstepper Care Plan (£25/month)",
};
