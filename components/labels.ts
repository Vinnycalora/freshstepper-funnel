import type { ShoeType } from "@/components/funnelStore";
import type { ServiceId } from "@/components/servicesCatalog";
import type { UpsellId } from "@/components/upsellsCatalog";

export function shoeTypeLabel(shoeType?: ShoeType | string | null) {
    switch (shoeType) {
        case "trainers":
            return "Trainers & Sneakers";
        case "heels":
            return "Luxury Heels";
        case "other":
            return "Boots / UGGs / Other";
        case "kids":
            return "Kids Shoes";
        case "caps":
            return "Caps";
        default:
            return "—";
    }
}

export const SERVICE_LABELS: Record<string, string> = {
    louboutin_sole_refresh: "Louboutin Sole Refresh (Standard Red)",
    deoxidisation: "De-oxidisation",
    new_laces: "New laces",
};

export const UPSELL_LABELS: Record<string, string> = {
    shoe_trees: "Shoe trees",
    stain_protect: "Stain protective spray",
    express_priority: "Express priority service",
    care_plan: "Freshstepper Care Plan (£25/mo)",
};

