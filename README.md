# AI Agent Gateway

Ein hochsicherer, persistenter Node.js Hintergrundprozess, der als zentrales Gateway für KI-Agenten fungiert. Die Architektur basiert auf einer strikten, unabänderlichen **sechsstufigen Verarbeitungspipeline** kombiniert mit dynamischem Wissensmanagement, "Secure-by-Default" Sandboxing und iterativen nativen Werkzeugen.

---

## 🏗️ Systemarchitektur (Die 6 Stufen)

1. **Channel Adapter**: Normalisiert Payloads aus verschiedenen APIs (Telegram, Webhooks).
2. **Gateway Server**: Zentraler Router, der Nachrichten über Authentifizierungs-Token an persistente Sitzungen (SQLite) koppelt.
3. **Lane Queue**: Eine sicherheitskritische Warteschlange, die strikt nach **FIFO** (First-In-First-Out) pro Sitzung arbeitet, um Race Conditions zu verhindern.
4. **Agent Runner**: Verwaltet dynamisch verschiedene Sprachmodelle (OpenAI, Anthropic, Gemini, Ollama, Moonshot, OpenRouter) mit API Key Cooling und harter Context Window Beschneidung.
5. **Agentic Loop (ReAct)**: Der iterative Zyklus, in dem das LLM über Aufgaben nachdenkt (Reasoning), native "First-Class Tools" aufruft (Acting) und Ergebnisse als Evidenz zurückgespeist bekommt.
6. **Response Path**: Streamt Ergebnisse asynchron zurück zum Ursprung und speichert ein lückenloses, deterministisches JSONL-Transkript auf der Festplatte.

---

## 🔒 Sicherheitsarchitektur (Secure-by-Default)

Dieses Gateway ist extrem gehärtet gegen RCE (Remote Code Execution), Datenexfiltration und Symlink Breakouts.

- **Kein direkter Zugriff:** Der Agent hat initial *keinen* Zugriff auf die Host-Shell oder das Dateisystem außerhalb seines dedizierten `agent_workspace`.
- **SecretRef Paradigma:** API-Schlüssel dürfen **niemals als reiner Text** (Plaintext) in der Konfiguration gespeichert werden. Das System erzwingt die Auslagerung in Umgebungsvariablen (`env`), verschlüsselte Dateien (`file`) oder HashiCorp Vault Execution (`exec`).
- **Micro Virtual Containers:** Agenten werden isoliert in Proxy-gekoppelten Docker-Containern ausgeführt. Der Hauptprozess bindet sich ausschließlich an `127.0.0.1`.
- **Pre-Authentication Parsing:** Eingehende Webhook-Payloads validieren kryptografische Signaturen *bevor* tiefes JSON-Parsing stattfindet, um "Billion Laughs" DoS-Angriffe zu verhindern.

---

## 🛠️ Installation & Setup

### Voraussetzungen
- **Node.js**: v18.x oder höher
- **Docker**: (Optional, aber empfohlen) Für die Micro Virtual Container Sandboxes.
- **Chrome/Chromium**: Erforderlich, wenn das `browser_control` Werkzeug genutzt werden soll.

### Automatisches Setup (One-Liner)
Das System kann mit einem einzigen Befehl vollständig installiert und konfiguriert werden. Lade das Projekt herunter, kompiliere es und installiere das globale Kommandozeilen-Tool `chyi`:

```bash
curl -fsSL https://raw.githubusercontent.com/dein-repo/ai-agent-gateway/main/install.sh | bash
```

*Das interaktive Onboarding (`chyi config`) fragt alle notwendigen Einstellungen ab (Modell, Provider, API Keys) und generiert vollautomatisch die sichere `config.json5` und `.env` Dateien unter strenger Einhaltung des `SecretRef`-Paradigmas.*

### Alternativ: Manuelle Installation

1. Abhängigkeiten installieren: `npm install`
2. Projekt kompilieren: `npm run build`
3. CLI Tool global verlinken: `npm link`
4. Setup starten: `chyi config`

---

## 💻 Das `chyi` Kommandozeilen-Tool

Die Bedienung des Gateways erfolgt bequem über das Terminal mit dem `chyi` Command:

- `chyi config` : Startet das interaktive Setup-Menü, um API Schlüssel, LLM Provider und Modelle anzupassen.
- `chyi start`  : Startet den Gateway-Daemon sicher und entkoppelt im Hintergrund.
- `chyi stop`   : Beendet den aktuell laufenden Gateway-Daemon.
- `chyi status` : Prüft, ob der Gateway-Prozess online ist und zeigt die zugehörige PID an.
- `chyi logs`   : Zeigt den Live-Stream (Tail) der Gateway-Hintergrundlogs an.

---

## ⚙️ Native First-Class Tools

Das Gateway injiziert hochspezialisierte Werkzeuge in den LLM-Kontext (via System Prompt & deterministischem JSON-Schema):

1. **`brave_search`**: Integrierte Echtzeit-Websuche via Brave Search API! Ermöglicht der KI, hochaktuelle Informationen, News und Snippets abzurufen. (Ein API Key kann im Onboarding festgelegt werden).
2. **`exec`**: Führt Shell-Kommandos aus. Bietet PTY-Unterstützung (Pseudo-Terminal) und `background: true` für das asynchrone Entkoppeln von Langläufern. *(Host-Abhängig, durch Secure-by-Default geschützt).*
2. **`loop_detection`**: Algorithmische Leitplanke! Blockiert das Modell bei unendlichen Schleifen (`genericRepeat`, `knownPollNoProgress`, `pingPong`) mit harten Fehlermeldungen, um Strategiewechsel zu erzwingen.
3. **`browser_control`**: Steuert Browser via CDP (Chrome DevTools Protocol). Übermittelt token-effiziente *Accessibility Trees* statt riesiger HTML-Dokumente und unterstützt isolierte Profile (`profileId`).
4. **`web_fetch`**: Lädt Webseiten herunter, konvertiert HTML on-the-fly zu Markdown und schneidet den Text bei einem definierten Zeichenlimit (`maxChars`) ab (Context Bloat Schutz).
5. **`sessions_spawn`**: Startet dynamisch isolierte Unteragenten für parallele Sub-Tasks.
6. **`sessions_history`**: Liest den Verlauf der aktuellen Sitzung. Wird kryptografisch durch den Parameter `self: true` gesichert, um Cross-Context-Leaks zwischen kompromittierten Sub-Agenten zu unterbinden.

---

## 🧠 Dynamisches Wissensmanagement (Progressive Disclosure)

Das System lädt Domänenwissen progressiv in den Modellkontext, um Token zu sparen ("Context Bloat").
Wissen wird automatisch aus Verzeichnissen geladen und überschreibt sich nach strikter Priorität:
1. `knowledge_modules/workspace` *(Höchste Priorität)*
2. `knowledge_modules/shared`
3. `knowledge_modules/bundled` *(Kernkompetenzen)*

### Hot-Reloading
Ein File-Watcher beobachtet die Verzeichnisse und lädt geänderte Dateien automatisch zur Laufzeit neu (250ms Debounce). Der Token-Overhead der injizierten Module wird deterministisch berechnet.

### Dateiformat für Wissensmodule
Jede Datei **muss** als Markdown (`.md`) gespeichert werden und folgendes exaktes 3-stufiges Format einhalten:

1. **YAML Frontmatter** (Name und Beschreibung als einzeilige Schlüssel)
2. **JSON Metadata** (Einzeiliges JSON für Load-time Gating / Systemanforderungen)
3. **Markdown Textblock** (Instruktionen)

**Beispiel (`knowledge_modules/workspace/docker_rules.md`):**
```md
---
name: "DockerGuidelines"
description: "Regeln für den Umgang mit Containern"
---
{"requires": {"bins": ["docker"]}, "os": ["linux", "darwin"]}
---
### Docker Agenten Regeln
- Verwende niemals `--privileged`.
- Binde Container stets an das `proxy_gateway` Netzwerk.
```

*Hinweis: Wenn das Modul auf einem Windows-System ausgeführt wird oder die Binary `docker` fehlt, wird das Modul dank der JSON Metadata ("Load-time Gating") automatisch herausgefiltert und nicht in den Token-Kontext geladen.*
