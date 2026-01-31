import { NextResponse } from "next/server";
import Stripe from "stripe";
import { upsertOrder } from "@/lib/orders";
import { computeOneTimeTotal } from "@/lib/pricing";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

type ShoeType = "trainers" | "heels" | "other" | "kids" | "caps";
type DeliveryMethod = "postal" | "dropoff";

type Body = {
    shoeType?: ShoeType | string;
    services?: string[]; // “needs add-ons” now!
    upgrades?: string[]; // upsells (may include "care_plan")
    delivery?: DeliveryMethod | string;

    fullName?: string;
    email?: string;
    phone?: string;

    // address fields (required for postal)
    addressLine1?: string;
    city?: string;
    postcode?: string;

    preferredDateTime?: string;
};

function gbpPence(pence: number) {
    return Math.max(0, Math.round(pence));
}

export async function POST(req: Request) {
    try {
        const body = (await req.json()) as Body;

        const origin = req.headers.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

        const shoeType = String(body.shoeType ?? "other");
        const services = Array.isArray(body.services) ? body.services.filter(Boolean) : [];
        const upgrades = Array.isArray(body.upgrades) ? body.upgrades.filter(Boolean) : [];
        const delivery = String(body.delivery ?? "postal").toLowerCase() as DeliveryMethod;

        const fullName = String(body.fullName ?? "");
        const email = String(body.email ?? "");
        const phone = String(body.phone ?? "");

        const addressLine1 = String(body.addressLine1 ?? "");
        const city = String(body.city ?? "");
        const postcode = String(body.postcode ?? "");

        const preferredDateTime = String(body.preferredDateTime ?? "");

        if (!email) return NextResponse.json({ error: "Missing email" }, { status: 400 });
        if (!fullName) return NextResponse.json({ error: "Missing fullName" }, { status: 400 });
        if (!phone) return NextResponse.json({ error: "Missing phone" }, { status: 400 });

        if (delivery === "postal") {
            if (!addressLine1 || !city || !postcode) {
                return NextResponse.json(
                    { error: "Postal delivery requires addressLine1, city, postcode" },
                    { status: 400 }
                );
            }
        }

        const hasCarePlan = upgrades.includes("care_plan");
        const carePlanPriceId = process.env.STRIPE_CARE_PLAN_PRICE_ID;

        // Totals: compute one-off total using shared pricing helper
        const upgradesForOneTime = upgrades.filter((u) => u !== "care_plan");
        const oneTimeTotal = computeOneTimeTotal(shoeType, services, upgradesForOneTime) ?? 0;


        // Single bundled one-off line item (keeps Stripe simple + preserves abandoned URL behaviour)
        const oneTimeLineItems: Stripe.Checkout.SessionCreateParams.LineItem[] =
            oneTimeTotal > 0
                ? [
                    {
                        price_data: {
                            currency: "gbp",
                            product_data: {
                                name: "Freshstepper Service",
                                description: `Type: ${shoeType} • Add-ons: ${services.join(", ") || "none"} • Upgrades: ${upgrades.filter((u) => u !== "care_plan").join(", ") || "none"}`,
                            },
                            unit_amount: oneTimeTotal,
                        },
                        quantity: 1,
                    },
                ]
                : [];

        const success_url = `${origin}/thank-you?session_id={CHECKOUT_SESSION_ID}`;
        const cancel_url = `${origin}/checkout?canceled=1`;

        const metadata: Record<string, string> = {
            shoeType,
            services: JSON.stringify(services),
            upgrades: JSON.stringify(upgrades),
            delivery,

            fullName,
            phone,
            preferredDateTime,

            // Sendcloud-required address fields (even if dropoff, keep stable keys)
            addressLine1: addressLine1 || "",
            city: city || "",
            postcode: postcode || "",
            country: "GB",
        };

        let session: Stripe.Checkout.Session;

        if (hasCarePlan) {
            if (!carePlanPriceId) {
                return NextResponse.json(
                    { error: "Missing STRIPE_CARE_PLAN_PRICE_ID for subscription mode" },
                    { status: 500 }
                );
            }

            session = await stripe.checkout.sessions.create({
                mode: "subscription",
                customer_email: email,
                success_url,
                cancel_url,
                metadata,
                line_items: [
                    { price: carePlanPriceId, quantity: 1 },
                    ...oneTimeLineItems, // optional one-time add-ons alongside subscription
                ],
            });
        } else {
            session = await stripe.checkout.sessions.create({
                mode: "payment",
                customer_email: email,
                success_url,
                cancel_url,
                metadata,
                line_items: oneTimeLineItems,
            });
        }

        // Save unpaid order at checkout start (for abandoned checker)
        upsertOrder({
            id: session.id,
            createdAt: new Date().toISOString(),
            email,
            customerEmail: email,
            name: fullName,
            phone,

            shoeType,
            services,
            upgrades,
            delivery,

            addressLine1: addressLine1 || null,
            city: city || null,
            postcode: postcode || null,

            preferredDateTime: preferredDateTime || null,

            paymentMode: hasCarePlan ? "subscription" : "one_off",
            paymentStatus: "unpaid",
            amountTotal: hasCarePlan ? null : gbpPence(oneTimeTotal),
            currency: "gbp",

            checkoutUrl: session.url || null,
        });

        return NextResponse.json({ url: session.url });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}


