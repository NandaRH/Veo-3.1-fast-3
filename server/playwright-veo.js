/**
 * Playwright Browser Automation untuk Google Labs Veo
 * Fitur utama: Capture reCAPTCHA token untuk digunakan di API
 */

import { chromium, firefox } from "playwright-extra";
import stealthPlugin from "puppeteer-extra-plugin-stealth";
import path from "node:path";
import fs from "node:fs";
import { EventEmitter } from "node:events";
import proxyChain from "proxy-chain";

// Apply stealth plugin
chromium.use(stealthPlugin());
firefox.use(stealthPlugin());

// Proxy chain URL (will be set when browser launches)
let anonymizedProxyUrl = null;

// Path untuk menyimpan session browser (persistent login)
const USER_DATA_DIR = path.resolve(process.cwd(), "browser-data");
const FIREFOX_DATA_DIR = path.resolve(process.cwd(), "browser-data-firefox");
const GOOGLE_LABS_URL = "https://labs.google/fx/tools/video-fx";
const RECAPTCHA_KEY = "6LdsFiUsAAAAAIjVDZcuLhaHiDn5nnHVXVRQGeMV";

// Browser type: "chromium" atau "firefox"  
// Set BROWSER_TYPE=firefox untuk test Firefox
const BROWSER_TYPE = process.env.BROWSER_TYPE || "chromium"; // Default Chromium

// Event emitter untuk komunikasi dengan server
export const veoEvents = new EventEmitter();

// State management
let browserInstance = null;
let browserContext = null;
let activePage = null;
let isGenerating = false;
let currentJobId = null;

// Token storage
let capturedRecaptchaToken = null;
let tokenCapturedAt = null;
let isCapturingToken = false;

// Bearer token storage (auto-captured from browser)
let capturedBearerToken = null;
let bearerCapturedAt = null;

/**
 * Pastikan folder browser-data ada
 */
const ensureUserDataDir = () => {
  try {
    if (!fs.existsSync(USER_DATA_DIR)) {
      fs.mkdirSync(USER_DATA_DIR, { recursive: true });
    }
  } catch (e) {
    console.error("[Playwright] Failed to create user data dir:", e);
  }
};

/**
 * Cek apakah ada session valid di browser-data
 */
export const hasValidSession = () => {
  try {
    const dataDir = BROWSER_TYPE === "firefox" ? FIREFOX_DATA_DIR : USER_DATA_DIR;

    if (BROWSER_TYPE === "firefox") {
      // Firefox: cek cookies.sqlite
      const firefoxCookies = path.join(dataDir, "cookies.sqlite");
      const firefoxStorage = path.join(dataDir, "storage");
      return fs.existsSync(firefoxCookies) || fs.existsSync(firefoxStorage);
    } else {
      // Chromium: cek folder cookies
      const cookiesPath = path.join(dataDir, "Default", "Cookies");
      const cookiesPath2 = path.join(dataDir, "Profile 1", "Cookies");
      const networkPath = path.join(dataDir, "Default", "Network");
      const networkPath2 = path.join(dataDir, "Profile 1", "Network");

      return fs.existsSync(cookiesPath) ||
        fs.existsSync(cookiesPath2) ||
        fs.existsSync(networkPath) ||
        fs.existsSync(networkPath2);
    }
  } catch (e) {
    return false;
  }
};

/**
 * Launch browser dengan persistent context
 * @param {Object} options 
 * @param {boolean} options.headless - Jalankan headless (default: auto-detect dari session)
 * @param {boolean} options.forceVisible - Paksa visible untuk login
 */
