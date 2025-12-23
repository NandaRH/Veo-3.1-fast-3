"use client";

import { useEffect, useRef } from "react";

export default function VideoClient({
  src,
  poster,
  className,
  autoPlay = false,
  loop = false,
  muted = true,
  controls = false,
  playsInline = true,
}) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let started = false;
    const onIntersect = (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting && !started) {
          started = true;
          try {
            el.preload = "none";
          } catch {}
          if (!el.src) el.src = src;
          if (autoPlay) {
            try {
              el.play().catch(() => {});
            } catch {}
          }
        }
      }
    };
    const io = new IntersectionObserver(onIntersect, { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, [src, autoPlay]);

  return (
    <video
      ref={ref}
      className={className}
      poster={poster}
      muted={muted}
      loop={loop}
      controls={controls}
      playsInline={playsInline}
      preload="none"
    />
  );
}

