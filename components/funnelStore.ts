export type ShoeType = "trainers" | "heels" | "other" | "kids" | "caps";

export type FunnelCustomer = {
    fullName?: string;
    email?: string;
    phone?: string;
    postcode?: string;
    address?: string;
    city?: string;
    preferredDateTime?: string;
};

export type DeliveryMethod = "postal" | "dropoff";

export type FunnelState = {
    shoeType?: ShoeType;
    services?: string[]; // "needs add-ons"
    upgrades?: string[]; // upsells incl. care_plan
    delivery?: DeliveryMethod;
    customer?: FunnelCustomer;
};

const STORAGE_KEY = "freshstepper:funnel_state:v1";

// ✅ Shoe-type validity rules (prevents invalid carry-over)
const ALLOWED_SERVICES_BY_SHOETYPE: Record<ShoeType, string[]> = {
    trainers: ["louboutin_sole_refresh", "deoxidisation", "new_laces"],
    heels: ["louboutin_sole_refresh"],
    other: [],
    kids: [],
    caps: [],
};

const ALLOWED_UPGRADES_BY_SHOETYPE: Record<ShoeType, string[]> = {
    trainers: ["shoe_trees", "stain_protect", "express_priority", "care_plan"],
    heels: ["stain_protect", "express_priority", "care_plan"],
    other: ["shoe_trees", "stain_protect", "express_priority", "care_plan"],
    kids: ["stain_protect", "express_priority", "care_plan"],
    caps: ["stain_protect", "express_priority", "care_plan"],
};

export const defaultFunnelState: FunnelState = {
    shoeType: undefined,
    services: [],
    upgrades: [],
    delivery: "postal",
    customer: {},
};

let inMemoryState: FunnelState | null = null;

function readStorage(): FunnelState {
    if (typeof window === "undefined") return { ...defaultFunnelState };
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return { ...defaultFunnelState };
        const parsed = JSON.parse(raw) as FunnelState;
        return { ...defaultFunnelState, ...parsed };
    } catch {
        return { ...defaultFunnelState };
    }
}

function writeStorage(state: FunnelState) {
    if (typeof window === "undefined") return;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
        // ignore storage errors
    }
}

export function getFunnelState(): FunnelState {
    if (inMemoryState) return inMemoryState;
    const s = readStorage();
    inMemoryState = s;
    return s;
}

export function updateFunnelState(next: Partial<FunnelState>) {
    const current = getFunnelState();

    // Merge customer deeply if provided
    const customer =
        next.customer !== undefined ? { ...(current.customer ?? {}), ...(next.customer ?? {}) } : current.customer;

    const merged: FunnelState = {
        ...current,
        ...next,
        customer,
    };

    // ✅ If shoeType is set/changed, prune invalid services/upgrades
    if (merged.shoeType) {
        const allowedServices = ALLOWED_SERVICES_BY_SHOETYPE[merged.shoeType] ?? [];
        const allowedUpgrades = ALLOWED_UPGRADES_BY_SHOETYPE[merged.shoeType] ?? [];

        merged.services = (merged.services ?? []).filter((id) => allowedServices.includes(id));
        merged.upgrades = (merged.upgrades ?? []).filter((id) => allowedUpgrades.includes(id));
    }

    inMemoryState = merged;
    writeStorage(merged);
    return merged;
}

export function resetFunnelState() {
    inMemoryState = { ...defaultFunnelState };
    writeStorage(inMemoryState);
    return inMemoryState;
}
