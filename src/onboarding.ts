import inquirer from 'inquirer';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { config as loadDotenv } from 'dotenv';

export async function runOnboarding() {
  console.log("========================================");
  console.log("🚀 CHYI CLI - Interactive Configuration");
  console.log("========================================\n");

  const { mode } = await inquirer.prompt([
    {
      type: 'list',
      name: 'mode',
      message: 'Was möchtest du tun?',
      choices: [
        { name: '✨ Neues Setup / Konfiguration ändern', value: 'setup' },
        { name: '⚠️  System Reset / Wipe', value: 'reset' }
      ]
    }
  ]);

  if (mode === 'reset') {
      const { runResetWizard } = await import('./tui/resetWizard');
      await runResetWizard();
      return;
  }

  const step1 = await inquirer.prompt([
    {
      type: 'list',
      name: 'provider',
      message: '1. Wähle den LLM Provider:',
      choices: ['openai', 'anthropic', 'gemini', 'ollama', 'moonshot', 'openrouter'],
      default: 'openai'
    }
  ]);

  const provider = step1.provider;

  // Pre-configured models per provider
  const modelChoices: Record<string, string[]> = {
      'openai': ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo', 'Custom...'],
      'anthropic': ['claude-3-5-sonnet-20240620', 'claude-3-opus-20240229', 'claude-3-haiku-20240307', 'Custom...'],
      'gemini': ['gemini-1.5-pro-latest', 'gemini-1.5-flash-latest', 'gemini-pro', 'Custom...'],
      'moonshot': ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k', 'Custom...'],
      'ollama': ['llama3', 'mistral', 'phi3', 'Custom...'],
      'openrouter': ['anthropic/claude-3-opus', 'meta-llama/llama-3-70b-instruct', 'Custom...']
  };

  const step2 = await inquirer.prompt([
    {
      type: 'list',
      name: 'modelSelection',
      message: `2. Wähle das Modell für ${provider}:`,
      choices: modelChoices[provider] || ['Custom...']
    }
  ]);

  let model = step2.modelSelection;
  if (model === 'Custom...') {
      const step2Custom = await inquirer.prompt([
          {
              type: 'input',
              name: 'customModel',
              message: 'Bitte gib den exakten Namen des Modells ein:'
          }
      ]);
      model = step2Custom.customModel.trim();
  }

  const answers = await inquirer.prompt([
    {
      type: 'password',
      name: 'llmKey',
      message: `3. Gib deinen API-Schlüssel für ${provider} ein:`,
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
    "provider": "${provider}",
    "model": "${model}",
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

  // CRITICAL: Reload the environment variables into the current Node process memory
  // so the immediate "Hatch" local chat does not fail with "Environment variable not found".
  loadDotenv({ path: envPath, override: true });

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
