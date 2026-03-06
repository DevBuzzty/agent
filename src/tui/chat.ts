import inquirer from 'inquirer';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import * as readline from 'readline';

// Direct imports to bypass index.ts pipeline and run loop locally
import { AgentRunner } from '../core/AgentRunner';
import { AgenticLoop } from '../core/AgenticLoop';
import { ConfigParser } from '../security/SecretRefParser';
import { SecurePathResolver } from '../security/PathResolver';
import { initDb, getDb } from '../db';
import { KnowledgeManager } from '../knowledge/KnowledgeManager';

function formatMarkdownForTerminal(text: string, clc: any): string {
  if (!text) return "";

  let formatted = text;

  // Headers (### Header)
  formatted = formatted.replace(/^(#{1,6})\s+(.+)$/gm, (match, hashes, content) => {
      return clc.bold.underline.blueBright(content);
  });

  // Bold (**text**)
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, (match, content) => {
      return clc.bold.white(content);
  });

  // Italic (*text* or _text_)
  formatted = formatted.replace(/(?<!\w)([*_])(.*?)\1(?!\w)/g, (match, symbol, content) => {
      return clc.italic(content);
  });

  // Inline Code (`code`)
  formatted = formatted.replace(/`([^`]+)`/g, (match, content) => {
      return clc.bgBlack.whiteBright(` ${content} `);
  });

  // Simple bullet points adjustments
  formatted = formatted.replace(/^(\s*)-\s+/gm, `$1${clc.cyan('•')} `);
  formatted = formatted.replace(/^(\s*)\*\s+/gm, `$1${clc.cyan('•')} `);

  return formatted;
}

function applyBotMessageStyle(text: string, clc: any): string {
  // Apply a subtle gray background to the entire bot message block.
  // We process it line by line to ensure the background stretches correctly
  // and add a small left-padding for a "bubble" effect.
  return text.split('\n').map(line => {
      // bgBlackBright or bgBlack creates a subtle gray background on most terminals
      return clc.bgBlack(` ${line} `);
  }).join('\n');
}

export async function runTerminalChat() {
  // __dirname in dist/tui is two levels down from root
  const rootDir = path.join(__dirname, '../../');
  const workspaceDir = path.join(rootDir, 'knowledge_modules/workspace');
  const personaFile = path.join(workspaceDir, 'persona.md');

  console.log("\n========================================");
  console.log("💬 CHYI Terminal Chat");
  console.log("========================================\n");

  // Bootstrap Check
  if (!fs.existsSync(personaFile)) {
    console.log("🥚 Es scheint, als würdest du den Agenten zum ersten Mal starten (Hatching).\nLass uns seine Identität festlegen!\n");
    const persona = await inquirer.prompt([
      { type: 'input', name: 'botName', message: '1. Wie soll dein KI-Agent heißen?' },
      { type: 'input', name: 'userName', message: '2. Wie lautet dein Name (damit der Bot dich kennt)?' },
      { type: 'input', name: 'mission', message: '3. Was ist die Hauptaufgabe/Mission dieses Agenten?' },
      { type: 'input', name: 'tone', message: '4. Wie soll der Bot sich verhalten? (z.B. professionell, sarkastisch, kurz angebunden):' }
    ]);

    const personaContent = `---
name: "CorePersona"
description: "Identität und Verhaltensregeln des Agenten"
---
{}
---
Du bist eine KI namens **${persona.botName}**.
Du sprichst mit deinem Erschaffer/Nutzer namens **${persona.userName}**.

Deine Hauptmission ist: ${persona.mission}.

Dein Verhaltenskodex / Tonfall:
${persona.tone}

