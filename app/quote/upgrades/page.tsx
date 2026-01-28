"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Container } from "@/components/Container";
import { Progress } from "@/components/Progress";
import { getFunnelState, updateFunnelState } from "@/components/funnelStore";
import { UPSELLS, UpsellId } from "@/components/upsellsCatalog";
import type { ShoeType } from "@/components/funnelStore";

const UPSELLS_BY_SHOETYPE: Record<ShoeType, UpsellId[]> = {
    trainers: ["shoe_trees", "stain_protect", "express_priority"],
    heels: ["express_priority", "stain_protect"],
    other: ["stain_protect", "express_priority", "shoe_trees"],
    caps: ["stain_protect", "express_priority"],
    kids: ["stain_protect", "express_priority"],
};

function ToggleCard({
    title,
    desc,
    price,
    checked,
    onToggle,
}: {
    title: string;
    desc: string;
    price?: number; // GBP, optional (care plan is subscription)
    checked: boolean;
    onToggle: () => void;
}) {
    return (
        <div className="rounded-xl border border-[#E5E5E5] bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <div className="flex flex-wrap items-baseline gap-3">
                        <div className="font-extrabold uppercase">{title}</div>
                        {typeof price === "number" && (
                            <div className="text-sm font-semibold text-black/70">£{price}</div>
                        )}
                    </div>
                    <div className="mt-2 text-sm text-black/70">{desc}</div>
                </div>

                <button
                    type="button"
                    onClick={onToggle}
                    className={[
                        "rounded-lg px-4 py-2 font-semibold transition",
                        checked ? "bg-[#1DB954] text-white" : "border border-black/20 bg-white hover:bg-black/5",
                    ].join(" ")}
                >
                    {checked ? "Added" : "Add"}
                </button>
            </div>
        </div>
    );
}

export default function QuoteUpgradesPage() {
    const router = useRouter();

    const s = useMemo(() => getFunnelState(), []);
    const shoeType = s.shoeType as ShoeType | undefined;

    // Guard rails: if steps are skipped
    if (!shoeType) {
        router.push("/quote/type");
    }

    const available: UpsellId[] = useMemo(() => {
        if (!shoeType) return [];
        return UPSELLS_BY_SHOETYPE[shoeType] ?? [];
    }, [shoeType]);

    const [selected, setSelected] = useState<UpsellId[]>(() => (s.upgrades ?? []) as UpsellId[]);
    const [noThanks, setNoThanks] = useState<boolean>(false);

    function toggle(id: UpsellId) {
        setNoThanks(false);
        setSelected((prev) => {
            const has = prev.includes(id);
            const next = has ? prev.filter((x) => x !== id) : [...prev, id];
            updateFunnelState({ upgrades: next });
            return next;
        });
    }

    function chooseNoThanks() {
        setNoThanks(true);
        setSelected([]);
        updateFunnelState({ upgrades: [] });
    }

    const backHref =
        shoeType === "caps" || shoeType === "kids" || shoeType === "other" ? "/quote/type" : "/quote/services";

    return (
        <main className="min-h-screen py-12">
            <Container>
                <Progress step={3} />

                <h1 className="text-3xl font-extrabold uppercase sm:text-4xl">Recommended upgrades</h1>
                <p className="mt-3 text-black/70">Most customers also add one of these for a better finish and longer-lasting results.</p>

                <div className="mt-8 grid gap-4">
                    {/* Shoe-type upgrades */}
                    {available.map((id) => {
                        const item = UPSELLS[id];
                        return (
                            <ToggleCard
                                key={id}
                                title={item.title}
                                desc={item.desc}
                                price={item.price}
                                checked={selected.includes(id)}
                                onToggle={() => toggle(id)}
                            />
                        );
                    })}

                    {/* Fixed Care Plan upsell (always shown) */}
                    <div className="rounded-2xl border border-[#1DB954]/30 bg-white p-6 shadow-sm">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <div className="text-sm font-semibold uppercase text-black/60">Best value (optional)</div>
                                <div className="mt-1 flex flex-wrap items-baseline gap-3 text-xl font-extrabold uppercase">
                                    <span>{UPSELLS.care_plan.title}</span>
                                    <span className="text-sm font-semibold text-black/70">£25/mo</span>
                                </div>
                                <div className="mt-2 text-sm text-black/70">{UPSELLS.care_plan.desc}</div>
                            </div>

                            <button
                                type="button"
                                onClick={() => toggle("care_plan")}
                                className={[
                                    "rounded-lg px-4 py-2 font-semibold transition",
                                    selected.includes("care_plan") ? "bg-[#1DB954] text-white" : "border border-black/20 bg-white hover:bg-black/5",
                                ].join(" ")}
                            >
                                {selected.includes("care_plan") ? "Added" : "Add"}
                            </button>
                        </div>
                    </div>

                    {/* No thanks */}
                    <div className="rounded-xl border border-black/10 bg-[#FAFAFA] p-5">
                        <label className="flex items-center gap-3 text-sm font-semibold text-black/80">
                            <input type="radio" name="upsell" checked={noThanks} onChange={chooseNoThanks} />
                            No, continue without upgrades
                        </label>
                    </div>
                </div>

                <div className="mt-10 flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => router.push(backHref)}
                        className="rounded-lg border border-black/20 bg-white px-6 py-3 font-semibold hover:bg-black/5"
                    >
                        Back
                    </button>

                    <button
                        type="button"
                        onClick={() => router.push("/checkout")}
                        className="rounded-lg bg-[#1DB954] px-6 py-3 font-semibold text-white transition hover:opacity-90"
                    >
                        Review & Checkout
                    </button>
                </div>

                <div className="mt-6 text-sm text-black/60">You can always edit selections on the checkout page.</div>
            </Container>
        </main>
    );
}