export const launchBrowser = async (options = {}) => {
  ensureUserDataDir();

  if (browserContext) {
    console.log("[Playwright] Browser already running");
    return { success: true, message: "Browser sudah berjalan" };
  }

  try {
    // Auto-detect session
    const sessionExists = hasValidSession();

    // PENTING: Headless mode TIDAK bekerja dengan Google reCAPTCHA!
    // Karena launchPersistentContext tidak support headless: "new", 
    // kita default ke visible mode (false)
    // Untuk Railway, gunakan Xvfb (virtual display)
    const forceHeadless = options.headless === true || process.env.FORCE_HEADLESS === "1";
    const forceVisible = options.forceVisible === true || process.env.FORCE_VISIBLE === "1";

    // Default: visible mode (false) karena headless tidak bekerja dengan reCAPTCHA
    const useHeadless = forceHeadless && !forceVisible;

    console.log("[Playwright] Launching browser...");
    console.log("[Playwright] Session exists:", sessionExists);
    console.log("[Playwright] Force headless:", forceHeadless);
    console.log("[Playwright] Force visible:", forceVisible);
    console.log("[Playwright] Using headless:", useHeadless);
    console.log("[Playwright] Browser type:", BROWSER_TYPE);

    if (!sessionExists && useHeadless) {
      console.log("[Playwright] ⚠️ No session found! Please run locally first to login.");
      return {
        success: false,
        error: "Session tidak ditemukan. Jalankan server di lokal dan login terlebih dahulu.",
        needsLogin: true
      };
    }

    // Launch persistent context berdasarkan browser type
    const dataDir = BROWSER_TYPE === "firefox" ? FIREFOX_DATA_DIR : USER_DATA_DIR;

    // Pastikan folder ada
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    console.log("[Playwright] Using data dir:", dataDir);

    if (BROWSER_TYPE === "firefox") {
      // Firefox config
      browserContext = await firefox.launchPersistentContext(dataDir, {
        headless: useHeadless,
        viewport: { width: 1280, height: 900 },
        locale: "en-US",
        timezoneId: "Asia/Jakarta",
        firefoxUserPrefs: {
          // Stealth settings untuk Firefox
          "dom.webdriver.enabled": false,
          "useAutomationExtension": false,
          "privacy.resistFingerprinting": false,
        },
      });
    } else {
      // Chromium config dengan PROXY SUPPORT
      const proxyServer = process.env.PROXY_SERVER; // e.g., "gate.smartproxy.com:7000"
      const proxyUser = process.env.PROXY_USER;
      const proxyPass = process.env.PROXY_PASS;

      const launchOptions = {
        headless: useHeadless,
        viewport: { width: 1280, height: 900 },
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        args: [
          "--disable-blink-features=AutomationControlled",
          "--disable-features=IsolateOrigins,site-per-process",
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-web-security",
          "--disable-features=VizDisplayCompositor",
          "--disable-infobars",
          "--window-size=1280,900",
          "--start-maximized",
        ],
        ignoreDefaultArgs: ["--enable-automation"],
        bypassCSP: true,
        locale: "en-US",
        timezoneId: "Asia/Jakarta",
      };

      // Add proxy if configured - using proxy-chain to handle authentication
      if (proxyServer && proxyUser && proxyPass) {
        console.log("[Playwright] 🌐 Setting up proxy-chain for:", proxyServer);
        const proxyUrl = `http://${proxyUser}:${proxyPass}@${proxyServer}`;
        try {
          // proxy-chain creates a local proxy server that handles authentication
          anonymizedProxyUrl = await proxyChain.anonymizeProxy(proxyUrl);
          console.log("[Playwright] ✅ Proxy-chain ready:", anonymizedProxyUrl);
          launchOptions.proxy = {
            server: anonymizedProxyUrl,
          };
        } catch (proxyError) {
          console.error("[Playwright] ❌ Proxy-chain setup failed:", proxyError.message);
          console.log("[Playwright] ⚠️ Falling back to direct connection");
        }
      } else if (proxyServer) {
        // Proxy without auth - use directly
        console.log("[Playwright] 🌐 Using direct proxy:", proxyServer);
        launchOptions.proxy = {
          server: `http://${proxyServer}`,
        };
      } else {
        console.log("[Playwright] ⚠️ No proxy configured, using direct connection");
      }

      browserContext = await chromium.launchPersistentContext(dataDir, launchOptions);
    }

    // Buka page pertama atau buat baru
    const pages = browserContext.pages();
    activePage = pages.length > 0 ? pages[0] : await browserContext.newPage();

    // Stealth plugin handles anti-detection automatically.
    // No manual scripts needed.

    // Setup network interception untuk capture reCAPTCHA token
    await setupRecaptchaInterceptor();

    console.log("[Playwright] Browser launched successfully (headless:", useHeadless + ")");
    veoEvents.emit("browser-status", { status: "running", headless: useHeadless });

    return { success: true, message: "Browser berhasil dibuka", headless: useHeadless };
  } catch (error) {
    console.error("[Playwright] Launch error:", error);
    return { success: false, error: String(error) };
  }
};

