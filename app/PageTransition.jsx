"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export default function PageTransition({ children }) {
  const containerRef = useRef(null);
  const pathname = usePathname();

  useLayoutEffect(() => {
    // 2. Logika Transisi Halaman
    const node = containerRef.current;
    if (!node) return;

    document.body.classList.add("route-transitioning");
    const clearFlag = setTimeout(() => {
      try {
        document.body.classList.remove("route-transitioning");
      } catch (_) {}
    }, 180);

    requestAnimationFrame(() => {
      node.classList.remove("page-transition-active");
      void node.offsetWidth;

      requestAnimationFrame(() => {
        node.classList.add("page-transition-active");
      });
    });

    return () => {
      clearTimeout(clearFlag);
      try {
        document.body.classList.remove("route-transitioning");
      } catch (_) {}
    };
  }, [pathname]);

  return (
    <div ref={containerRef} className="page-transition page-transition-active">
      {children}
    </div>
  );
}
