/**
 * Browser Relay Service
 * 
 * Service ini menjalankan browser Playwright di VM (bukan container).
 * Digunakan untuk capture reCAPTCHA token dan proxy request ke Google Labs.
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import {
    launchBrowser,
    closeBrowser,
    getBrowserStatus,
    executeProxyRequest,
    navigateToLabs
} from './browser-manager.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.RELAY_API_KEY || 'your-secret-key';

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Auth middleware
const authenticate = (req, res, next) => {
    const authHeader = req.headers['x-api-key'] || req.headers['authorization'];
    const key = authHeader?.replace('Bearer ', '');

    if (key !== API_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
};

// ============ PUBLIC ENDPOINTS ============

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'browser-relay',
        timestamp: new Date().toISOString()
    });
});

// ============ PROTECTED ENDPOINTS ============

// Get browser status
app.get('/status', authenticate, async (req, res) => {
    try {
        const status = await getBrowserStatus();
        res.json(status);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Restart browser
app.post('/restart', authenticate, async (req, res) => {
    try {
        console.log('[Relay] Restarting browser...');
        await closeBrowser();
        const result = await launchBrowser();
        if (result.success) {
            await navigateToLabs();
        }
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Main proxy endpoint - Forward request to Google Labs via browser
app.post('/proxy', authenticate, async (req, res) => {
    try {
        const { url, method, headers, payload } = req.body;

        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }

        console.log(`[Relay] Proxying request to: ${url}`);

        const result = await executeProxyRequest({
            url,
            method: method || 'POST',
            headers: headers || {},
            payload
        });

        // Return dengan status code yang sama
        res.status(result.status || 200).json(result);

    } catch (err) {
        console.error('[Relay] Proxy error:', err);
        res.status(500).json({
            error: 'Proxy request failed',
            detail: err.message
        });
    }
});

// Navigate to Labs (for initial setup)
app.post('/navigate', authenticate, async (req, res) => {
    try {
        const result = await navigateToLabs();
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============ START SERVER ============

app.listen(PORT, async () => {
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`   🚀 Browser Relay Service running on port ${PORT}`);
    console.log('═══════════════════════════════════════════════════════════');

    // Auto-launch browser on startup
    console.log('[Relay] Auto-launching browser...');
    try {
        const result = await launchBrowser();
        if (result.success) {
            console.log('[Relay] ✓ Browser launched successfully');
            await navigateToLabs();
            console.log('[Relay] ✓ Navigated to Google Labs');
        } else {
            console.log('[Relay] ⚠ Browser launch failed:', result.error);
        }
    } catch (err) {
        console.error('[Relay] ⚠ Startup error:', err.message);
    }
});