/**
 * Setup interceptor untuk capture reCAPTCHA token dari network response
 */
const setupRecaptchaInterceptor = async () => {
  if (!activePage) return;

  // Listen to all responses
  activePage.on("response", async (response) => {
    try {
      const url = response.url();

      // Capture reCAPTCHA enterprise reload response
      if (url.includes("/recaptcha/enterprise/reload") || url.includes("/recaptcha/api2/reload")) {
        console.log("[Playwright] Captured reCAPTCHA response from:", url);

        try {
          const text = await response.text();

          // Response format: )]}\n["rresp","TOKEN_HERE",...
          // Parse the token from response
          const tokenMatch = text.match(/\["rresp","([^"]+)"/);
          if (tokenMatch && tokenMatch[1]) {
            capturedRecaptchaToken = tokenMatch[1];
            tokenCapturedAt = Date.now();
            console.log("[Playwright] ✓ reCAPTCHA token captured! Length:", capturedRecaptchaToken.length);
            veoEvents.emit("recaptcha-token-captured", {
              token: capturedRecaptchaToken.substring(0, 50) + "...",
              length: capturedRecaptchaToken.length,
              timestamp: tokenCapturedAt
            });
          }
        } catch (parseErr) {
          console.log("[Playwright] Could not parse reCAPTCHA response:", parseErr.message);
        }
      }

      // Also capture from batchAsyncGenerateVideoText request to extract token
      if (url.includes("batchAsyncGenerateVideoText")) {
        try {
          const request = response.request();
          const postData = request.postData();
          if (postData) {
            const payload = JSON.parse(postData);
            if (payload.clientContext?.recaptchaToken) {
              capturedRecaptchaToken = payload.clientContext.recaptchaToken;
              tokenCapturedAt = Date.now();
              console.log("[Playwright] ✓ Token extracted from API request! Length:", capturedRecaptchaToken.length);
              veoEvents.emit("recaptcha-token-captured", {
                token: capturedRecaptchaToken.substring(0, 50) + "...",
                length: capturedRecaptchaToken.length,
                timestamp: tokenCapturedAt,
                source: "api-request"
              });
            }
          }
        } catch (_) { }
      }
      // Capture Bearer token from Authorization header
      if (url.includes("googleapis.com") || url.includes("aisandbox-pa.googleapis.com")) {
        try {
          const request = response.request();
          const headers = request.headers();
          const authHeader = headers["authorization"] || headers["Authorization"];
          if (authHeader && authHeader.startsWith("Bearer ")) {
            const newBearer = authHeader.replace("Bearer ", "");
            // Only update if it's different or newer
            if (newBearer !== capturedBearerToken) {
              capturedBearerToken = newBearer;
              bearerCapturedAt = Date.now();
              console.log("[Playwright] ✓ Bearer token captured! Length:", capturedBearerToken.length);
              veoEvents.emit("bearer-token-captured", {
                token: capturedBearerToken.substring(0, 50) + "...",
                length: capturedBearerToken.length,
                timestamp: bearerCapturedAt
              });

              // Update environment variable for immediate use
              process.env.LABS_BEARER = capturedBearerToken;
            }
          }
        } catch (_) { }
      }
    } catch (err) {
      // Ignore errors during interception
    }
  });

  console.log("[Playwright] Network interceptor setup complete (reCAPTCHA + Bearer)");
};

/**
 * Tutup browser
 */
export const closeBrowser = async () => {
  try {
    if (browserContext) {
      await browserContext.close();
      browserContext = null;
      activePage = null;
    }
    if (browserInstance) {
      await browserInstance.close();
      browserInstance = null;
    }
    // Reset token state
    capturedRecaptchaToken = null;
    tokenCapturedAt = null;

    veoEvents.emit("browser-status", { status: "closed" });
    return { success: true, message: "Browser ditutup" };
  } catch (error) {
    return { success: false, error: String(error) };
  }
};

/**
 * Navigate ke Google Labs dan cek status login
 */
