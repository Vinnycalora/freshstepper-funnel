import type { ShoeType } from "@/components/funnelStore";
import type { ServiceId } from "@/components/servicesCatalog";

export type UpsellId =
    | "protector_spray"
    | "whitening"
    | "crease_guard"
    | "premium_finish"
    | "odour_plus"
    | "care_plan";

export type UpsellItem = {
    id: UpsellId;
    title: string;
    desc: string;
    // later we’ll add price + thumbnail
};

export const UPSELLS: Record<UpsellId, UpsellItem> = {
    protector_spray: {
        id: "protector_spray",
        title: "Protector Finish",
        desc: "Adds a protective coating to help repel dirt and stains.",
    },
    whitening: {
        id: "whitening",
        title: "Whitening Boost",
        desc: "Extra whitening focus for midsoles and lighter materials.",
    },
    crease_guard: {
        id: "crease_guard",
        title: "Crease Care",
        desc: "Extra attention to creases with safe conditioning techniques.",
    },
    premium_finish: {
        id: "premium_finish",
        title: "Premium Finish",
        desc: "Final polish + presentation finish for that ‘like new’ look.",
    },
    odour_plus: {
        id: "odour_plus",
        title: "Odour+ Upgrade",
        desc: "Enhanced deodorise treatment for heavily worn pairs.",
    },
    care_plan: {
        id: "care_plan",
        title: "Freshstepper Care Plan — £25/month",
        desc: "1 deep clean/month • 15% off all services • Priority turnaround • Free odour treatment add-on",
    },
};

export function recommendUpsells(input: {
    shoeType: ShoeType;
    services: ServiceId[];
}): UpsellId[] {
    const { shoeType, services } = input;
    const picks: UpsellId[] = [];

    // Always useful for most
    picks.push("protector_spray");

    // Trainers often want whitening + crease care
    if (shoeType === "trainers") {
        picks.push("whitening", "crease_guard");
    }

    // Heels: premium finish is good + protector
    if (shoeType === "heels") {
        picks.push("premium_finish");
    }

    // If they selected odour treatment, offer odour+ upgrade (or if they didn’t, still suggest lightly)
    if (services.includes("odour_treatment")) {
        picks.push("odour_plus");
    }

    // Keep it to max 3 dynamic items (care plan is fixed separately)
    const unique = Array.from(new Set(picks));
    return unique.slice(0, 3);
}
