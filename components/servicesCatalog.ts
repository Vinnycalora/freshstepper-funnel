export type ServiceId = "louboutin_sole_refresh" | "deoxidisation" | "new_laces";

export type ServiceItem = {
    id: ServiceId;
    title: string;
    desc: string;
    price: number; // GBP
};

export const SERVICES: Record<ServiceId, ServiceItem> = {
    louboutin_sole_refresh: {
        id: "louboutin_sole_refresh",
        title: "Louboutin Sole Refresh (Standard Red)",
        desc: "Restore standard red sole finish.",
        price: 20,
    },
    deoxidisation: {
        id: "deoxidisation",
        title: "De-oxidisation",
        desc: "Reduce yellowing / oxidation where possible.",
        price: 25,
    },
    new_laces: {
        id: "new_laces",
        title: "New laces",
        desc: "Fresh replacement laces (when needed).",
        price: 10,
    },
};

