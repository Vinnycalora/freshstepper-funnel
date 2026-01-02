export function buildStage1(order: any) {
    return {
        whatsapp: `Hi ${order.name || "there"} 👋  
You were just checking out Freshstepper for your ${order.shoeType}.

You selected: ${order.services?.join(", ") || "services"}.

Finish your booking here:
${order.checkoutUrl}

Need help? Just reply 👍`,
        email: {
            subject: "Your Freshstepper quote is ready 👟",
            body: `Hi ${order.name || ""},

You were almost done booking your shoe restoration.

Shoe: ${order.shoeType}
Services: ${order.services?.join(", ") || "—"}

Complete your booking here:
${order.checkoutUrl}

Any questions — just reply to this email.`,
        },
    };
}

export function buildStage2(order: any) {
    return {
        sms: `Freshstepper reminder 👟  
Your shoe cleaning quote is still open.

Finish booking:
${order.checkoutUrl}`,
    };
}

export function buildStage3(order: any) {
    return {
        final: `Last reminder from Freshstepper 👟  
Your quote (${order.shortRef}) will expire soon.

Complete here:
${order.checkoutUrl}`,
    };
}
