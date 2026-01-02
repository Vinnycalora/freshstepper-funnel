import type { Metadata } from "next";
import "./globals.css";


export const metadata: Metadata = {
    title: "Freshstepper Quote Funnel",
    description: "Premium shoe cleaning & restoration — UK wide.",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body>
                <div className="min-h-screen bg-[#FAFAFA] text-[#0B0B0B]">
                    {children}
                </div>
            </body>
        </html>
    );
}

