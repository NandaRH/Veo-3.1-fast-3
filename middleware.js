import { NextResponse } from "next/server";

const PLANS = {
  FREE: "free",
  VEO_LIFETIME: "veo_lifetime",
  VEO_SORA_UNLIMITED: "veo_sora_unlimited",
  MONTHLY: "monthly",
  ADMIN: "admin",
};

function normalizePlan(plan, expiry) {
  const p = (plan || "").toLowerCase();
  const exp = parseInt(expiry || "0", 10);
  const now = Date.now();
  if (p === PLANS.MONTHLY) {
    if (!exp || now > exp) {
      return { name: PLANS.FREE, expired: true, expiresAt: exp || 0 };
    }
    return { name: PLANS.MONTHLY, expired: false, expiresAt: exp };
  }
  if (p === PLANS.ADMIN) {
    return { name: PLANS.ADMIN, expired: false, expiresAt: 0 };
  }
  if (p === PLANS.VEO_LIFETIME || p === PLANS.VEO_SORA_UNLIMITED) {
    return { name: p, expired: false, expiresAt: 0 };
  }
  return { name: PLANS.FREE, expired: false, expiresAt: 0 };
}

function canAccess(pathname, plan) {
  const p = plan.name;
  if (pathname === "/admin/login") return true;
  if (p === PLANS.ADMIN) return true;
  if (p === PLANS.FREE) {
    if (pathname === "/landing") return true;
    if (pathname === "/login") return true;
    if (pathname === "/register") return true;
    if (pathname === "/dashboard") return true;
    if (pathname === "/profile") return true;
    if (pathname === "/credit") return true;
    if (pathname === "/logout") return true;
    return false;
  }
  if (p === PLANS.VEO_LIFETIME) return pathname !== "/sora2";
  if (p === PLANS.VEO_SORA_UNLIMITED) return true;
  if (p === PLANS.MONTHLY) return !plan.expired;
  return false;
}

export function middleware(req) {
  const url = req.nextUrl.clone();
  const path = url.pathname;

  if (
    path.startsWith("/_next") ||
    path.startsWith("/images") ||
    path.startsWith("/video") ||
    path.startsWith("/uploads") ||
    path === "/favicon.ico" ||
    path.startsWith("/api")
  ) {
    return NextResponse.next();
  }

  // Security: do not allow overriding plan via URL params
  const planParam = null;
  const daysParam = null;

  let planCookie = req.cookies.get("plan")?.value || "";
  let planExpiryCookie = req.cookies.get("planExpiry")?.value || "";

  // Disallow plan changes via URL

  const plan = normalizePlan(planCookie, planExpiryCookie);

  if (plan.name === PLANS.MONTHLY && plan.expired) {
    const res = NextResponse.redirect(new URL("/dashboard", req.url));
    res.cookies.set("plan", PLANS.FREE, { path: "/", httpOnly: false });
    res.cookies.delete("planExpiry");
    return res;
  }

  if (!canAccess(path, plan)) {
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/:path*"],
};
