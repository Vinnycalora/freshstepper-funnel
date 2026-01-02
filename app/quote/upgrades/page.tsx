"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Container } from "@/components/Container";
import { Progress } from "@/components/Progress";
import { getFunnelState, updateFunnelState } from "@/components/funnelStore";
import { recommendUpsells, UPSELLS, UpsellId } from "@/components/upsellsCatalog";
import type { ServiceId } from "@/components/servicesCatalog";
import type { ShoeType } from "@/components/funnelStore";

function ToggleCard({
    title,
    desc,
    checked,
    onToggle,
}: {
    title: string;
    desc: string;
    checked: boolean;
    onToggle: () => void;
}) {
    return (
        <div className="rounded-xl border border-[#E5E5E5] bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <div className="font-extrabold uppercase">{title}</div>
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
    const services = (s.services ?? []) as ServiceId[];

    // Guard rails: if steps are skipped
    if (!shoeType) {
        router.push("/quote/type");
    }

    const recommended = useMemo(() => {
        if (!shoeType) return [];
        return recommendUpsells({ shoeType, services });
    }, [shoeType, services]);

    const [selected, setSelected] = useState<UpsellId[]>(
        () => (s.upgrades ?? []) as UpsellId[]
    );
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

    return (
        <main className="min-h-screen py-12">
            <Container>
                <Progress step={3} />

                <h1 className="text-3xl font-extrabold uppercase sm:text-4xl">
                    Recommended upgrades
                </h1>
                <p className="mt-3 text-black/70">
                    Most customers also add one of these for a better finish and longer-lasting results.
                </p>

                <div className="mt-8 grid gap-4">
                    {/* Dynamic recommendations */}
                    {recommended.map((id) => {
                        const item = UPSELLS[id];
                        return (
                            <ToggleCard
                                key={id}
                                title={item.title}
                                desc={item.desc}
                                checked={selected.includes(id)}
                                onToggle={() => toggle(id)}
                            />
                        );
                    })}

                    {/* Fixed Care Plan upsell */}
                    <div className="rounded-2xl border border-[#1DB954]/30 bg-white p-6 shadow-sm">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <div className="text-sm font-semibold uppercase text-black/60">
                                    Best value (optional)
                                </div>
                                <div className="mt-1 text-xl font-extrabold uppercase">
                                    {UPSELLS.care_plan.title}
                                </div>
                                <div className="mt-2 text-sm text-black/70">{UPSELLS.care_plan.desc}</div>
                            </div>

                            <button
                                type="button"
                                onClick={() => toggle("care_plan")}
                                className={[
                                    "rounded-lg px-4 py-2 font-semibold transition",
                                    selected.includes("care_plan")
                                        ? "bg-[#1DB954] text-white"
                                        : "border border-black/20 bg-white hover:bg-black/5",
                                ].join(" ")}
                            >
                                {selected.includes("care_plan") ? "Added" : "Add"}
                            </button>
                        </div>
                    </div>

                    {/* No thanks */}
                    <div className="rounded-xl border border-black/10 bg-[#FAFAFA] p-5">
                        <label className="flex items-center gap-3 text-sm font-semibold text-black/80">
                            <input
                                type="radio"
                                name="upsell"
                                checked={noThanks}
                                onChange={chooseNoThanks}
                            />
                            No, continue without upgrades
                        </label>
                    </div>
                </div>

                <div className="mt-10 flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => router.push("/quote/services")}
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

                <div className="mt-6 text-sm text-black/60">
                    You can always edit selections on the checkout page.
                </div>
            </Container>
        </main>
    );
}
