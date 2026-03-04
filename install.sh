#!/usr/bin/env bash

echo "========================================"
echo "🛡️  AI Agent Gateway - One-Liner Installer"
echo "========================================"

HAS_NODE=$(command -v node >/dev/null 2>&1 && echo "yes" || echo "no")
if [ "$HAS_NODE" = "no" ]; then
    echo "❌ Node.js ist nicht installiert. Bitte installiere Node.js v18+."
    exit 1
fi

HAS_NPM=$(command -v npm >/dev/null 2>&1 && echo "yes" || echo "no")
if [ "$HAS_NPM" = "no" ]; then
    echo "❌ npm ist nicht installiert. Bitte installiere npm."
    exit 1
fi

HAS_GIT=$(command -v git >/dev/null 2>&1 && echo "yes" || echo "no")
if [ "$HAS_GIT" = "no" ]; then
    echo "❌ git ist nicht installiert. Bitte installiere git."
    exit 1
fi

if [ ! -f "package.json" ]; then
    echo "📥 Klone Repository..."
    git clone https://github.com/your-repo/ai-agent-gateway.git .
fi

echo "📦 Installiere Abhängigkeiten (npm install)..."
npm install --silent

echo "⚙️  Kompiliere TypeScript (npm run build)..."
npm run build --silent

echo "🔗 Verlinke globales Command 'chyi'..."
npm link

echo "✅ Installation erfolgreich abgeschlossen."
echo ""
echo "Starte das chyi-Setup..."

# Redirect stdin from tty to allow interactive readline inside a curl | bash pipe
exec < /dev/tty
chyi config