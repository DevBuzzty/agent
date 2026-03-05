"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runTerminalChat = runTerminalChat;
const inquirer_1 = __importDefault(require("inquirer"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const readline = __importStar(require("readline"));
// Direct imports to bypass index.ts pipeline and run loop locally
const AgentRunner_1 = require("../core/AgentRunner");
const AgenticLoop_1 = require("../core/AgenticLoop");
const SecretRefParser_1 = require("../security/SecretRefParser");
const PathResolver_1 = require("../security/PathResolver");
const db_1 = require("../db");
const KnowledgeManager_1 = require("../knowledge/KnowledgeManager");
async function runTerminalChat() {
    // __dirname in dist/tui is two levels down from root
    const rootDir = path_1.default.join(__dirname, '../../');
    const workspaceDir = path_1.default.join(rootDir, 'knowledge_modules/workspace');
    const personaFile = path_1.default.join(workspaceDir, 'persona.md');
    console.log("\n========================================");
    console.log("💬 CHYI Terminal Chat");
    console.log("========================================\n");
    // Bootstrap Check
    if (!fs_1.default.existsSync(personaFile)) {
        console.log("🥚 Es scheint, als würdest du den Agenten zum ersten Mal starten (Hatching).\nLass uns seine Identität festlegen!\n");
        const persona = await inquirer_1.default.prompt([
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
        if (!fs_1.default.existsSync(workspaceDir))
            fs_1.default.mkdirSync(workspaceDir, { recursive: true });
        fs_1.default.writeFileSync(personaFile, personaContent, 'utf-8');
        console.log(`\n✅ Persona '${persona.botName}' erfolgreich initialisiert und als Wissensmodul gespeichert!`);
    }
    // --- Prepare Agent Pipeline for local CLI run ---
    await (0, db_1.initDb)();
    const configParser = new SecretRefParser_1.ConfigParser();
    const configPath = path_1.default.join(__dirname, '../../config.json5');
    if (!fs_1.default.existsSync(configPath)) {
        console.log("❌ config.json5 fehlt! Führe zuerst 'chyi config' aus.");
        return;
    }
    let appConfig = configParser.parseConfig(configPath);
    const runner = new AgentRunner_1.AgentRunner({
        provider: appConfig?.llm?.provider || 'openai',
        modelName: appConfig?.llm?.model || 'gpt-4',
        apiKey: appConfig?.llm?.apiKey || 'mock',
        maxTokens: 4000,
        coolingRateMs: 1000
    });
    const pathResolver = new PathResolver_1.SecurePathResolver(path_1.default.join(rootDir, 'agent_workspace'));
    const sessionId = 'cli-terminal-session';
    // Dummy logger to hide internal JSON traces from the human chat UI
    const silentLogger = async () => { };
    // Inject the Knowledge Manager so the bot knows its newly minted Persona
    const knowledgeHierarchy = {
        bundled: path_1.default.join(rootDir, 'knowledge_modules/bundled'),
        shared_machine: path_1.default.join(rootDir, 'knowledge_modules/shared'),
        workspace: workspaceDir,
    };
    const knowledgeManager = new KnowledgeManager_1.KnowledgeManager(knowledgeHierarchy);
    await knowledgeManager.refreshModules();
    runner.setKnowledgeManager(knowledgeManager);
    const agenticLoop = new AgenticLoop_1.AgenticLoop(runner, silentLogger, pathResolver, sessionId, process.env.BRAVE_API_KEY);
    console.log("\n🚀 Chat gestartet. (Tippe 'exit' oder 'quit' zum Beenden)\n");
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    const askUser = () => {
        rl.question('\nDu: ', async (input) => {
            if (input.toLowerCase() === 'exit' || input.toLowerCase() === 'quit') {
                rl.close();
                return;
            }
            if (!input.trim()) {
                askUser();
                return;
            }
            const db = await (0, db_1.getDb)();
            const messageId = crypto_1.default.randomUUID();
            await db.run(`INSERT INTO messages (id, session_id, role, content) VALUES (?, ?, ?, ?)`, [messageId, sessionId, 'user', input]);
            process.stdout.write('Bot denkt nach... ');
            const history = await db.all(`SELECT role, content FROM messages WHERE session_id = ? ORDER BY timestamp ASC`, [sessionId]);
            const messages = history.map(row => ({ role: row.role, content: row.content }));
            try {
                const response = await agenticLoop.start(sessionId, messages);
                // clear "denkt nach..."
                process.stdout.write('\r\x1b[K');
                console.log(`Bot: ${response}`);
            }
            catch (err) {
                process.stdout.write('\r\x1b[K');
                console.log(`[Fehler] ${err.message}`);
            }
            askUser();
        });
    };
    askUser();
}