Halte dich unter allen Umständen an diese Persona.
`;

    if (!fs.existsSync(workspaceDir)) fs.mkdirSync(workspaceDir, { recursive: true });
    fs.writeFileSync(personaFile, personaContent, 'utf-8');
    console.log(`\n✅ Persona '${persona.botName}' erfolgreich initialisiert und als Wissensmodul gespeichert!`);
  }

  // --- Prepare Agent Pipeline for local CLI run ---
  await initDb();
  const configParser = new ConfigParser();
  const configPath = path.join(__dirname, '../../config.json5');
  if (!fs.existsSync(configPath)) {
      console.log("❌ config.json5 fehlt! Führe zuerst 'chyi config' aus.");
      return;
  }
  let appConfig = configParser.parseConfig(configPath);

  const runner = new AgentRunner({
    provider: appConfig?.llm?.provider || 'openai',
    modelName: appConfig?.llm?.model || 'gpt-4',
    apiKey: appConfig?.llm?.apiKey || 'mock',
    maxTokens: 4000,
    coolingRateMs: 1000,
    silent: true // Mute internal execution logs
  });

  const pathResolver = new SecurePathResolver(path.join(rootDir, 'agent_workspace'));
  const sessionId = 'cli-terminal-session';

  // Dummy logger to hide internal JSON traces from the human chat UI
  const silentLogger = async () => {};

  // Inject the Knowledge Manager so the bot knows its newly minted Persona
  const knowledgeHierarchy = {
      bundled: path.join(rootDir, 'knowledge_modules/bundled'),
      shared_machine: path.join(rootDir, 'knowledge_modules/shared'),
      workspace: workspaceDir,
  };
  const knowledgeManager = new KnowledgeManager(knowledgeHierarchy);
  await knowledgeManager.refreshModules();
  runner.setKnowledgeManager(knowledgeManager);

  const agenticLoop = new AgenticLoop(runner, silentLogger, pathResolver, sessionId, process.env.BRAVE_API_KEY);

  const clc = require('cli-color');

  console.log(clc.bold.cyan("\n🚀 Chat gestartet. (Tippe 'exit' oder '/exit' zum Beenden)"));
  console.log(clc.italic.green("ℹ️  Tipp: Beginne eine Nachricht mit '/', um lokale Terminal- oder chyi-Befehle direkt auszuführen (z.B. '/ls -la' oder '/chyi status')."));
  console.log(clc.blackBright("------------------------------------------------------------\n"));

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: clc.white.bold('Du: ')
  });

  // Chat Redraw Logic to maintain a static input bar at the bottom
  const renderLog = (text: string) => {
    // Clear current line (the prompt), move cursor up if needed, print log, and redraw prompt
    process.stdout.write('\r\x1b[K');
    console.log(text);
    rl.prompt(true);
  };

  // Native dynamic spinner
  let spinnerInterval: NodeJS.Timeout;
  const startSpinner = () => {
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let i = 0;
    spinnerInterval = setInterval(() => {
      process.stdout.write(`\r\x1b[K${clc.blueBright(frames[i])} ${clc.italic('Agent denkt nach...')} `);
      i = (i + 1) % frames.length;
    }, 80);
  };

  const stopSpinner = () => {
    clearInterval(spinnerInterval);
    process.stdout.write('\r\x1b[K'); // clear the spinner line
  };

  rl.prompt();

  rl.on('line', async (input) => {
      if (input.toLowerCase() === 'exit' || input.toLowerCase() === 'quit' || input.toLowerCase() === '/exit') {
        rl.close();
        console.log(clc.yellow("\nChat beendet. Das Gateway läuft (sofern gestartet) im Hintergrund weiter.\n"));
        return;
      }

      if (!input.trim()) {
          rl.prompt();
          return;
      }

      // Handle Slash Commands (Local System Execution)
      if (input.startsWith('/')) {
        const cmd = input.slice(1).trim();
        if (cmd) {
            renderLog(clc.blackBright("--- Lokale Ausführung ---"));
            try {
                const { execSync } = require('child_process');
                // Capture output to render it cleanly above the prompt
                const out = execSync(cmd, { encoding: 'utf8' });
                renderLog(out);
            } catch (err: any) {
                renderLog(clc.red(`Befehl fehlgeschlagen: ${err.message}`));
            }
            renderLog(clc.blackBright("-------------------------"));
        }
        return; // Prompt is redrawn by renderLog
      }

      const db = await getDb();
      const messageId = crypto.randomUUID();
      await db.run(
        `INSERT INTO messages (id, session_id, role, content) VALUES (?, ?, ?, ?)`,
        [messageId, sessionId, 'user', input]
      );

      // Move cursor up to visually lock the input history, but we don't need to do complex redraws.
      // readline handles the basic scroll, but we freeze the prompt while thinking.
      rl.pause();
      startSpinner();

      const history = await db.all(
        `SELECT role, content FROM messages WHERE session_id = ? ORDER BY timestamp ASC`,
        [sessionId]
      );

      const messages = history.map(row => ({ role: row.role as any, content: row.content }));

      try {
          const response = await agenticLoop.start(sessionId, messages);
          stopSpinner();

          let formattedResponse = formatMarkdownForTerminal(response, clc);
          formattedResponse = applyBotMessageStyle(formattedResponse, clc);

          console.log(clc.blueBright.bold('\nAgent:\n') + formattedResponse + '\n');
          console.log(clc.blackBright("------------------------------------------------------------\n"));
      } catch (err: any) {
          stopSpinner();
          console.log(clc.red.bold(`\n[Fehler] `) + err.message);
          console.log(clc.blackBright("------------------------------------------------------------\n"));
      }

      rl.resume();
      rl.prompt();
  });
}
