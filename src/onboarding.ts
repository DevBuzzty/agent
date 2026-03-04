import * as readline from 'readline';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export async function runOnboarding() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const ask = (question: string): Promise<string> => {
    return new Promise((resolve) => rl.question(question, resolve));
  };

  console.log("========================================");
  console.log("🚀 CHYI CLI - Interactive Setup");
  console.log("========================================\n");

  const provider = await ask("1. Wähle den LLM Provider (openai, anthropic, gemini, ollama, moonshot, openrouter) [openai]: ");
  const chosenProvider = provider.trim() || 'openai';

  const model = await ask(`2. Wähle das Modell für ${chosenProvider} (z.B. gpt-4o, claude-3-opus-20240229) [gpt-4o]: `);
  const chosenModel = model.trim() || 'gpt-4o';

  const llmKey = await ask(`3. Gib deinen API-Schlüssel für ${chosenProvider} ein: `);
  const telegramToken = await ask("4. Gib deinen Telegram Bot Token ein (Optional, Enter zum Überspringen): ");
  const braveKey = await ask("5. Gib deinen Brave Search API Key ein (Optional für Websuche, Enter zum Überspringen): ");

  const defaultWebhookSecret = crypto.randomBytes(16).toString('hex');
  const webhookSecret = await ask(`6. Webhook Secret (Standard: ${defaultWebhookSecret}): `);
  const chosenWebhookSecret = webhookSecret.trim() || defaultWebhookSecret;

  console.log("\nGeneriere sichere Konfigurationsdateien (SecretRef Paradigma)...");

  // Generiere config.json5
  const configContent = `{
  "server": {
    "host": "127.0.0.1",
    "port": 3000
  },
  "llm": {
    "provider": "${chosenProvider}",
    "model": "${chosenModel}",
    "apiKey": {
      "type": "SecretRef",
      "method": "env",
      "value": "LLM_API_KEY"
    }
  }
}
`;
  const configPath = path.join(__dirname, '../config.json5');
  fs.writeFileSync(configPath, configContent, 'utf-8');

  // Generiere .env Datei
  let envContent = `LLM_API_KEY="${llmKey.trim()}"\n`;
  envContent += `WEBHOOK_SECRET="${chosenWebhookSecret}"\n`;
  if (telegramToken.trim()) envContent += `TELEGRAM_BOT_TOKEN="${telegramToken.trim()}"\n`;
  if (braveKey.trim()) envContent += `BRAVE_API_KEY="${braveKey.trim()}"\n`;

  const envPath = path.join(__dirname, '../.env');
  fs.writeFileSync(envPath, envContent, 'utf-8');

  console.log("\n✅ Setup abgeschlossen!");
  console.log(`- Konfiguration gespeichert in: ${configPath}`);
  console.log(`- API Keys sicher ausgelagert in: ${envPath}`);
  console.log("\nDu kannst den Gateway-Server nun starten mit: chyi start");

  rl.close();
}

// Fallback execution if run directly
if (require.main === module) {
  runOnboarding().catch(console.error);
}
