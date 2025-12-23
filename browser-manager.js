/**
 * Browser Manager for Relay Service
 * 
 * Mengelola browser Playwright dengan stealth plugin.
 * Fokus pada capture reCAPTCHA token dan proxy request.
 */

import { chromium } from 'playwright-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import path from 'node:path';
import fs from 'node:fs';

// Apply stealth plugin
chromium.use(stealthPlugin());

// Constants
const BROWSER_DATA_DIR = path.resolve(process.cwd(), 'browser-data');
const GOOGLE_LABS_URL = 'https://labs.google/fx/tools/video-fx';
const RECAPTCHA_SITE_KEY = '6LdsFiUsAAAAAIjVDZcuLhaHiDn5nnHVXVRQGeMV';

// State
let browserContext = null;
let activePage = null;

// Ensure browser data directory exists
if (!fs.existsSync(BROWSER_DATA_DIR)) {
    fs.mkdirSync(BROWSER_DATA_DIR, { recursive: true });
}

/**
 * Launch browser with stealth configuration
 */
export const launchBrowser = async () => {
    try {
        if (browserContext) {
            console.log('[Browser] Already running, returning existing instance');
            return { success: true, message: 'Browser already running' };
        }

        console.log('[Browser] Launching with stealth plugin...');
        console.log('[Browser] Data dir:', BROWSER_DATA_DIR);

        // Check if running in headless environment (no display)
        const hasDisplay = process.env.DISPLAY || process.platform === 'win32';
        const useHeadless = !hasDisplay;

        browserContext = await chromium.launchPersistentContext(BROWSER_DATA_DIR, {
            headless: useHeadless,
            viewport: { width: 1280, height: 900 },
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            args: [
                '--disable-blink-features=AutomationControlled',
                '--disable-features=IsolateOrigins,site-per-process',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-infobars',
                '--window-size=1280,900',
                '--use-gl=swiftshader', // GPU emulation
            ],
            ignoreDefaultArgs: ['--enable-automation'],
            locale: 'en-US',
            timezoneId: 'Asia/Jakarta',
        });

        // Get or create page
        const pages = browserContext.pages();
        activePage = pages.length > 0 ? pages[0] : await browserContext.newPage();

        console.log('[Browser] ✓ Launched successfully (headless:', useHeadless + ')');
        return { success: true, headless: useHeadless };

    } catch (err) {
        console.error('[Browser] Launch failed:', err);
        return { success: false, error: err.message };
    }
};

/**
 * Close browser
 */
export const closeBrowser = async () => {
    try {
        if (browserContext) {
            await browserContext.close();
            browserContext = null;
            activePage = null;
            console.log('[Browser] ✓ Closed');
        }
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
};

/**
 * Get browser status
 */
export const getBrowserStatus = async () => {
    const status = {
        browserRunning: !!browserContext,
        pageReady: !!activePage,
        currentUrl: null,
        isLoggedIn: false,
        isOnLabs: false
    };

    if (activePage) {
        try {
            status.currentUrl = activePage.url();
            status.isOnLabs = status.currentUrl.includes('labs.google');

            // Check login status by looking for user profile elements
            const userProfile = await activePage.$('img[src*="googleusercontent.com"]');
            status.isLoggedIn = !!userProfile;
        } catch (e) {
            status.error = e.message;
        }
    }

    return status;
};

/**
 * Navigate to Google Labs
 */
export const navigateToLabs = async () => {
    if (!activePage) {
        return { success: false, error: 'Browser not launched' };
    }

    try {
        console.log('[Browser] Navigating to Labs...');
        await activePage.goto(GOOGLE_LABS_URL, {
            waitUntil: 'domcontentloaded',
            timeout: 30000
        });

        // Wait for page to stabilize
        await activePage.waitForTimeout(2000);

        console.log('[Browser] ✓ On Google Labs');
        return { success: true, url: activePage.url() };
    } catch (err) {
        return { success: false, error: err.message };
    }
};

/**
 * Execute proxy request through browser
 * This captures reCAPTCHA token and makes the request from browser context
 */
export const executeProxyRequest = async ({ url, method = 'POST', headers = {}, payload }) => {
    if (!activePage) {
        return { success: false, error: 'Browser not launched', status: 500 };
    }

    try {
        console.log('[Browser] Executing proxy request...');

        // Ensure we're on Labs page
        const currentUrl = activePage.url();
        if (!currentUrl.includes('labs.google')) {
            console.log('[Browser] Not on Labs, navigating...');
            await activePage.goto(GOOGLE_LABS_URL, { waitUntil: 'domcontentloaded' });
            await activePage.waitForTimeout(2000);
        }

        // Simulate human behavior
        await activePage.mouse.move(100, 100);
        await activePage.waitForTimeout(Math.random() * 500 + 200);
        await activePage.mouse.move(200 + Math.random() * 100, 300 + Math.random() * 100, { steps: 10 });
        await activePage.waitForTimeout(Math.random() * 500 + 200);

        // Check if grecaptcha is available
        const hasGrecaptcha = await activePage.evaluate(() => {
            return typeof grecaptcha !== 'undefined' && typeof grecaptcha.enterprise !== 'undefined';
        });

        if (!hasGrecaptcha) {
            console.log('[Browser] reCAPTCHA not available, reloading...');
            await activePage.reload({ waitUntil: 'networkidle' });
            await activePage.waitForTimeout(3000);
        }

        // Execute request from browser context
        const result = await activePage.evaluate(async ({ url, method, headers, payload, siteKey }) => {
            try {
                // Get reCAPTCHA token
                let recaptchaToken = null;
                if (typeof grecaptcha !== 'undefined' && grecaptcha.enterprise) {
                    try {
                        recaptchaToken = await grecaptcha.enterprise.execute(siteKey, { action: 'FLOW_GENERATION' });
                        console.log('[Browser] Got reCAPTCHA token, length:', recaptchaToken?.length);
                    } catch (e) {
                        console.error('[Browser] reCAPTCHA failed:', e);
                    }
                }

                // Prepare payload with token
                const finalPayload = { ...payload };
                if (recaptchaToken && finalPayload) {
                    finalPayload.recaptchaToken = recaptchaToken;
                }

                // Make the request
                const response = await fetch(url, {
                    method: method,
                    headers: {
                        'Content-Type': 'application/json',
                        ...headers
                    },
                    body: JSON.stringify(finalPayload),
                    credentials: 'include'
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
                    error: err.message,
                    hasToken: false
                };
            }
        }, { url, method, headers, payload, siteKey: RECAPTCHA_SITE_KEY });

        console.log('[Browser] Proxy result:', { status: result.status, hasToken: result.hasToken });
        return result;

    } catch (err) {
        console.error('[Browser] Proxy request failed:', err);
        return { success: false, error: err.message, status: 500 };
    }
};
