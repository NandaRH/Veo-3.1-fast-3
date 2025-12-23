"use client";

import { useEffect, useRef } from "react";

export default function ScrollPerf() {
  const timerRef = useRef(null);
  const lastYRef = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      // Tanda sedang scroll: kurangi efek berat via CSS
      document.body.classList.add("scrolling");
      // Hapus tanda setelah idle sebentar
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        document.body.classList.remove("scrolling");
      }, 120);
    };

    const onDir = () => {
      const y = window.scrollY || 0;
      const last = lastYRef.current || 0;
      const nav = document.querySelector('.navbar');
      if (nav) {
        if (y > last + 4 && y > 60) {
          nav.classList.add('nav-hidden');
        } else {
          nav.classList.remove('nav-hidden');
        }
        if (y > 4) {
          nav.classList.add('nav-active');
        } else {
          nav.classList.remove('nav-active');
        }
      }
      lastYRef.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("scroll", onDir, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("scroll", onDir);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return null;
}
