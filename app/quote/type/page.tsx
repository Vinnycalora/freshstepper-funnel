"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Container } from "@/components/Container";
import { Progress } from "@/components/Progress";
import { getFunnelState, updateFunnelState, ShoeType } from "@/components/funnelStore";

function OptionCard({
    title,
    desc,
    price,
    selected,
    onClick,
}: {
    title: string;
    desc: string;
    price: string;
    selected: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={[
                "text-left rounded-xl border bg-white p-6 shadow-sm transition",
                selected ? "border-[#1DB954] ring-2 ring-[#1DB954]/20" : "border-[#E5E5E5] hover:border-[#1DB954]",
            ].join(" ")}
        >
            <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div className="text-lg font-extrabold uppercase">{title}</div>
                <div className="text-sm font-semibold text-black/70">{price}</div>
            </div>
            <div className="mt-2 text-sm text-black/70">{desc}</div>
        </button>
    );
}

export default function QuoteTypePage() {
    const router = useRouter();

    const [shoeType, setShoeType] = useState<ShoeType | null>(() => {
        const s = getFunnelState();
        return s.shoeType ?? null;
    });

    function continueNext() {
        if (!shoeType) return;

        updateFunnelState({ shoeType });

        // Skip "needs" step for caps, kids, and other (boots/uggs/other)
        if (shoeType === "caps" || shoeType === "kids" || shoeType === "other") {
            router.push("/quote/upgrades");
            return;
        }

        router.push("/quote/services");
    }

    return (
        <main className="min-h-screen py-12">
            <Container>
                <Progress step={1} />

                <h1 className="text-3xl font-extrabold uppercase sm:text-4xl">
                    What type of shoes would you like cleaned?
                </h1>
                <p className="mt-3 text-black/70">Pick the closest match — you can add extras on the next step.</p>

                <div className="mt-8 grid gap-4 md:grid-cols-3">
                    <OptionCard
                        title="Trainers"
                        price="£40"
                        desc="Sneakers, Air Force 1s, Jordans, everyday trainers."
                        selected={shoeType === "trainers"}
                        onClick={() => setShoeType("trainers")}
                    />
                    <OptionCard
                        title="Luxury Heels"
                        price="£40"
                        desc="Designer heels, leather soles, scuffs & colour work."
                        selected={shoeType === "heels"}
                        onClick={() => setShoeType("heels")}
                    />
                    <OptionCard
                        title="Boots / UGGs / Other"
                        price="£35"
                        desc="UGGs, suede boots, bags, sandals & misc items."
                        selected={shoeType === "other"}
                        onClick={() => setShoeType("other")}
                    />
                    <OptionCard
                        title="Kids Shoes"
                        price="£25"
                        desc="Kids trainers & everyday kids footwear."
                        selected={shoeType === "kids"}
                        onClick={() => setShoeType("kids")}
                    />
                    <OptionCard
                        title="Caps"
                        price="£25"
                        desc="Caps & headwear cleaning."
                        selected={shoeType === "caps"}
                        onClick={() => setShoeType("caps")}
                    />
                </div>

                <div className="mt-10 flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => router.push("/")}
                        className="rounded-lg border border-black/20 bg-white px-6 py-3 font-semibold hover:bg-black/5"
                    >
                        Back
                    </button>

                    <button
                        type="button"
                        disabled={!shoeType}
                        onClick={continueNext}
                        className={[
                            "rounded-lg px-6 py-3 font-semibold text-white transition",
                            shoeType ? "bg-[#1DB954] hover:opacity-90" : "bg-black/20 cursor-not-allowed",
                        ].join(" ")}
                    >
                        Continue
                    </button>
                </div>

                <div className="mt-6 text-sm text-black/60">Secure checkout powered by Stripe • UK wide shipping or drop-off</div>
            </Container>
        </main>
    );
}

