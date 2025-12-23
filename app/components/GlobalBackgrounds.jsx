"use client";

import { usePathname } from "next/navigation";

export default function GlobalBackgrounds() {
  const pathname = usePathname();
  // Normalize path
  let p = pathname || "";
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);

  const isLanding = p === "/landing";

  if (isLanding) return null;

  return (
    <>
      <div className="global-bg-layer-base" />
      <div className="global-bg-layer-gradient" />
    </>
  );
}