export const navigateToLabs = async () => {
  if (!activePage) {
    return { success: false, error: "Browser belum dibuka" };
  }

  try {
    console.log("[Playwright] Navigating to Google Labs...");
    await activePage.goto(GOOGLE_LABS_URL, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    // Tunggu sebentar untuk page load
    await activePage.waitForTimeout(3000);

    // Cek apakah perlu login
    const currentUrl = activePage.url();
    const needsLogin =
      currentUrl.includes("accounts.google.com") ||
      currentUrl.includes("/signin");

    if (needsLogin) {
      console.log("[Playwright] Login required - waiting for user...");
      veoEvents.emit("login-required", {
        message: "Silakan login ke Google di browser yang terbuka",
      });
      return {
        success: true,
        needsLogin: true,
        message: "Silakan login ke Google di browser",
      };
    }

    // Cek apakah sudah di halaman Video FX
    const isOnVideoFx =
      currentUrl.includes("video-fx") || currentUrl.includes("labs.google");

    if (isOnVideoFx) {
      console.log("[Playwright] Successfully on Google Labs Video FX");
      veoEvents.emit("ready", { message: "Siap untuk capture token" });
      return { success: true, ready: true, message: "Siap untuk capture token" };
    }

    return { success: true, message: "Navigasi berhasil" };
  } catch (error) {
    console.error("[Playwright] Navigation error:", error);
    return { success: false, error: String(error) };
  }
};

/**
 * Cek status browser dan halaman
 */
export const getBrowserStatus = async () => {
  const status = {
    browserRunning: !!browserInstance || !!browserContext,
    pageReady: !!activePage,
    isGenerating,
    currentJobId,
    currentUrl: activePage ? activePage.url() : null,
    isLoggedIn: false,
    isOnVideoFx: false,
    hasToken: !!capturedRecaptchaToken && (Date.now() - tokenCapturedAt < 5400000), // < 1.5 jam
    tokenAge: tokenCapturedAt ? Math.floor((Date.now() - tokenCapturedAt) / 1000) : null,
    hasBearer: !!capturedBearerToken && (Date.now() - bearerCapturedAt < 3600000), // < 1 jam
    bearerAge: bearerCapturedAt ? Math.floor((Date.now() - bearerCapturedAt) / 1000) : null
  };

  if (activePage) {
    try {
      // Cek apakah login dengan melihat avatar atau elemen spesifik Google
      // Cara paling akurat untuk Google Labs: cek apakah ada tombol "Sign in" atau profile
      const userProfile = await activePage.$('img[src*="googleusercontent.com"], a[href*="accounts.google.com/SignOut"]');
      const signInBtn = await activePage.$('a[href*="accounts.google.com/ServiceLogin"]');

      status.isLoggedIn = !!userProfile && !signInBtn;
      status.isOnVideoFx = status.currentUrl.includes("video-fx") || status.currentUrl.includes("labs.google");
    } catch (e) {
      status.error = String(e);
    }
  }

  return status;
};

/**
 * Get captured reCAPTCHA token
 * Token valid sekitar 2 menit setelah capture
 */
export const getRecaptchaToken = async () => {
  // Check if token exists and is fresh (< 2 minutes old)
  const TOKEN_MAX_AGE_MS = 2 * 60 * 1000; // 2 minutes

  if (capturedRecaptchaToken && tokenCapturedAt) {
    const age = Date.now() - tokenCapturedAt;
    if (age < TOKEN_MAX_AGE_MS) {
      return {
        success: true,
        token: capturedRecaptchaToken,
        age: Math.floor(age / 1000),
        maxAge: TOKEN_MAX_AGE_MS / 1000,
        fresh: true
      };
    }
  }

  // Token expired or not available
  return {
    success: false,
    error: "Token tidak tersedia atau sudah expired. Silakan generate di browser untuk capture token baru.",
    hasToken: !!capturedRecaptchaToken,
    age: tokenCapturedAt ? Math.floor((Date.now() - tokenCapturedAt) / 1000) : null
  };
};

/**
 * Get captured Bearer token from browser
 * Token valid sekitar 1 jam setelah capture
 */
export const getCapturedBearer = async () => {
  const BEARER_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

  if (capturedBearerToken && bearerCapturedAt) {
    const age = Date.now() - bearerCapturedAt;
    if (age < BEARER_MAX_AGE_MS) {
      return {
        success: true,
        token: capturedBearerToken,
        age: Math.floor(age / 1000),
        maxAge: BEARER_MAX_AGE_MS / 1000,
        fresh: age < 300000 // < 5 minutes = fresh
      };
    }
  }

  // Token expired or not available
  return {
    success: false,
    error: "Bearer tidak tersedia atau sudah expired. User perlu berinteraksi dengan Google Labs di browser.",
    hasBearer: !!capturedBearerToken,
    age: bearerCapturedAt ? Math.floor((Date.now() - bearerCapturedAt) / 1000) : null
  };
};

/**
 * Trigger reCAPTCHA langsung via JavaScript - TANPA perlu klik Generate
 * Memanggil grecaptcha.enterprise.execute() secara langsung
 */
export const triggerRecaptchaCapture = async (prompt = "test video generation") => {
  if (!activePage) {
    return { success: false, error: "Browser belum dibuka" };
  }

  if (isCapturingToken) {
    return { success: false, error: "Sedang dalam proses capture token" };
  }

  try {
    isCapturingToken = true;
    veoEvents.emit("token-capture-started", { prompt });

    console.log("[Playwright] Triggering reCAPTCHA via JavaScript...");

    // Pastikan di halaman Video FX
    const currentUrl = activePage.url();
    if (!currentUrl.includes("video-fx") && !currentUrl.includes("labs.google/fx")) {
      await activePage.goto(GOOGLE_LABS_URL, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      await activePage.waitForTimeout(3000);
    }

    // Tunggu halaman siap
    await activePage.waitForTimeout(2000);

    // Reset token sebelumnya
    capturedRecaptchaToken = null;
    tokenCapturedAt = null;

    // === Langsung execute reCAPTCHA via JavaScript ===
    console.log("[Playwright] Executing grecaptcha.enterprise.execute()...");

    try {
      // Coba execute reCAPTCHA langsung dengan site key yang digunakan Google Labs
      const token = await activePage.evaluate(async () => {
        return new Promise((resolve, reject) => {
          // Tunggu grecaptcha tersedia
          const waitForRecaptcha = () => {
            if (typeof grecaptcha !== 'undefined' && grecaptcha.enterprise) {
              return true;
            }
            return false;
          };

          // Check setiap 100ms sampai grecaptcha tersedia (max 10 detik)
          let attempts = 0;
          const checkInterval = setInterval(async () => {
            attempts++;
            if (waitForRecaptcha()) {
              clearInterval(checkInterval);
              try {
                // Site key dari Google Labs
                const siteKey = '6LdsFiUsAAAAAIjVDZcuLhaHiDn5nnHVXVRQGeMV';
                const token = await grecaptcha.enterprise.execute(siteKey, { action: 'FLOW_GENERATION' });
                resolve(token);
              } catch (err) {
                reject(err);
              }
            } else if (attempts > 100) {
              clearInterval(checkInterval);
              reject(new Error('grecaptcha not available after 10 seconds'));
            }
          }, 100);
        });
      });

      if (token && typeof token === 'string' && token.length > 100) {
        capturedRecaptchaToken = token;
        tokenCapturedAt = Date.now();
        console.log("[Playwright] ✓ Token captured via direct JS execution! Length:", token.length);

        isCapturingToken = false;
        veoEvents.emit("token-capture-success", {
          token: token.substring(0, 50) + "...",
          length: token.length,
          method: "direct-js"
        });

        return {
          success: true,
          token: token,
          message: "Token berhasil di-capture via JavaScript!",
          method: "direct-js"
        };
      }
    } catch (jsError) {
      console.log("[Playwright] Direct JS execution failed:", jsError.message);
      console.log("[Playwright] Falling back to network intercept method...");
    }

    // === Fallback: Intercept dari network jika direct JS gagal ===
    // Tunggu token dari network intercept (mungkin sudah ada dari aktivitas sebelumnya)
    const startTime = Date.now();
    const timeout = 15000;

    while (Date.now() - startTime < timeout) {
      if (capturedRecaptchaToken) {
        console.log("[Playwright] ✓ Token captured from network intercept!");
        isCapturingToken = false;
        veoEvents.emit("token-capture-success", {
          token: capturedRecaptchaToken.substring(0, 50) + "...",
          length: capturedRecaptchaToken.length,
          method: "network-intercept"
        });
        return {
          success: true,
          token: capturedRecaptchaToken,
          message: "Token berhasil di-capture!",
          method: "network-intercept"
        };
      }
      await activePage.waitForTimeout(500);
    }

    isCapturingToken = false;
    veoEvents.emit("token-capture-failed", { error: "Tidak bisa mendapatkan token" });
    return {
      success: false,
      error: "Gagal mendapatkan token. Coba refresh halaman di browser dan capture lagi."
    };

  } catch (error) {
    isCapturingToken = false;
    console.error("[Playwright] Token capture error:", error);
    veoEvents.emit("token-capture-failed", { error: String(error) });
    return { success: false, error: String(error) };
  }
};

/**
 * Execute API request dari dalam browser context
 * Ini memastikan token reCAPTCHA dan request dalam context yang sama
 */
// Execute API request from browser context
export const executeApiRequest = async ({ url, method = "POST", headers = {}, payload }) => {
  if (!activePage) {
    return { success: false, error: "Browser belum dibuka", status: 500 };
  }

  try {
    console.log("[Playwright] Executing API request from browser context...");

    // Cek apakah sudah di Labs
    const currentUrl = activePage.url();
    const isAtLabs = currentUrl.includes(GOOGLE_LABS_URL) || currentUrl.includes("labs.google");

    if (!isAtLabs) {
      console.log("[Playwright] Navigating to Labs...");
      await activePage.goto(GOOGLE_LABS_URL, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
    } else {
      console.log("[Playwright] Already at Labs, skipping full reload...");
    }

    // Tunggu sebentar untuk pastikan script ready
    await activePage.waitForTimeout(2000);

    // Verify grecaptcha tersedia (Retry logik)
    let hasGrecaptcha = await activePage.evaluate(() => {
      return typeof grecaptcha !== 'undefined' && typeof grecaptcha.enterprise !== 'undefined';
    });

    if (!hasGrecaptcha) {
      console.log("[Playwright] grecaptcha not found, trying reload...");
      await activePage.reload({ waitUntil: "networkidle" });
      await activePage.waitForTimeout(3000);
      hasGrecaptcha = await activePage.evaluate(() => {
        return typeof grecaptcha !== 'undefined' && typeof grecaptcha.enterprise !== 'undefined';
      });
    }

    if (!hasGrecaptcha) {
      console.log("[Playwright] ⚠️ grecaptcha still not available!");
      return { success: false, error: "grecaptcha failed to load. Check VNC.", status: 500 };
    }

    console.log("[Playwright] ✓ grecaptcha available. Simulating human behavior...");

    // === HUMAN SIMULATION START ===
    // Gerakkan mouse secara acak untuk menipu reCAPTCHA invsible
    await activePage.mouse.move(100, 100);
    await activePage.waitForTimeout(Math.random() * 500 + 200);
    await activePage.mouse.move(200 + Math.random() * 100, 300 + Math.random() * 100, { steps: 10 });
    await activePage.waitForTimeout(Math.random() * 500 + 200);

    // Klik sembarang elemen aman (misal: body) untuk fokus
    try {
      await activePage.click('body', { position: { x: 10, y: 10 } });
    } catch (_) { }
    await activePage.waitForTimeout(1000);
    // === HUMAN SIMULATION END ===

    console.log("[Playwright] Executing API request...");

    const result = await activePage.evaluate(async ({ url, method, headers, payload }) => {
      try {
        // Step 1: Get fresh reCAPTCHA token
        let recaptchaToken = null;
        if (typeof grecaptcha !== 'undefined' && grecaptcha.enterprise) {
          try {
            const siteKey = '6LdsFiUsAAAAAIjVDZcuLhaHiDn5nnHVXVRQGeMV';
            recaptchaToken = await grecaptcha.enterprise.execute(siteKey, { action: 'FLOW_GENERATION' });
            console.log('[Browser] Got reCAPTCHA token, length:', recaptchaToken.length);
          } catch (e) {
            console.error('[Browser] reCAPTCHA failed:', e);
          }
        }

        // Step 2: Inject token into payload
        const finalPayload = { ...payload };
        if (recaptchaToken) {
          finalPayload.clientContext = {
            ...(payload.clientContext || {}),
            recaptchaToken: recaptchaToken
          };
        }

        // Step 3: Make API request from browser
        const response = await fetch(url, {
          method: method,
          headers: {
            'Content-Type': 'text/plain; charset=UTF-8',
            'Accept': 'application/json',
            ...headers
          },
          body: JSON.stringify(finalPayload)
        });

        const contentType = response.headers.get('content-type') || '';
        let data;
        if (contentType.includes('application/json')) {
          data = await response.json();
        } else {
          data = await response.text();
        }

        return {
          success: response.ok,
          status: response.status,
          data: data,
          hasToken: !!recaptchaToken
        };
      } catch (err) {
        return {
          success: false,
          status: 500,
          error: String(err)
        };
      }
    }, { url, method, headers, payload });

    console.log("[Playwright] API request result:", {
      status: result.status,
      hasToken: result.hasToken,
      success: result.success
    });

    return result;
  } catch (error) {
    console.error("[Playwright] Execute API request error:", error);
    return { success: false, error: String(error), status: 500 };
  }
};

/**
 * Generate video menggunakan browser automation (full browser mode)
 */
export const generateVideo = async (options = {}) => {
  const {
    jobId,
    prompt,
    aspectRatio = "16:9",
    duration = "8s",
    model = "veo-2",
  } = options;

  if (!activePage) {
    return { success: false, error: "Browser belum dibuka" };
  }

  if (isGenerating) {
    return { success: false, error: "Sedang ada proses generate berjalan" };
  }

  try {
    isGenerating = true;
    currentJobId = jobId;
    veoEvents.emit("job-started", { jobId, prompt });

    console.log(`[Playwright] Starting generate: ${prompt.substring(0, 50)}...`);

    // Pastikan di halaman Video FX
    const currentUrl = activePage.url();
    if (!currentUrl.includes("video-fx")) {
      await activePage.goto(GOOGLE_LABS_URL, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      await activePage.waitForTimeout(3000);
    }

    // Tunggu halaman siap
    await activePage.waitForTimeout(2000);

    // === STEP 1: Set Aspect Ratio ===
    try {
      const aspectButtons = await activePage.$$(
        'button[aria-label*="aspect"], button[data-aspect-ratio], [class*="aspect"]'
      );

      const aspectMap = {
        "16:9": "16:9",
        "9:16": "9:16",
        "1:1": "1:1",
      };

      const targetAspect = aspectMap[aspectRatio] || "16:9";

      for (const btn of aspectButtons) {
        const text = await btn.textContent();
        if (text && text.includes(targetAspect)) {
          await btn.click();
          await activePage.waitForTimeout(500);
          break;
        }
      }
    } catch (e) {
      console.log("[Playwright] Could not set aspect ratio:", e.message);
    }

    // === STEP 2: Input Prompt ===
    try {
      const promptSelectors = [
        'textarea[placeholder*="prompt"]',
        'textarea[placeholder*="Describe"]',
        'textarea[aria-label*="prompt"]',
        "textarea",
        '[contenteditable="true"]',
      ];

      let promptInput = null;
      for (const selector of promptSelectors) {
        promptInput = await activePage.$(selector);
        if (promptInput) break;
      }

      if (promptInput) {
        await promptInput.click();
        await activePage.waitForTimeout(300);
        await promptInput.fill("");
        await activePage.waitForTimeout(200);
        await promptInput.fill(prompt);
        await activePage.waitForTimeout(500);
        console.log("[Playwright] Prompt entered");
      } else {
        throw new Error("Tidak dapat menemukan input prompt");
      }
    } catch (e) {
      console.error("[Playwright] Prompt input error:", e);
      throw e;
    }

    // === STEP 3: Klik Generate Button ===
    try {
      const generateSelectors = [
        'button:has-text("Generate")',
        'button:has-text("Create")',
        'button[aria-label*="generate"]',
        'button[aria-label*="create"]',
        'button[type="submit"]',
      ];

      let generateBtn = null;
      for (const selector of generateSelectors) {
        try {
          generateBtn = await activePage.$(selector);
          if (generateBtn) {
            const isVisible = await generateBtn.isVisible();
            const isEnabled = await generateBtn.isEnabled();
            if (isVisible && isEnabled) break;
          }
        } catch (_) { }
      }

      if (generateBtn) {
        await generateBtn.click();
        console.log("[Playwright] Generate button clicked");
        veoEvents.emit("job-progress", {
          jobId,
          status: "generating",
          message: "Memulai generate...",
        });
      } else {
        throw new Error("Tidak dapat menemukan tombol Generate");
      }
    } catch (e) {
      console.error("[Playwright] Generate button error:", e);
      throw e;
    }

    // === STEP 4: Monitor Progress ===
    let attempts = 0;
    const maxAttempts = 300; // Max 5 menit
    let videoUrl = null;

    while (attempts < maxAttempts && !videoUrl) {
      attempts++;
      await activePage.waitForTimeout(1000);

      // Cek error (termasuk CAPTCHA)
      try {
        const errorElement = await activePage.$('[class*="error"], [role="alert"]');
        if (errorElement) {
          const errorText = await errorElement.textContent();
          if (errorText && errorText.toLowerCase().includes("captcha")) {
            veoEvents.emit("captcha-required", {
              jobId,
              message: "Silakan selesaikan CAPTCHA di browser",
            });
            console.log("[Playwright] CAPTCHA detected - waiting for user...");
            await activePage.waitForTimeout(120000);
            continue;
          }
        }
      } catch (_) { }

      // Cek progress
      try {
        const progressElement = await activePage.$('[class*="progress"], [role="progressbar"]');
        if (progressElement) {
          const progressText = await progressElement.textContent();
          veoEvents.emit("job-progress", {
            jobId,
            status: "generating",
            message: progressText || "Sedang memproses...",
            attempt: attempts,
          });
        }
      } catch (_) { }

      // Cek video ready
      try {
        const videoElements = await activePage.$$("video source, video[src]");
        for (const videoEl of videoElements) {
          const src =
            (await videoEl.getAttribute("src")) ||
            (await videoEl.evaluate((el) => el.src));
          if (src && src.includes("blob:") === false && src.includes("http")) {
            videoUrl = src;
            break;
          }
        }

        if (!videoUrl) {
          const downloadLinks = await activePage.$$('a[download], a[href*=".mp4"]');
          for (const link of downloadLinks) {
            const href = await link.getAttribute("href");
            if (href && href.includes("http")) {
              videoUrl = href;
              break;
            }
          }
        }
      } catch (_) { }

      if (attempts % 10 === 0) {
        console.log(`[Playwright] Waiting for video... (${attempts}s)`);
        veoEvents.emit("job-progress", {
          jobId,
          status: "generating",
          message: `Menunggu video selesai... (${attempts}s)`,
        });
      }
    }

    isGenerating = false;
    currentJobId = null;

    if (videoUrl) {
      console.log("[Playwright] Video generated successfully:", videoUrl);
      veoEvents.emit("job-completed", {
        jobId,
        videoUrl,
        message: "Video berhasil di-generate!",
      });
      return { success: true, jobId, videoUrl };
    } else {
      throw new Error("Timeout menunggu video selesai");
    }
  } catch (error) {
    isGenerating = false;
    currentJobId = null;
    console.error("[Playwright] Generate error:", error);
    veoEvents.emit("job-failed", {
      jobId,
      error: String(error),
    });
    return { success: false, error: String(error) };
  }
};

/**
 * Cancel current generation
 */
export const cancelGenerate = async () => {
  if (!isGenerating) {
    return { success: false, message: "Tidak ada proses yang berjalan" };
  }

  try {
    isGenerating = false;
    const cancelledJobId = currentJobId;
    currentJobId = null;

    if (activePage) {
      try {
        const cancelBtn = await activePage.$('button:has-text("Cancel"), button:has-text("Stop")');
        if (cancelBtn) {
          await cancelBtn.click();
        }
      } catch (_) { }
    }

    veoEvents.emit("job-cancelled", { jobId: cancelledJobId });
    return { success: true, message: "Generate dibatalkan" };
  } catch (error) {
    return { success: false, error: String(error) };
  }
};

/**
 * Screenshot halaman saat ini (untuk debugging)
 */
export const takeScreenshot = async () => {
  if (!activePage) {
    return { success: false, error: "Browser belum dibuka" };
  }

  try {
    const screenshotPath = path.join(
      process.cwd(),
      "uploads",
      `screenshot-${Date.now()}.png`
    );
    await activePage.screenshot({ path: screenshotPath, fullPage: true });
    return { success: true, path: screenshotPath };
  } catch (error) {
    return { success: false, error: String(error) };
  }
};



export default {
  launchBrowser,
  closeBrowser,
  navigateToLabs,
  getBrowserStatus,
  getRecaptchaToken,
  getCapturedBearer,
  triggerRecaptchaCapture,
  executeApiRequest,
  generateVideo,
  cancelGenerate,
  takeScreenshot,
  hasValidSession,
  veoEvents,
};
