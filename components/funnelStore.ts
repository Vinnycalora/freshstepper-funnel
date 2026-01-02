export type ShoeType = "trainers" | "heels" | "other";

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
    services?: string[];
    upgrades?: string[];
    delivery?: DeliveryMethod;
    customer?: FunnelCustomer;
};

const STORAGE_KEY = "freshstepper:funnel_state:v1";

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
    inMemoryState = merged;
    writeStorage(merged);
    return merged;
}

export function resetFunnelState() {
    inMemoryState = { ...defaultFunnelState };
    writeStorage(inMemoryState);
    return inMemoryState;
}

