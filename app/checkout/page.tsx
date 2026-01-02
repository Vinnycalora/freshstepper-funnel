"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Container } from "@/components/Container";
import { Progress } from "@/components/Progress";
import {
    getFunnelState,
    updateFunnelState,
    type FunnelState,
} from "@/components/funnelStore";
import { SERVICE_LABELS, UPSELL_LABELS, shoeTypeLabel } from "@/components/labels";

type DeliveryMethod = "postal" | "dropoff";

type FormState = {
    fullName: string;
    email: string;
    phone: string;
    postcode: string;
    address: string;
    city: string;
    preferredDateTime: string;
    delivery: DeliveryMethod;
};

function Field({
    label,
    value,
    onChange,
    placeholder,
    type = "text",
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    type?: string;
}) {
    return (
        <label className="block">
            <div className="text-sm font-semibold text-black/80">{label}</div>
            <input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="mt-2 w-full rounded-lg border border-black/15 bg-white px-4 py-3 text-sm outline-none focus:border-[#1DB954]"
            />
        </label>
    );
}

export default function CheckoutPage() {
    const router = useRouter();

    // Client-only funnel state: start as null to avoid SSR/CSR mismatch
    const [s, setS] = useState<FunnelState | null>(null);

    // Guard so we only prefill the form once after funnel state loads
    const prefilledRef = useRef(false);

    // Load funnel state after mount (client-only)
    useEffect(() => {
        // getFunnelState reads localStorage/inMemoryState — safe here on client
        const state = getFunnelState();
        setS(state);
    }, []);

    // Redirect only after we have loaded the funnel state
    useEffect(() => {
        if (!s) return;
        const shoeType = s.shoeType;
        const services = s.services ?? [];
        if (!shoeType) {
            router.replace("/quote/type");
        } else if (!services.length) {
            router.replace("/quote/services");
        }
    }, [s, router]);

    // Form state initialised empty; will be prefixed from funnel state once after load
    const [form, setForm] = useState<FormState>(() => ({
        fullName: "",
        email: "",
        phone: "",
        postcode: "",
        address: "",
        city: "",
        preferredDateTime: "",
        delivery: "postal",
    }));

    // Prefill form once after funnel state loads
    useEffect(() => {
        if (!s || prefilledRef.current) return;
        prefilledRef.current = true;

        setForm({
            fullName: s.customer?.fullName ?? "",
            email: s.customer?.email ?? "",
            phone: s.customer?.phone ?? "",
            postcode: s.customer?.postcode ?? "",
            address: s.customer?.address ?? "",
            city: s.customer?.city ?? "",
            preferredDateTime: s.customer?.preferredDateTime ?? "",
            delivery: (s.delivery as DeliveryMethod) ?? "postal",
        });
    }, [s]);

    const [touched, setTouched] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const errors = {
        fullName: !form.fullName.trim(),
        email: !/^\S+@\S+\.\S+$/.test(form.email),
        phone: form.phone.trim().length < 7,
        postcode: !form.postcode.trim(),
        address: !form.address.trim(),
        city: form.delivery === "postal" && !form.city.trim(),
    };

    const isValid =
        !errors.fullName &&
        !errors.email &&
        !errors.phone &&
        !errors.postcode &&
        !errors.address &&
        !errors.city;


    function saveToStore(next: Partial<FormState>) {
        const merged = { ...form, ...next };
        setForm(merged);

        updateFunnelState({
            delivery: merged.delivery,
            customer: {
                fullName: merged.fullName,
                email: merged.email,
                phone: merged.phone,
                postcode: merged.postcode,
                address: merged.address,
                city: merged.city,
                preferredDateTime: merged.preferredDateTime,
            },
        });
    }

    async function payWithStripe() {
        setTouched(true);
        if (!isValid || submitting) return;

        setSubmitting(true);

        try {
            // Pull the latest state from storage (so it includes any final edits)
            const state = getFunnelState();

            const payload = {
                shoeType: state.shoeType,
                services: state.services ?? [],
                upgrades: state.upgrades ?? [],
                delivery: form.delivery,

                fullName: form.fullName,
                email: form.email,
                phone: form.phone,

                addressLine1: form.address,
                city: form.city,
                postcode: form.postcode,

                preferredTime: form.preferredDateTime,
            };

            console.log("Create session payload:", payload);
            
            const res = await fetch("/api/stripe/create-session", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const data = await res.json();

            if (data?.url) {
                window.location.href = data.url;
                return;
            }

            alert(data?.error ?? "Failed to start Stripe Checkout.");
        } catch (err: any) {
            alert(err?.message ?? "Stripe error");
        } finally {
            setSubmitting(false);
        }
    }

    // While we haven't loaded client funnel state, render a safe placeholder to avoid hydration mismatch
    if (!s) {
        return (
            <main className="min-h-screen py-12">
                <Container>
                    <Progress step={4} />
                    <div className="mt-8 text-center text-sm text-black/60">Loading…</div>
                </Container>
            </main>
        );
    }

    const shoeType = s.shoeType;
    const services = s.services ?? [];
    const upgrades = s.upgrades ?? [];

    const servicesPretty = services.map((id) => SERVICE_LABELS[id] ?? id);
    const upgradesPretty = upgrades.map((id) => UPSELL_LABELS[id] ?? id);

    return (
        <main className="min-h-screen py-12">
            <Container>
                <Progress step={4} />

                <div className="grid gap-8 lg:grid-cols-3">
                    {/* LEFT */}
                    <div className="lg:col-span-2">
                        <h1 className="text-3xl font-extrabold uppercase sm:text-4xl">
                            Checkout
                        </h1>
                        <p className="mt-3 text-black/70">
                            Secure checkout powered by Stripe. UK wide shipping or drop-off.
                        </p>

                        {/* Discount banner */}
                        <div className="mt-6 rounded-2xl border border-[#1DB954]/25 bg-white p-5 shadow-sm">
                            <div className="font-extrabold uppercase">
                                ✨ £5 OFF applied for first-time customers
                            </div>
                            <div className="mt-1 text-sm text-black/70">
                                (We’ll enforce this in Stripe/webhooks next.)
                            </div>
                        </div>

                        {/* Customer details */}
                        <div className="mt-6 rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
                            <div className="text-sm font-semibold uppercase text-black/60">
                                Customer details
                            </div>

                            <div className="mt-5 grid gap-4 sm:grid-cols-2">
                                <div>
                                    <Field
                                        label="Full name"
                                        value={form.fullName}
                                        onChange={(v) => saveToStore({ fullName: v })}
                                        placeholder="Ollie Pratt"
                                    />
                                    {touched && errors.fullName && (
                                        <div className="mt-2 text-xs text-red-600">
                                            Please enter your name.
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <Field
                                        label="Email"
                                        value={form.email}
                                        onChange={(v) => saveToStore({ email: v })}
                                        placeholder="you@email.com"
                                        type="email"
                                    />
                                    {touched && errors.email && (
                                        <div className="mt-2 text-xs text-red-600">
                                            Enter a valid email.
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <Field
                                        label="Phone"
                                        value={form.phone}
                                        onChange={(v) => saveToStore({ phone: v })}
                                        placeholder="07..."
                                    />
                                    {touched && errors.phone && (
                                        <div className="mt-2 text-xs text-red-600">
                                            Enter a valid phone number.
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <Field
                                        label="Postcode"
                                        value={form.postcode}
                                        onChange={(v) => saveToStore({ postcode: v })}
                                        placeholder="TS18..."
                                    />
                                    {touched && errors.postcode && (
                                        <div className="mt-2 text-xs text-red-600">
                                            Postcode required.
                                        </div>
                                    )}
                                </div>

                                <div className="sm:col-span-2">
                                    <Field
                                        label="Address"
                                        value={form.address}
                                        onChange={(v) => saveToStore({ address: v })}
                                        placeholder="House number, street, city"
                                    />
                                    {touched && errors.address && (
                                        <div className="mt-2 text-xs text-red-600">
                                            Address required.
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <Field
                                        label="City"
                                        value={form.city}
                                        onChange={(v) => saveToStore({ city: v })}
                                        placeholder="e.g. Stockton-on-Tees"
                                    />
                                    {touched && errors.city && (
                                        <div className="mt-2 text-xs text-red-600">
                                            City required for postal delivery.
                                        </div>
                                    )}
                                </div>



                                <div className="sm:col-span-2">
                                    <Field
                                        label="Preferred collection/drop-off date & time (optional)"
                                        value={form.preferredDateTime}
                                        onChange={(v) => saveToStore({ preferredDateTime: v })}
                                        placeholder="e.g. Tue 3pm"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Delivery */}
                        <div className="mt-6 rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
                            <div className="text-sm font-semibold uppercase text-black/60">
                                Delivery method
                            </div>

                            <div className="mt-5 grid gap-3 sm:grid-cols-2">
                                <button
                                    type="button"
                                    onClick={() => saveToStore({ delivery: "postal" })}
                                    className={[
                                        "rounded-xl border p-5 text-left shadow-sm transition",
                                        form.delivery === "postal"
                                            ? "border-[#1DB954] ring-2 ring-[#1DB954]/20"
                                            : "border-[#E5E5E5] hover:border-[#1DB954]",
                                    ].join(" ")}
                                >
                                    <div className="font-extrabold uppercase">Postal (UK wide)</div>
                                    <div className="mt-2 text-sm text-black/70">
                                        We’ll email shipping instructions after checkout.
                                    </div>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => saveToStore({ delivery: "dropoff" })}
                                    className={[
                                        "rounded-xl border p-5 text-left shadow-sm transition",
                                        form.delivery === "dropoff"
                                            ? "border-[#1DB954] ring-2 ring-[#1DB954]/20"
                                            : "border-[#E5E5E5] hover:border-[#1DB954]",
                                    ].join(" ")}
                                >
                                    <div className="font-extrabold uppercase">In-person drop-off</div>
                                    <div className="mt-2 text-sm text-black/70">
                                        We’ll confirm drop-off instructions after checkout.
                                    </div>
                                </button>
                            </div>
                        </div>

                        {/* CTA */}
                        <div className="mt-8 flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => router.push("/quote/upgrades")}
                                className="rounded-lg border border-black/20 bg-white px-6 py-3 font-semibold hover:bg-black/5"
                            >
                                Back
                            </button>

                            <button
                                type="button"
                                onClick={payWithStripe}
                                disabled={submitting}
                                className={[
                                    "rounded-lg px-6 py-3 font-semibold text-white transition",
                                    submitting ? "bg-black/30 cursor-not-allowed" : "bg-[#1DB954] hover:opacity-90",
                                ].join(" ")}
                            >
                                {submitting ? "Redirecting…" : "Pay securely (Stripe)"}
                            </button>
                        </div>

                        {/* Trust */}
                        <div className="mt-6 flex flex-wrap gap-2 text-sm text-black/60">
                            <span className="rounded-full border border-black/10 bg-white px-3 py-1">
                                🔒 Secure 256-bit encryption
                            </span>
                            <span className="rounded-full border border-black/10 bg-white px-3 py-1">
                                Stripe checkout
                            </span>
                            <span className="rounded-full border border-black/10 bg-white px-3 py-1">
                                Eco-friendly service
                            </span>
                            <span className="rounded-full border border-black/10 bg-white px-3 py-1">
                                Support via WhatsApp
                            </span>
                        </div>
                    </div>

                    {/* RIGHT: Summary */}
                    <aside className="lg:sticky lg:top-6">
                        <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
                            <div className="flex items-center justify-between">
                                <div className="text-sm font-semibold uppercase text-black/60">
                                    Order summary
                                </div>
                                <button
                                    type="button"
                                    onClick={() => router.push("/quote/type")}
                                    className="text-sm font-semibold text-[#1DB954] hover:underline"
                                >
                                    Edit
                                </button>
                            </div>

                            <div className="mt-4">
                                <div className="text-sm font-semibold uppercase text-black/60">
                                    Shoe type
                                </div>
                                <div className="mt-1 font-bold">{shoeTypeLabel(shoeType)}</div>
                            </div>

                            <div className="mt-4">
                                <div className="text-sm font-semibold uppercase text-black/60">
                                    Restoration
                                </div>
                                <ul className="mt-2 space-y-1 text-sm text-black/80">
                                    {servicesPretty.map((x) => (
                                        <li key={x}>• {x}</li>
                                    ))}
                                </ul>
                            </div>

                            {!!upgradesPretty.length && (
                                <div className="mt-4">
                                    <div className="text-sm font-semibold uppercase text-black/60">
                                        Upgrades
                                    </div>
                                    <ul className="mt-2 space-y-1 text-sm text-black/80">
                                        {upgradesPretty.map((x) => (
                                            <li key={x}>• {x}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <div className="mt-4">
                                <div className="text-sm font-semibold uppercase text-black/60">
                                    Delivery
                                </div>
                                <div className="mt-1 text-sm text-black/80">
                                    {form.delivery === "postal" ? "Postal" : "In-person drop-off"}
                                </div>
                            </div>

                            <div className="mt-6 rounded-xl border border-[#1DB954]/20 bg-[#FAFAFA] p-4">
                                <div className="font-extrabold uppercase">Savings meter</div>
                                <div className="mt-2 text-sm text-black/70">
                                    You save an average of <span className="font-semibold">£150</span> vs buying new.
                                    <br />
                                    Choosing restoration helps reduce landfill waste.
                                </div>
                            </div>

                            <div className="mt-6 flex items-center justify-between border-t border-black/10 pt-4">
                                <div className="text-sm font-semibold uppercase text-black/60">Total</div>
                                <div className="text-xl font-extrabold">Calculated in Stripe</div>
                            </div>

                            <div className="mt-2 text-xs text-black/50">
                                Next: pricing rules + first-time discount enforcement via webhook.
                            </div>
                        </div>
                    </aside>
                </div>
            </Container>
        </main>
    );
}


