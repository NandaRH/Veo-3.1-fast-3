"use client";

import { useEffect, useRef, useState } from "react";

export default function LazyImage({ src, alt = "", className = "", width, height, style }) {
  const ref = useRef(null);
  const [loadedSrc, setLoadedSrc] = useState("");

  useEffect(() => {
    const el = ref.current;
    let observer;
    if (!el) return;
    if (typeof window !== "undefined" && "IntersectionObserver" in window) {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            setLoadedSrc(src);
            if (observer) observer.disconnect();
          }
        },
        { rootMargin: "400px" }
      );
      observer.observe(el);
    } else {
      // Fallback: langsung load jika IO tidak tersedia
      setLoadedSrc(src);
    }
    return () => {
      if (observer) observer.disconnect();
    };
  }, [src]);

  const intrinsicW = typeof width === 'number' ? width : 300;
  const intrinsicH = typeof height === 'number' ? height : 200;
  const mergedStyle = {
    contentVisibility: 'auto',
    containIntrinsicSize: `${intrinsicH}px ${intrinsicW}px`,
    backfaceVisibility: 'hidden',
    WebkitBackfaceVisibility: 'hidden',
    ...style,
  };

  return (
    <img
      ref={ref}
      src={loadedSrc || undefined}
      alt={alt}
      className={`lazy-image ${className}`.trim()}
      loading="lazy"
      decoding="async"
      width={width}
      height={height}
      style={mergedStyle}
    />
  );
}