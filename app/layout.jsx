import "./globals.css";
import PageTransition from "./PageTransition";
import ScrollPerf from "./ScrollPerf";
import GlobalBackgrounds from "./components/GlobalBackgrounds";
import PlanSync from "./PlanSync";
import SessionGuard from "./SessionGuard";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata = {
  title: "fokusai-generator-veo",
  description: "Frontend Next.js untuk demo Labs Flow Proxy",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <meta name="color-scheme" content="dark" />
        <link
          rel="icon"
          type="image/png"
          href="/images/fokusAI.png"
        />
        <link
          rel="apple-touch-icon"
          href="/images/fokusAI.png"
        />
        <style>{`html,body{background:#000;color:#f5f7fb}`}</style>
      </head>
      <body className={inter.className} suppressHydrationWarning>
        <GlobalBackgrounds />
        <ScrollPerf />
        <PlanSync />
        <SessionGuard />
        <PageTransition>{children}</PageTransition>
      </body>
    </html>
  );
}
