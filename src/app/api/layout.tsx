import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "AyuSaarthi",
    description: "AI-powered Ayurveda and AYUSH assistant",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}