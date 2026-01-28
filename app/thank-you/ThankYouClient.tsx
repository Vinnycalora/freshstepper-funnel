"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Container } from "@/components/Container";
import { SERVICE_LABELS, UPSELL_LABELS, shoeTypeLabel } from "@/components/labels";

type AnyOrder = any;

async function fetchOrder(sessionId: string): Promise<AnyOrder | null> {
    const candidates = [
        `/api/orders/get?session_id=${encodeURIComponent(sessionId)}`,
        `/api/orders/get?sessionId=${encodeURIComponent(sessionId)}`,
    ];

    for (const url of candidates) {
        try {
            const res = await fetch(url, { method: "GET" });
            if (!res.ok) continue;
            const data = await res.json();
            return (data?.order ?? data) as AnyOrder;
        } catch {
            // ignore
        }
    }
    return null;
}

const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;

function buildWhatsAppLink(order: any) {
  if (!WHATSAPP_NUMBER) return "#";

  const ref = order?.shortRef ? ` (Ref: ${order.shortRef})` : "";
  const msg = `Hi Freshstepper 👋 I’ve just placed an order${ref} and had a quick question.`;
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
}


function toPretty(list: unknown, map: Record<string, string>) {
    const arr = Array.isArray(list) ? list : [];
    return arr
        .map((v) => String(v))
        .filter(Boolean)
        .map((id) => map[id] ?? id);
}

export default function ThankYouClient() {
    const params = useSearchParams();
    const sessionId = params.get("session_id") ?? "";

    const [order, setOrder] = useState<AnyOrder | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;

        (async () => {
            if (!sessionId) {
                setLoading(false);
                return;
            }
            setLoading(true);
            const o = await fetchOrder(sessionId);
            if (!cancelled) {
                setOrder(o);
                setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [sessionId]);

    const shoeLabel = useMemo(() => shoeTypeLabel(order?.shoeType ?? null), [order?.shoeType]);
    const servicesPretty = useMemo(() => toPretty(order?.services, SERVICE_LABELS), [order?.services]);
    const upgradesPretty = useMemo(() => toPretty(order?.upgrades, UPSELL_LABELS), [order?.upgrades]);

    const delivery = String(order?.delivery ?? "");
    const trackingNumber = String(order?.sendcloudTrackingNumber ?? order?.trackingNumber ?? "");
    const trackingUrl = String(order?.sendcloudTrackingUrl ?? order?.trackingUrl ?? "");

    return (
        <main className="min-h-screen py-12">
            <Container>
                <div className="rounded-2xl border border-black/10 bg-white p-8 shadow-sm">
                    <div className="text-sm font-semibold uppercase text-black/60">Order confirmed</div>
                    <h1 className="mt-2 text-3xl font-extrabold uppercase sm:text-4xl">Thanks for your booking 👟</h1>

                    {!sessionId ? (
                        <div className="mt-4 rounded-xl border border-black/10 bg-black/5 p-4 text-sm text-black/70">
                            Missing session id — if you just paid, please check the URL includes <b>session_id</b>.
                        </div>
                    ) : loading ? (
                        <div className="mt-6 text-sm text-black/70">Loading your order details…</div>
                    ) : !order ? (
                        <div className="mt-4 rounded-xl border border-black/10 bg-black/5 p-4 text-sm text-black/70">
                            We couldn’t load your order details yet — but your payment may still have gone through.
                            If you need help, contact support with this session id: <b>{sessionId}</b>.
                        </div>
                    ) : (
                        <>
                            <div className="mt-6 grid gap-4 md:grid-cols-2">
                                <div className="rounded-xl border border-black/10 bg-white p-5">
                                    <div className="text-sm font-semibold uppercase text-black/60">Summary</div>

                                    <div className="mt-3 text-sm text-black/70">
                                        <b>Reference:</b> {order?.shortRef || "—"}
                                    </div>
                                    <div className="mt-2 text-sm text-black/70">
                                        <b>Name:</b> {order?.name || "—"}
                                    </div>
                                    <div className="mt-2 text-sm text-black/70">
                                        <b>Email:</b> {order?.email || order?.customerEmail || "—"}
                                    </div>
                                    <div className="mt-2 text-sm text-black/70">
                                        <b>Shoe type:</b> {shoeLabel}
                                    </div>
                                    <div className="mt-2 text-sm text-black/70">
                                        <b>Delivery:</b> {delivery || "—"}
                                    </div>

                                    {trackingNumber ? (
                                        <div className="mt-3 text-sm text-black/70">
                                            <b>Tracking:</b>{" "}
                                            {trackingUrl ? (
                                                <a className="font-semibold underline" href={trackingUrl} target="_blank" rel="noreferrer">
                                                    {trackingNumber}
                                                </a>
                                            ) : (
                                                trackingNumber
                                            )}
                                        </div>
                                    ) : (
                                        <div className="mt-3 text-sm text-black/60">Tracking will appear here once available.</div>
                                    )}
                                </div>

                                <div className="rounded-xl border border-black/10 bg-white p-5">
                                    <div className="text-sm font-semibold uppercase text-black/60">What you chose</div>

                                    <div className="mt-3 text-sm text-black/70">
                                        <b>Add-ons:</b>{" "}
                                        {servicesPretty.length ? (
                                            servicesPretty.join(", ")
                                        ) : (
                                            <span className="text-black/60">None (deep clean included by default)</span>
                                        )}
                                    </div>

                                    <div className="mt-3 text-sm text-black/70">
                                        <b>Upgrades:</b>{" "}
                                        {upgradesPretty.length ? upgradesPretty.join(", ") : <span className="text-black/60">None</span>}
                                    </div>

                                    {order?.preferredDateTime ? (
                                        <div className="mt-3 text-sm text-black/70">
                                            <b>Preferred time:</b> {String(order.preferredDateTime)}
                                        </div>
                                    ) : null}
                                </div>
                            </div>

                            <div className="mt-6 rounded-xl border border-black/10 bg-white p-6">
                                <div className="text-sm font-semibold uppercase text-black/60">Next steps</div>

                                <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-black/70">
                                    <li>Pack your item securely (use tissue/paper inside shoes to keep shape).</li>
                                    <li>
                                        Include a note with your name + reference <b>{order?.shortRef || ""}</b>.
                                    </li>
                                    <li>
                                        {delivery === "dropoff"
                                            ? "Drop off your item using the instructions provided by Freshstepper."
                                            : "Post your item using the instructions provided by Freshstepper. Your label/tracking will appear above when available."}
                                    </li>
                                </ol>

                                <div className="mt-4 text-sm text-black/60">
                                    Questions? Reply to your confirmation email, or contact support.
                                </div>
                            </div>

                            <div className="mt-6 rounded-xl border border-black/10 bg-white p-6">
                                <div className="text-sm font-semibold uppercase text-black/60">Need help?</div>

                                <p className="mt-2 text-sm text-black/70">
                                    If you have any questions about your order, packaging, or delivery, message us on WhatsApp.
                                </p>

                                <a
                                    href={buildWhatsAppLink(order)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="mt-4 inline-flex items-center gap-3 rounded-xl bg-[#25D366] px-5 py-3 text-sm font-semibold text-white hover:opacity-90"
                                >
                                    💬 Message us on WhatsApp
                                </a>
                            </div>

                        </>
                    )}
                </div>
            </Container>
        </main>
    );
}
