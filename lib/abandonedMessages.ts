import { SERVICE_LABELS, UPSELL_LABELS, shoeTypeLabel } from "@/components/labels";

function prettyList(ids: unknown, kind: "service" | "upgrade"): string[] {
    const arr = Array.isArray(ids) ? ids : [];
    return arr
        .map((v) => String(v))
        .filter(Boolean)
        .map((id) => {
            if (kind === "service") return SERVICE_LABELS[id] ?? id;
            return UPSELL_LABELS[id] ?? id;
        });
}

function buildSummary(order: any) {
    const shoe = shoeTypeLabel(order?.shoeType ?? null);

    const servicesPretty = prettyList(order?.services, "service");
    const upgradesPretty = prettyList(order?.upgrades, "upgrade");

    const addOnsLine =
        servicesPretty.length > 0
            ? `Add-ons: ${servicesPretty.join(", ")}`
            : `Add-ons: none (deep clean included by default)`;

    const upgradesLine =
        upgradesPretty.length > 0 ? `Upgrades: ${upgradesPretty.join(", ")}` : `Upgrades: none`;

    return { shoe, addOnsLine, upgradesLine };
}

export function buildStage1(order: any) {
    const { shoe, addOnsLine, upgradesLine } = buildSummary(order);

    return {
        whatsapp: `Hi ${order?.name || "there"} 👋

You were just checking out Freshstepper for your ${shoe}.
${addOnsLine}
${upgradesLine}

Finish your booking here:
${order?.checkoutUrl}

Any questions? Just reply 👍`,
        email: {
            subject: "Your Freshstepper quote is ready 👟",
            body: `Hi ${order?.name || ""},

You were almost done booking with Freshstepper.

${shoe}
${addOnsLine}
${upgradesLine}

Complete your booking here:
${order?.checkoutUrl}

Need help? Reply to this email and we’ll get you sorted.

— Freshstepper`,
        },
    };
}

export function buildStage2(order: any) {
    const { shoe } = buildSummary(order);
    return {
        sms: `Freshstepper: Your quote for ${shoe} is ready. Complete your booking here: ${order?.checkoutUrl}`,
    };
}

export function buildStage3(order: any) {
    const { shoe } = buildSummary(order);
    return {
        final: `Last reminder from Freshstepper 👟
Your quote (${order?.shortRef || "—"}) for ${shoe} will expire soon.

Complete here:
${order?.checkoutUrl}`,
    };
}
