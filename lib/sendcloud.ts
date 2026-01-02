type SendcloudAuth = {
    pub: string;
    secret: string;
};

function getAuth(): SendcloudAuth {
    const pub = process.env.SENDCLOUD_PUBLIC_KEY;
    const secret = process.env.SENDCLOUD_SECRET_KEY;
    if (!pub || !secret) throw new Error("Missing Sendcloud keys");
    return { pub, secret };
}

function authHeader() {
    const { pub, secret } = getAuth();
    const b64 = Buffer.from(`${pub}:${secret}`).toString("base64");
    return `Basic ${b64}`;
}

/**
 * Creates a parcel in Sendcloud. If your account/carrier supports it,
 * Sendcloud can generate a label + tracking.
 */
export async function createSendcloudParcel(input: {
    orderNumber: string;
    name: string;
    email: string;
    phone?: string | null;

    address: string;
    postalCode: string;
    city: string;
    country: string; // "GB"

    shipmentMethodId: number; // we’ll pick one from /shipping_methods
    weightKg?: number; // default 0.5
}) {
    const body = {
        parcel: {
            name: input.name,
            company_name: "Freshstepper",
            email: input.email,
            telephone: input.phone ?? "",

            address: input.address,
            postal_code: input.postalCode,
            city: input.city,
            country: input.country,

            order_number: String(input.orderNumber).slice(0, 50),

            shipment: {
                id: input.shipmentMethodId,
            },

            weight: (input.weightKg ?? 0.5).toFixed(3), // Sendcloud wants string
        },
    };

    const r = await fetch("https://panel.sendcloud.sc/api/v2/parcels", {
        method: "POST",
        headers: {
            Authorization: authHeader(),
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });

    const json = await r.json().catch(() => null);
    if (!r.ok) {
        throw new Error(`Sendcloud create parcel failed (${r.status}): ${JSON.stringify(json)}`);
    }
    return json;
}

export async function getSendcloudParcel(parcelId: number) {
    const r = await fetch(`https://panel.sendcloud.sc/api/v2/parcels/${parcelId}`, {
        method: "GET",
        headers: {
            Authorization: authHeader(),
            "Content-Type": "application/json",
        },
    });

    const json = await r.json().catch(() => null);
    if (!r.ok) {
        throw new Error(`Sendcloud get parcel failed (${r.status}): ${JSON.stringify(json)}`);
    }
    return json;
}
