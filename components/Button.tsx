import Link from "next/link";

type ButtonProps =
    | { href: string; children: React.ReactNode; variant?: "primary" | "secondary" }
    | { onClick: () => void; children: React.ReactNode; variant?: "primary" | "secondary" };

export function Button(props: ButtonProps) {
    const variant = props.variant ?? "primary";
    const className =
        variant === "primary"
            ? "inline-flex items-center justify-center rounded-lg bg-[#1DB954] px-6 py-3 font-semibold text-white transition hover:opacity-90"
            : "inline-flex items-center justify-center rounded-lg border border-[#0B0B0B] bg-white px-6 py-3 font-semibold text-[#0B0B0B] transition hover:bg-black/5";

    if ("href" in props) {
        return (
            <Link className={className} href={props.href}>
                {props.children}
            </Link>
        );
    }

    return (
        <button className={className} onClick={props.onClick} type="button">
            {props.children}
        </button>
    );
}
