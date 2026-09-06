import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Anime Zone India - Best Source For Hindi, Tamil, Telugu Anime & Cartoons",
  description:
    "Anime Zone India - Best Source For Hindi, Tamil, Telugu Anime & Cartoons. Watch anime online in Hindi, English, Japanese with HD quality.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geist.variable} dark`}>
      <body className="min-h-screen flex flex-col bg-[#000000] text-white font-[family-name:var(--font-geist)]">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
