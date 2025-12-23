# Browser Relay Service

Service terpisah untuk menjalankan browser Playwright di VM (Oracle Cloud).
Service ini menangani reCAPTCHA dan proxy request ke Google Labs.

## Setup di VM (Oracle Cloud / VPS)

### 1. Install Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install Chrome dependencies untuk Playwright
sudo apt install -y libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
  libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2

# Install Playwright browsers
npx playwright install chromium
npx playwright install-deps chromium
```

### 2. Clone & Setup

```bash
git clone https://github.com/NandaRH/Veo-3.1-fast-3.git browser-relay
cd browser-relay
npm install
```

### 3. Configure Environment

```bash
cp .env.example .env
nano .env
```

Edit `.env`:
```
PORT=3000
RELAY_API_KEY=your-super-secret-key
```

### 4. Run with PM2 (Recommended)

```bash
# Install PM2
sudo npm install -g pm2

# Start service
pm2 start server.js --name browser-relay

# Auto-start on boot
pm2 save
pm2 startup
```

### 5. Expose with Cloudflare Tunnel (Secure)

```bash
# Install cloudflared
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb

# Login to Cloudflare
cloudflared tunnel login

# Create tunnel
cloudflared tunnel create browser-relay

# Run tunnel
cloudflared tunnel --url http://localhost:3000
```

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/health` | No | Health check |
| GET | `/status` | Yes | Browser status |
| POST | `/proxy` | Yes | Proxy request via browser |
| POST | `/restart` | Yes | Restart browser |
| POST | `/navigate` | Yes | Navigate to Labs |

### Authentication

Semua endpoint (kecuali `/health`) membutuhkan header:
```
X-API-Key: your-super-secret-key
```

### Example: Proxy Request

```bash
curl -X POST https://your-tunnel.trycloudflare.com/proxy \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-super-secret-key" \
  -d '{
    "url": "https://aisandbox-pa.googleapis.com/v1/video:batchAsyncGenerateVideoText",
    "method": "POST",
    "payload": {...}
  }'
```

## Integration with Main Railway Server

Di server utama (Railway), set environment variable:
```
BROWSER_RELAY_URL=https://your-tunnel.trycloudflare.com
BROWSER_RELAY_KEY=your-super-secret-key
```

Lalu update kode di `server/index.js` untuk menggunakan relay jika tersedia.
