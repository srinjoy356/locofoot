import type { Metadata } from "next";
import { Inter, Inter_Tight } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LocoFoot",
  description: "Real-time turf availability, elite matchmaking, and performance tracking.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${interTight.variable} h-full antialiased dark`}
    >
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=block" rel="stylesheet" />
      </head>
      <body className="font-sans min-h-full flex flex-col text-foreground relative z-0 bg-[#0B0F0C]">
        <div className="fixed inset-0 z-0">
          <div className="absolute inset-0 bg-background/92 z-10" />
          <img alt="" aria-hidden="true" className="w-full h-full object-cover opacity-[0.25]" src="/turf/turf-closeup.jpg" />
        </div>
        <div className="relative z-10 flex flex-col flex-1">{children}</div>
      </body>
    </html>
  );
}
