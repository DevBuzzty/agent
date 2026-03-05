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
# If we are already inside the project directory (e.g., during 'chyi update')
if [ -f "package.json" ] && grep -q "ai-agent-gateway" package.json; then
    echo "📂 Führe Update im aktuellen Verzeichnis aus..."
    if [ "$UPDATE_MODE" = true ]; then
        echo "🔄 Lade neusten Code von GitHub (git pull)..."
        git fetch origin
        CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "feature/ai-gateway-architecture-15263833713041301073")
        git pull origin "$CURRENT_BRANCH"
    fi
# If the target directory exists but we are outside of it
elif [ -d "$TARGET_DIR" ]; then
    echo "📂 Wechsle in den Projektordner '$TARGET_DIR'..."
    cd "$TARGET_DIR"
    echo "🔄 Lade neusten Code von GitHub (git pull)..."
    git fetch origin
    CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "feature/ai-gateway-architecture-15263833713041301073")
    git pull origin "$CURRENT_BRANCH"
# Fresh install
else
    echo "📥 Klone Repository in den Ordner '$TARGET_DIR'..."
    # Checkout the specific feature branch so we don't accidentally download the outdated 'main' branch
    git clone -b feature/ai-gateway-architecture-15263833713041301073 https://github.com/DevBuzzty/agent.git "$TARGET_DIR"
    cd "$TARGET_DIR"
fi

echo "📦 Installiere Abhängigkeiten (npm install)..."
# Remove implicit TTY piping that breaks curl | bash script readers.
npm install < /dev/null

echo "⚙️  Kompiliere TypeScript (npm run build)..."
# By pulling input from /dev/null, it prevents the compiler from waiting on hanging shell IO
npm run build < /dev/null

echo "🔗 Verlinke globales Command 'chyi'..."
# Handle permissions error on global npm installations (EACCES)
if ! npm link < /dev/null; then
    echo "⚠️  Fehlende Schreibrechte für globale NPM Module entdeckt (EACCES)."
    echo "🔧 Versuche Verlinkung mit 'sudo' (du wirst evtl. nach deinem Passwort gefragt)..."
    # ONLY map the TTY here so sudo can safely ask for a password without breaking the main script stream
    sudo npm link < /dev/tty
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

  # Bind input to TTY explicitly for the interactive UI
  chyi config < /dev/tty
fi