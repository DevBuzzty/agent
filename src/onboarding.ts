import inquirer from 'inquirer';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export async function runOnboarding() {
  console.log("========================================");
  console.log("🚀 CHYI CLI - Interactive Configuration");
  console.log("========================================\n");

  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'provider',
      message: '1. Wähle den LLM Provider:',
      choices: ['openai', 'anthropic', 'gemini', 'ollama', 'moonshot', 'openrouter'],
      default: 'openai'
    },
    {
      type: 'input',
      name: 'model',
      message: '2. Wähle das Modell (z.B. gpt-4o, claude-3-opus-20240229):',
      default: 'gpt-4o'
    },
    {
      type: 'password',
      name: 'llmKey',
      message: '3. Gib deinen API-Schlüssel für den Provider ein:',
      mask: '*'
    },
    {
      type: 'password',
      name: 'telegramToken',
      message: '4. Gib deinen Telegram Bot Token ein (Leer lassen zum Überspringen):',
      mask: '*'
    },
    {
      type: 'password',
      name: 'braveKey',
      message: '5. Gib deinen Brave Search API Key ein (Leer lassen zum Überspringen):',
      mask: '*'
    }
  ]);

  const defaultWebhookSecret = crypto.randomBytes(16).toString('hex');
  const advanced = await inquirer.prompt([
    {
        type: 'input',
        name: 'webhookSecret',
        message: `6. Webhook Secret (Enter für Zufall: ${defaultWebhookSecret}):`,
        default: defaultWebhookSecret
    }
  ]);

  console.log("\nGeneriere sichere Konfigurationsdateien (SecretRef Paradigma)...");

  const configContent = `{
  "server": {
    "host": "127.0.0.1",
    "port": 3000
  },
  "llm": {
    "provider": "${answers.provider}",
    "model": "${answers.model}",
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

  let envContent = `LLM_API_KEY="${answers.llmKey.trim()}"\n`;
  envContent += `WEBHOOK_SECRET="${advanced.webhookSecret.trim()}"\n`;
  if (answers.telegramToken.trim()) envContent += `TELEGRAM_BOT_TOKEN="${answers.telegramToken.trim()}"\n`;
  if (answers.braveKey.trim()) envContent += `BRAVE_API_KEY="${answers.braveKey.trim()}"\n`;

  const envPath = path.join(__dirname, '../.env');
  fs.writeFileSync(envPath, envContent, 'utf-8');

  console.log("\n✅ Setup abgeschlossen!");
  console.log(`- Konfiguration gespeichert in: ${configPath}`);
  console.log(`- API Keys sicher ausgelagert in: ${envPath}`);

  const nextStep = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'hatch',
      message: 'Möchtest du den Agenten jetzt in einem Terminal-Chat initialisieren (Hatch)?',
      default: true
    }
  ]);

  if (nextStep.hatch) {
     const { runTerminalChat } = await import('./tui/chat');
     await runTerminalChat();
  } else {
     console.log("\nDu kannst den Gateway-Server jederzeit starten mit: chyi start");
  }
}

if (require.main === module) {
  runOnboarding().catch(console.error);
}
