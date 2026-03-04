#!/usr/bin/env bash
set -e

# Parse arguments for update mode
UPDATE_MODE=false
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --update) UPDATE_MODE=true ;;
        *) echo "Unknown parameter passed: $1"; exit 1 ;;
    esac
    shift
done

echo "========================================"
if [ "$UPDATE_MODE" = true ]; then
  echo "🛡️  AI Agent Gateway - Auto Updater"
else
  echo "🛡️  AI Agent Gateway - One-Liner Installer"
fi
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

TARGET_DIR="ai-agent-gateway"

# Clone vs Pull
if [ "$UPDATE_MODE" = false ] && [ ! -d "$TARGET_DIR" ] && [ ! -f "package.json" ]; then
    echo "📥 Klone Repository in den Ordner '$TARGET_DIR'..."
    git clone https://github.com/DevBuzzty/agent.git "$TARGET_DIR"
    cd "$TARGET_DIR"
elif [ -d "$TARGET_DIR" ]; then
    echo "📂 Wechsle in den Projektordner '$TARGET_DIR'..."
    cd "$TARGET_DIR"
fi

if [ "$UPDATE_MODE" = true ]; then
    echo "🔄 Lade neusten Code von GitHub (git pull)..."
    git fetch origin
    # Fallback to the current branch being used in development
    CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "feature/ai-gateway-architecture-15263833713041301073")
    git pull origin "$CURRENT_BRANCH"
fi

echo "📦 Installiere Abhängigkeiten (npm install)..."
npm install --silent

echo "⚙️  Kompiliere TypeScript (npm run build)..."
npm run build --silent

# Wir brauchen ab hier den TTY Zugang, falls npm link sudo-Rechte benötigt
# oder für das interaktive Inquirer-Setup im Anschluss.
exec < /dev/tty

echo "🔗 Verlinke globales Command 'chyi'..."
# Handle permissions error on global npm installations (EACCES)
if ! npm link; then
    echo "⚠️  Fehlende Schreibrechte für globale NPM Module entdeckt (EACCES)."
    echo "🔧 Versuche Verlinkung mit 'sudo' (du wirst evtl. nach deinem Passwort gefragt)..."
    sudo npm link
fi

if [ "$UPDATE_MODE" = true ]; then
  echo "✅ Update erfolgreich abgeschlossen!"
  echo "Deine config.json5 und .env Dateien bleiben unangetastet."

  # Restart daemon if it was running
  if [ -f "gateway.pid" ]; then
      echo "🔄 Starte laufenden Gateway Prozess neu..."
      chyi stop
      chyi start
  else
      echo "ℹ️ Gateway läuft aktuell nicht. Starte mit 'chyi start'."
  fi
else
  echo "✅ Installation erfolgreich abgeschlossen."
  echo ""
  echo "Starte das chyi-Setup..."

  chyi config
fi