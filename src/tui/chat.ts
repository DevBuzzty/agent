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
    coolingRateMs: 1000
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

  console.log(clc.bold.cyan("\n🚀 Chat gestartet. (Tippe 'exit' oder 'quit' zum Beenden)"));
  console.log(clc.blackBright("------------------------------------------------------------\n"));

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  // Native dynamic spinner
  let spinnerInterval: NodeJS.Timeout;
  const startSpinner = () => {
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let i = 0;
    spinnerInterval = setInterval(() => {
      process.stdout.write(`\r${clc.magenta(frames[i])} ${clc.italic('Agent denkt nach...')} `);
      i = (i + 1) % frames.length;
    }, 80);
  };

  const stopSpinner = () => {
    clearInterval(spinnerInterval);
    process.stdout.write('\r\x1b[K'); // clear the line
  };

  const askUser = () => {
    // Print user prompt with color separation
    rl.question(clc.cyan.bold('Du: '), async (input) => {
      if (input.toLowerCase() === 'exit' || input.toLowerCase() === 'quit') {
        rl.close();
        return;
      }

      if (!input.trim()) {
          askUser();
          return;
      }

      const db = await getDb();
      const messageId = crypto.randomUUID();
      await db.run(
        `INSERT INTO messages (id, session_id, role, content) VALUES (?, ?, ?, ?)`,
        [messageId, sessionId, 'user', input]
      );

      startSpinner();

      const history = await db.all(
        `SELECT role, content FROM messages WHERE session_id = ? ORDER BY timestamp ASC`,
        [sessionId]
      );

      const messages = history.map(row => ({ role: row.role as any, content: row.content }));

      try {
          const response = await agenticLoop.start(sessionId, messages);
          stopSpinner();

          console.log(clc.magenta.bold('\nAgent: ') + response);
          console.log(clc.blackBright("------------------------------------------------------------\n"));
      } catch (err: any) {
          stopSpinner();
          console.log(clc.red.bold(`\n[Fehler] `) + err.message);
          console.log(clc.blackBright("------------------------------------------------------------\n"));
      }

      askUser();
    });
  };

  askUser();
}
