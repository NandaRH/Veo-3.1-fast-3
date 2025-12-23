"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "./lib/supabaseClient";

const SESSION_TIMEOUT_SECONDS = 60 * 60 * 5; // 5 jam

function hasSessionCookie() {
  try {
    return /(?:^|; )sessionExpiry=/.test(document.cookie || "");
  } catch (_) {
    return false;
  }
}

function refreshSessionCookie() {
  try {
    document.cookie = `sessionExpiry=1; path=/; max-age=${SESSION_TIMEOUT_SECONDS}`;
  } catch (_) {}
}

async function performLogout(router) {
  try {
    if (supabase) {
      await supabase.auth.signOut();
    }
  } catch (_) {}

  try {
    await fetch("/api/session/logout", { method: "POST" });
  } catch (_) {}

  try {
    const names = [
      "plan",
      "planExpiry",
      "uid",
      "email",
      "name",
      "username",
      "sessionExpiry",
    ];
    for (const n of names) {
      document.cookie = `${n}=; path=/; max-age=0`;
    }
  } catch (_) {}

  try {
    router.push("/login");
  } catch (_) {
    try {
      window.location.href = "/login";
    } catch (_) {}
  }
}

export default function SessionGuard() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const publicPaths = new Set([
      "/",
      "/landing",
      "/login",
      "/register",
      "/admin/login",
    ]);

    if (publicPaths.has(pathname)) {
      return;
    }

    let destroyed = false;
    let timer = null;
    const events = ["click", "keydown", "mousemove", "scroll"];

    const cleanupAndLogout = () => {
      if (destroyed) return;
      destroyed = true;
      try {
        if (timer) {
          clearInterval(timer);
          timer = null;
        }
      } catch (_) {}
      try {
        events.forEach((evt) => {
          window.removeEventListener(evt, refresh);
        });
      } catch (_) {}
      performLogout(router);
    };

    const refresh = () => {
      if (destroyed) return;
      refreshSessionCookie();
    };

    const checkAndMaybeLogout = () => {
      if (destroyed) return;
      if (!hasSessionCookie()) {
        cleanupAndLogout();
        return;
      }
      (async () => {
        try {
          const resp = await fetch("/api/session/validate", {
            method: "GET",
            credentials: "include",
          });
          if (!resp.ok) {
            cleanupAndLogout();
            return;
          }
          let data = null;
          try {
            data = await resp.json();
          } catch (_) {
            data = null;
          }
          if (!data || data.ok !== true) {
            cleanupAndLogout();
          }
        } catch (_) {}
      })();
    };

    checkAndMaybeLogout();
    if (destroyed) return;

    try {
      events.forEach((evt) => {
        window.addEventListener(evt, refresh);
      });
    } catch (_) {}

    refresh();
    try {
      timer = window.setInterval(checkAndMaybeLogout, 60 * 1000);
    } catch (_) {}

    return () => {
      destroyed = true;
      try {
        if (timer) {
          clearInterval(timer);
          timer = null;
        }
      } catch (_) {}
      try {
        events.forEach((evt) => {
          window.removeEventListener(evt, refresh);
        });
      } catch (_) {}
    };
  }, [pathname, router]);

  return null;
}
