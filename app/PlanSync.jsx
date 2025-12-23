"use client";

import { useEffect } from "react";
import { supabase } from "./lib/supabaseClient";

export default function PlanSync() {
  useEffect(() => {
    let es = null;
    let cancelled = false;

    const setup = async () => {
      try {
        if (!supabase || typeof window === "undefined") return;
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = String(session?.access_token || "");
        if (!token || cancelled) return;

        const url = `/api/me/plan/stream?token=${encodeURIComponent(token)}`;
        es = new EventSource(url);

        const handler = (event) => {
          try {
            const payload = JSON.parse(event.data || "{}");
            let plan = String(payload.plan || "").toLowerCase();
            const expiry = payload.expiry;
            if (!plan) plan = "free";

            // Sinkronkan cookie plan dan planExpiry
            try {
              document.cookie = `plan=${encodeURIComponent(
                plan
              )}; path=/; max-age=${60 * 60 * 24 * 30}`;
              if (expiry !== null && typeof expiry !== "undefined") {
                const n = Number(expiry);
                if (Number.isFinite(n) && n > 0) {
                  document.cookie = `planExpiry=${encodeURIComponent(
                    String(n)
                  )}; path=/; max-age=${60 * 60 * 24 * 30}`;
                }
              }
            } catch (_) {}

            // Broadcast event ke semua halaman yang tertarik
            try {
              window.dispatchEvent(
                new CustomEvent("plan-updated", {
                  detail: { plan, expiry },
                })
              );
            } catch (_) {}
          } catch (_) {}
        };

        es.addEventListener("plan_snapshot", handler);
        es.addEventListener("plan_update", handler);
        es.onerror = () => {};
      } catch (_) {}
    };

    setup();

    return () => {
      cancelled = true;
      try {
        if (es) es.close();
      } catch (_) {}
    };
  }, []);

  return null;
}

