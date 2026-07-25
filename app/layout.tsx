import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "quizbiblo";
  const protocol = requestHeaders.get("x-forwarded-proto") || "https";
  return {
    metadataBase: new URL(`${protocol}://${host}`),
    title: "QuizBiblo: Two-Player Buzz Test",
    description: "A shared Bible study buzzer for two players.",
    openGraph: { title: "QuizBiblo: Two-Player Buzz Test", description: "Study together. Buzz fairly.", images: ["/og.png"] },
    twitter: { card: "summary_large_image", title: "QuizBiblo: Two-Player Buzz Test", images: ["/og.png"] },
  };
}
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
