#!/bin/bash

# 1. PENTING: Hapus lock file sisa crash/restart sebelumnya
# Tanpa ini, container akan error "Server is already active for display 99" saat restart
rm -f /tmp/.X99-lock

# 2. Start Xvfb (Virtual Display) di background
echo "📺 Starting Xvfb virtual display on :99..."
Xvfb :99 -screen 0 1280x900x24 -ac &

# 3. Tunggu Xvfb siap
sleep 2
echo "✅ Xvfb started. DISPLAY=$DISPLAY"

# 4. Start VNC Server (untuk remote access ke virtual display)
echo "🖥️ Starting VNC server on port 5900..."
if [ -n "$VNC_PASSWORD" ]; then
    mkdir -p ~/.vnc
    x11vnc -storepasswd "$VNC_PASSWORD" ~/.vnc/passwd
    x11vnc -display :99 -forever -shared -rfbport 5900 -rfbauth ~/.vnc/passwd &
else
    x11vnc -display :99 -forever -shared -nopw -rfbport 5900 &
fi
sleep 1
echo "✅ VNC server started on port 5900"

# 5. Start noVNC (web-based VNC viewer)
echo "🌐 Starting noVNC web viewer on port 6080..."

# Find noVNC web directory (structure varies by distro)
NOVNC_WEB=""
for webpath in /usr/share/novnc /usr/share/novnc/vnc.html /usr/share/novnc/public; do
    if [ -f "$webpath/vnc.html" ] || [ -f "$webpath" ]; then
        if [ -d "$webpath" ]; then
            NOVNC_WEB="$webpath"
        else
            NOVNC_WEB="$(dirname $webpath)"
        fi
        break
    fi
done

# If vnc.html not in expected location, search for it
if [ -z "$NOVNC_WEB" ]; then
    FOUND_VNC=$(find /usr/share -name "vnc.html" 2>/dev/null | head -1)
    if [ -n "$FOUND_VNC" ]; then
        NOVNC_WEB="$(dirname $FOUND_VNC)"
    fi
fi

echo "📍 noVNC web directory: ${NOVNC_WEB:-not found}"
echo "📂 Contents: "
ls -la "${NOVNC_WEB:-/usr/share/novnc}" 2>/dev/null | head -10

# Start websockify with the correct web path
if [ -n "$NOVNC_WEB" ]; then
    echo "🚀 Starting websockify with web dir: $NOVNC_WEB"
    websockify --web="$NOVNC_WEB" 6080 localhost:5900 &
    sleep 2
    echo "✅ noVNC started on port 6080"
else
    echo "⚠️ noVNC web files not found! VNC access via browser will not work."
    echo "📝 Available in /usr/share:"
    ls /usr/share | grep -i vnc || echo "No VNC directories found"
fi

# 6a. ALWAYS REMOVE LOCK FILES (Prevent "profile in use" error)
echo "🧹 Removing browser lock files..."
rm -f /app/browser-data/SingletonLock /app/browser-data/SingletonCookie /app/browser-data/SingletonSocket
rm -f /app/browser-data/Default/SingletonLock /app/browser-data/Default/SingletonCookie /app/browser-data/Default/SingletonSocket
rm -f /app/browser-data/.org.chromium.Chromium* 
echo "✅ Lock files removed."

# 6b. FORCE RESET SESSION (If Requested via ENV)
if [ "$FORCE_RESET" = "true" ]; then
    echo "⚠️ FORCE_RESET detected! Wiping browser data..."
    rm -rf /app/browser-data/*
    rm -rf /app/browser-data-firefox/*
    echo "✅ Browser data wiped."
fi

# 6. Auto-download browser session from Google Drive (if SESSION_URL is set and folder empty)
if [ -n "$SESSION_URL" ]; then
    cd /app/browser-data
    # Check if browser-data is empty (no session yet)
    if [ ! -f "Default/Cookies" ] && [ ! -f "SingletonLock" ]; then
        echo "📥 Downloading browser session from Google Drive..."
        # For large files, Google Drive needs confirmation
        wget --no-check-certificate "$SESSION_URL" -O session.zip 2>/dev/null || \
        wget --no-check-certificate "${SESSION_URL}&confirm=yes" -O session.zip 2>/dev/null
        
        if [ -f "session.zip" ] && [ -s "session.zip" ]; then
            echo "📦 Extracting session..."
            unzip -o session.zip
            rm -f session.zip
            
            # Hapus file lock yang ikut terupload dari local
            echo "🧹 Removing lock files..."
            rm -f SingletonLock SingletonCookie SingletonSocket
            rm -f Default/SingletonLock Default/SingletonCookie Default/SingletonSocket
            
            echo "✅ Session extracted & cleaned successfully!"
            ls -la
        else
            echo "⚠️ Failed to download session. Will start fresh."
            rm -f session.zip
        fi
    else
        echo "✅ Browser session already exists, skipping download."
    fi
    cd /app
fi

# 7. Print access info
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "🖥️  VNC ACCESS (untuk lihat browser):"
echo "    noVNC (Browser): http://YOUR_DOMAIN:6080/vnc.html"
echo "    VNC Client:      YOUR_DOMAIN:5900"
echo "═══════════════════════════════════════════════════════════"
echo ""

# 8. Start aplikasi
echo "🚀 Starting Node.js application..."
exec node server/index.js
