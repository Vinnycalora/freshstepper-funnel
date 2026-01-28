import type { ShoeType } from "@/components/funnelStore";

export type UpsellId = "shoe_trees" | "stain_protect" | "express_priority" | "care_plan";

export type UpsellItem = {
    id: UpsellId;
    title: string;
    desc: string;
    /**
     * One-off upgrade price in GBP.
     * (Care plan is subscription, so it does not use a one-off price here.)
     */
    price?: number;
};

export const UPSELLS: Record<UpsellId, UpsellItem> = {
    shoe_trees: {
        id: "shoe_trees",
        title: "Shoe trees",
        desc: "Helps shoes keep their shape and reduces creasing.",
        price: 5,
    },
    stain_protect: {
        id: "stain_protect",
        title: "Stain protective spray",
        desc: "Protects against light stains and helps keep shoes looking fresh.",
        price: 10,
    },
    express_priority: {
        id: "express_priority",
        title: "Express priority service",
        desc: "Priority processing for a faster turnaround.",
        price: 20,
    },
    care_plan: {
        id: "care_plan",
        title: "Freshstepper Care Plan",
        desc: "£25/month • 1 deep clean per month • 15% off all services • Priority turnaround • Free odour treatment add-on.",
    },
};

/**
 * Kept for compatibility / future use.
 * (Your upgrades page now uses a shoe-type mapping directly.)
 */
export function recommendUpsells(input: { shoeType: ShoeType; services: string[] }): UpsellId[] {
    const { shoeType } = input;

    switch (shoeType) {
        case "trainers":
            return ["shoe_trees", "stain_protect", "express_priority"];
        case "heels":
            return ["express_priority", "stain_protect"];
        case "other":
            return ["stain_protect", "express_priority", "shoe_trees"];
        case "caps":
            return ["stain_protect", "express_priority"];
        case "kids":
            return ["stain_protect", "express_priority"];
        default:
            return ["stain_protect", "express_priority"];
    }
}

