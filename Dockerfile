FROM node:20-slim

# Force rebuild: 2024-12-22T21:05:00 - Clear cache for NEXT_PUBLIC env vars

# 1. Install Dependencies Sistem
# Tambahan 'procps' (untuk sinyal proses) dan 'dumb-init' (wajib untuk Docker process manager)
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    procps \
    dumb-init \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    xvfb \
    libx11-xcb1 \
    libxcb1 \
    x11vnc \
    novnc \
    python3-websockify \
    unzip \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 2. Copy package files
COPY package*.json ./

# 3. Install Node Modules
RUN npm ci --only=production

# 4. Install Playwright Browsers
# (Ini akan download browser binary ke folder cache Playwright)
RUN npx playwright install chromium

# 5. Copy Source Code
COPY . .

# 6. Build Next.js with NEXT_PUBLIC env vars
# Railway akan pass env vars sebagai build args secara otomatis
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

RUN npm run build

# 7. Create browser-data directory (Untuk Railway Volume)
# Penting: Kita beri permission agar script bisa baca/tulis
RUN mkdir -p browser-data && chmod 777 browser-data

# Expose ports: 8790 (app), 5900 (VNC), 6080 (noVNC web)
EXPOSE 8790 5900 6080

# Environment variables
ENV NODE_ENV=production
ENV PORT=8790
ENV DISPLAY=:99

# 8. Script Startup
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Gunakan dumb-init sebagai entrypoint utama (Best Practice Docker)
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["/docker-entrypoint.sh"]