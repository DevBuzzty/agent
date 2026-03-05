"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = require("dotenv");
const db_1 = require("./db");
const TelegramAdapter_1 = require("./adapters/TelegramAdapter");
const GatewayServer_1 = require("./core/GatewayServer");
const LaneQueue_1 = require("./core/LaneQueue");
const AgentRunner_1 = require("./core/AgentRunner");
const AgenticLoop_1 = require("./core/AgenticLoop");
const ResponsePath_1 = require("./core/ResponsePath");
// Security Modules
const SecurityManager_1 = require("./security/SecurityManager");
const SecretRefParser_1 = require("./security/SecretRefParser");
const PathResolver_1 = require("./security/PathResolver");
const HttpRouter_1 = require("./server/HttpRouter");
const DockerSandboxManager_1 = require("./security/DockerSandboxManager");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// Knowledge Modules
const KnowledgeManager_1 = require("./knowledge/KnowledgeManager");
const KnowledgeWatcher_1 = require("./knowledge/KnowledgeWatcher");
(0, dotenv_1.config)();
async function bootstrap() {
    console.log("Initializing Secure AI Gateway Background Process...");
    const configParser = new SecretRefParser_1.ConfigParser();
    const configPath = path_1.default.join(__dirname, '../config.json5');
    if (!fs_1.default.existsSync(configPath)) {
        console.error("Config file missing.");
    }
    let appConfig;
    try {
        appConfig = configParser.parseConfig(configPath);
        console.log("[Security] Configuration parsed successfully following SecretRef Paradigm.");
    }
    catch (error) {
        console.error(`[Security] Configuration Error: ${error.message}`);
        process.exit(1);
    }
    if (!SecurityManager_1.globalSecurityManager.canAccessFileSystem()) {
        console.log("[Security] Policy Enforced: Agent FileSystem access DENIED by default.");
    }
    await (0, db_1.initDb)();
    const safeWorkspaceDir = path_1.default.join(__dirname, '../agent_workspace');
    const pathResolver = new PathResolver_1.SecurePathResolver(safeWorkspaceDir);
    // Phase 4: Knowledge Management Setup
    // Note: __dirname is dist/, so we go up one level to root.
    const knowledgeHierarchy = {
        bundled: path_1.default.join(__dirname, '../knowledge_modules/bundled'),
        shared_machine: path_1.default.join(__dirname, '../knowledge_modules/shared'),
        workspace: path_1.default.join(__dirname, '../knowledge_modules/workspace'),
    };
    Object.values(knowledgeHierarchy).forEach(dir => {
        if (!fs_1.default.existsSync(dir))
            fs_1.default.mkdirSync(dir, { recursive: true });
    });
    const knowledgeManager = new KnowledgeManager_1.KnowledgeManager(knowledgeHierarchy);
    await knowledgeManager.refreshModules();
    const knowledgeWatcher = new KnowledgeWatcher_1.KnowledgeWatcher(knowledgeManager, Object.values(knowledgeHierarchy));
    knowledgeWatcher.watch();
    const sandboxManager = new DockerSandboxManager_1.DockerSandboxManager();
    const sandboxId = sandboxManager.spawnSandbox({
        imageName: "agent-runner:latest",
        allowHostLocalhost: true,
        gatewayName: "primary-gateway"
    }, {
        OPENAI_API_KEY: appConfig?.llm?.apiKey || 'DUMMY_KEY'
    });
    const telegramToken = process.env.TELEGRAM_BOT_TOKEN || 'DUMMY_TOKEN';
    const adapter = new TelegramAdapter_1.TelegramAdapter(telegramToken);
    const gateway = new GatewayServer_1.GatewayServer();
    const laneQueue = new LaneQueue_1.LaneQueue();
    const agentRunner = new AgentRunner_1.AgentRunner({
        provider: appConfig?.llm?.provider || 'openai',
        modelName: appConfig?.llm?.model || 'gpt-4',
        apiKey: appConfig?.llm?.apiKey || 'DUMMY_KEY',
        maxTokens: 4000,
        coolingRateMs: 1000
    });
    agentRunner.setKnowledgeManager(knowledgeManager);
    const responsePath = new ResponsePath_1.ResponsePath();
    // Core Pipeline Execution Logic
    const processPipeline = async (normalizedMessage) => {
        const routeContext = await gateway.route(normalizedMessage);
        laneQueue.enqueue(routeContext.sessionId, async () => {
            const stepLogger = async (entry) => {
                await responsePath.logTranscript(routeContext.sessionId, entry);
            };
            const braveApiKey = process.env.BRAVE_API_KEY;
            const agenticLoop = new AgenticLoop_1.AgenticLoop(agentRunner, stepLogger, pathResolver, routeContext.sessionId, braveApiKey, sandboxId);
            const db = await (0, db_1.getDb)();
            const history = await db.all(`SELECT role, content FROM messages WHERE session_id = ? ORDER BY timestamp ASC`, [routeContext.sessionId]);
            const messages = history.map(row => ({
                role: row.role,
                content: row.content
            }));
            console.log(`[Pipeline] Session ${routeContext.sessionId} lane starting loop.`);
            const finalResult = await agenticLoop.start(routeContext.sessionId, messages);
            await responsePath.streamResponse(adapter, normalizedMessage.channelId, finalResult);
            console.log(`[Pipeline] Session ${routeContext.sessionId} lane task completed.`);
        });
    };
    // Wire Telegram polling
    adapter.onMessage(processPipeline);
    // Wire explicit HTTP Routing and Pre-Authentication Webhooks
    const webhookSecret = process.env.WEBHOOK_SECRET || 'fallback_dev_secret';
    const router = new HttpRouter_1.SecureRouter(webhookSecret);
    router.registerRoute({
        method: 'POST',
        path: '/api/telegram/webhook',
        match: /^\/api\/telegram\/webhook$/,
        auth: 'signature',
        handler: async (req, res, body) => {
            console.log("[Router] Webhook received securely. Pushing to Lane Queue.");
            res.writeHead(200);
            res.end('OK');
            // Construct a normalized message from the verified webhook body
            if (body && body.message) {
                const msg = body.message;
                const normalized = {
                    id: String(msg.message_id || Date.now()),
                    source: 'webhook',
                    channelId: String(msg.chat?.id || 'unknown'),
                    authToken: String(msg.from?.id || 'unknown'),
                    text: msg.text || '',
                    mediaAttachments: [],
                    timestamp: msg.date ? msg.date * 1000 : Date.now()
                };
                await processPipeline(normalized);
            }
        }
    });
    const port = appConfig?.server?.port || 3000;
    router.listen(port);
    if (telegramToken !== 'DUMMY_TOKEN') {
        adapter.start();
    }
    else {
        console.warn("TELEGRAM_BOT_TOKEN not provided, running in headless mode.");
    }
}
bootstrap().catch(console.error);
