import { Container } from "@/components/Container";
import { Button } from "@/components/Button";

function TrustPill({ text }: { text: string }) {
    return (
        <div className="rounded-full border border-black/10 bg-white px-3 py-1 text-sm text-black/70">
            {text}
        </div>
    );
}

function ServiceCard({
    title,
    desc,
}: {
    title: string;
    desc: string;
}) {
    return (
        <div className="group rounded-xl border border-[#E5E5E5] bg-white p-6 shadow-sm transition hover:border-[#1DB954]">
            <div className="text-lg font-extrabold uppercase">{title}</div>
            <div className="mt-2 text-sm text-black/70">{desc}</div>
            <div className="mt-4">
                <span className="text-sm font-semibold text-[#1DB954] group-hover:underline">
                    Start your quote →
                </span>
            </div>
        </div>
    );
}

export default function Home() {
    return (
        <main>
            {/* HERO */}
            <section className="border-b border-black/5 bg-[#FAFAFA]">
                <Container>
                    <div className="grid gap-10 py-14 lg:grid-cols-2 lg:items-center">
                        <div>
                            <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-1 text-sm">
                                <span className="font-semibold">UK Wide</span>
                                <span className="text-black/60">•</span>
                                <span className="text-black/70">Premium Restoration</span>
                            </div>

                            <h1 className="mt-5 text-4xl font-extrabold uppercase leading-[1.05] tracking-tight sm:text-5xl">
                                Premium Shoe Cleaning &amp; Restoration — UK Wide
                            </h1>

                            <p className="mt-4 max-w-xl text-base text-black/70 sm:text-lg">
                                Loved by 500+ customers. Sustainable. Affordable. Luxury quality.
                            </p>

                            <div className="mt-6 flex flex-wrap gap-3">
                                <Button href="/quote/type" variant="primary">
                                    Start Your Quote
                                </Button>
                                <Button href="#how-it-works" variant="secondary">
                                    How it works
                                </Button>
                            </div>

                            <div className="mt-6 flex flex-wrap gap-2">
                                <TrustPill text="Google ★★★★★" />
                                <TrustPill text="Trusted by 500+ customers" />
                                <TrustPill text="Eco-Friendly Service" />
                                <TrustPill text="Secure Stripe Checkout" />
                            </div>
                        </div>

                        {/* Placeholder for before/after */}
                        <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="aspect-[4/3] rounded-xl bg-black/5" />
                                <div className="aspect-[4/3] rounded-xl bg-black/5" />
                                <div className="aspect-[4/3] rounded-xl bg-black/5" />
                                <div className="aspect-[4/3] rounded-xl bg-black/5" />
                            </div>
                            <div className="mt-3 text-sm text-black/60">
                                Before / After examples (we’ll swap these with real images)
                            </div>
                        </div>
                    </div>
                </Container>
            </section>

            {/* SUSTAINABILITY */}
            <section className="py-14">
                <Container>
                    <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
                        <div>
                            <h2 className="text-3xl font-extrabold uppercase sm:text-4xl">
                                Repair Over Replace
                            </h2>
                            <p className="mt-3 text-black/70">
                                Save money and reduce waste with premium restoration.
                            </p>

                            <ul className="mt-5 space-y-2 text-black/75">
                                <li>• Up to 80% cheaper than buying new</li>
                                <li>• Reduces landfill waste</li>
                                <li>• Eco-friendly materials &amp; biodegradable packaging</li>
                                <li>• Part of the UK circular economy movement</li>
                            </ul>

                            <div className="mt-6">
                                <Button href="/quote/type">Start Your Quote</Button>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-[#E5E5E5] bg-white p-6 shadow-sm">
                            <div className="text-sm font-semibold uppercase text-black/60">
                                Trusted, secure &amp; simple
                            </div>
                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                <div className="rounded-xl border border-black/10 bg-[#FAFAFA] p-4">
                                    <div className="font-bold uppercase">Fast turnaround</div>
                                    <div className="mt-1 text-sm text-black/70">7–10 days typical</div>
                                </div>
                                <div className="rounded-xl border border-black/10 bg-[#FAFAFA] p-4">
                                    <div className="font-bold uppercase">UK wide shipping</div>
                                    <div className="mt-1 text-sm text-black/70">Postal or drop-off</div>
                                </div>
                                <div className="rounded-xl border border-black/10 bg-[#FAFAFA] p-4">
                                    <div className="font-bold uppercase">Premium craft</div>
                                    <div className="mt-1 text-sm text-black/70">Luxury-level finish</div>
                                </div>
                                <div className="rounded-xl border border-black/10 bg-[#FAFAFA] p-4">
                                    <div className="font-bold uppercase">Secure payment</div>
                                    <div className="mt-1 text-sm text-black/70">Powered by Stripe</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </Container>
            </section>

            {/* SERVICE CATEGORIES */}
            <section className="border-y border-black/5 bg-white py-14">
                <Container>
                    <h2 className="text-3xl font-extrabold uppercase sm:text-4xl">
                        Choose your service
                    </h2>
                    <p className="mt-3 text-black/70">
                        Start with the closest match — you can add repairs on the next step.
                    </p>

                    <div className="mt-8 grid gap-4 md:grid-cols-3">
                        <a href="/quote/type">
                            <ServiceCard
                                title="Trainers & Sneakers"
                                desc="Deep clean, whitening, deodorise, fabric refresh."
                            />
                        </a>
                        <a href="/quote/type">
                            <ServiceCard
                                title="Luxury Heels"
                                desc="Leather care, scuff correction, sole and heel work."
                            />
                        </a>
                        <a href="/quote/type">
                            <ServiceCard
                                title="UGGs, Bags & Others"
                                desc="Suede renewal, stain work, protection and finishing."
                            />
                        </a>
                    </div>

                    <div className="mt-10 flex justify-start">
                        <Button href="/quote/type">Start Your Quote</Button>
                    </div>
                </Container>
            </section>

            {/* HOW IT WORKS */}
            <section id="how-it-works" className="py-14">
                <Container>
                    <h2 className="text-3xl font-extrabold uppercase sm:text-4xl">
                        How it works
                    </h2>

                    <div className="mt-8 grid gap-4 md:grid-cols-4">
                        {[
                            { t: "1. Build your quote", d: "Tell us shoe type + what it needs." },
                            { t: "2. Ship or drop-off", d: "Postal service or in-person." },
                            { t: "3. We restore", d: "Premium process, safe for materials." },
                            { t: "4. Return to you", d: "Fresh, protected, ready to wear." },
                        ].map((x) => (
                            <div key={x.t} className="rounded-xl border border-[#E5E5E5] bg-white p-5 shadow-sm">
                                <div className="font-extrabold uppercase">{x.t}</div>
                                <div className="mt-2 text-sm text-black/70">{x.d}</div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-10">
                        <Button href="/quote/type">Start Your Quote</Button>
                    </div>
                </Container>
            </section>
        </main>
    );
}
