import { config } from 'dotenv';
import { initDb, getDb } from './db';
import { TelegramAdapter } from './adapters/TelegramAdapter';
import { GatewayServer } from './core/GatewayServer';
import { LaneQueue } from './core/LaneQueue';
import { AgentRunner, ModelMessage } from './core/AgentRunner';
import { AgenticLoop } from './core/AgenticLoop';
import { ResponsePath } from './core/ResponsePath';

// Security Modules
import { globalSecurityManager } from './security/SecurityManager';
import { ConfigParser } from './security/SecretRefParser';
import { SecurePathResolver } from './security/PathResolver';
import { SecureRouter } from './server/HttpRouter';
import { DockerSandboxManager } from './security/DockerSandboxManager';
import path from 'path';
import fs from 'fs';

config();

async function bootstrap() {
  console.log("Initializing Secure AI Gateway Background Process...");

  const configParser = new ConfigParser();
  const configPath = path.join(__dirname, '../config.json5');

  if (!fs.existsSync(configPath)) {
    console.error("Config file missing.");
  }

  let appConfig: any;
  try {
    appConfig = configParser.parseConfig(configPath);
    console.log("[Security] Configuration parsed successfully following SecretRef Paradigm.");
  } catch (error: any) {
    console.error(`[Security] Configuration Error: ${error.message}`);
    process.exit(1);
  }

  if (!globalSecurityManager.canAccessFileSystem()) {
    console.log("[Security] Policy Enforced: Agent FileSystem access DENIED by default.");
  }

  await initDb();

  const safeWorkspaceDir = path.join(__dirname, '../agent_workspace');
  const pathResolver = new SecurePathResolver(safeWorkspaceDir);

  const webhookSecret = process.env.WEBHOOK_SECRET || 'fallback_dev_secret';
  const router = new SecureRouter(webhookSecret);

  router.registerRoute({
    method: 'POST',
    path: '/api/telegram/webhook',
    match: /^\/api\/telegram\/webhook$/,
    auth: 'signature',
    handler: async (req, res, body) => {
      console.log("[Router] Webhook received securely.");
      res.writeHead(200);
      res.end('OK');
    }
  });

  const port = appConfig?.server?.port || 3000;
  router.listen(port);

  const sandboxManager = new DockerSandboxManager();
  const sandboxId = sandboxManager.spawnSandbox({
    imageName: "agent-runner:latest",
    allowHostLocalhost: true,
    gatewayName: "primary-gateway"
  }, {
    OPENAI_API_KEY: appConfig?.llm?.apiKey || 'DUMMY_KEY'
  });

  const telegramToken = process.env.TELEGRAM_BOT_TOKEN || 'DUMMY_TOKEN';
  const adapter = new TelegramAdapter(telegramToken);
  const gateway = new GatewayServer();
  const laneQueue = new LaneQueue();

  const agentRunner = new AgentRunner({
    provider: appConfig?.llm?.provider || 'openai',
    modelName: appConfig?.llm?.model || 'gpt-4',
    apiKey: appConfig?.llm?.apiKey || 'DUMMY_KEY',
    maxTokens: 4000,
    coolingRateMs: 1000
  });

  const responsePath = new ResponsePath();

  adapter.onMessage(async (normalizedMessage) => {
    const routeContext = await gateway.route(normalizedMessage);

    laneQueue.enqueue(routeContext.sessionId, async () => {
      const stepLogger = async (entry: any) => {
        await responsePath.logTranscript(routeContext.sessionId, entry);
      };

      // Pass sessionId correctly to match the updated AgenticLoop signature
      const agenticLoop = new AgenticLoop(agentRunner, stepLogger, pathResolver, routeContext.sessionId);

      const db = await getDb();
      const history = await db.all(
        `SELECT role, content FROM messages WHERE session_id = ? ORDER BY timestamp ASC`,
        [routeContext.sessionId]
      );

      const messages: ModelMessage[] = history.map(row => ({
        role: row.role as any,
        content: row.content
      }));

      console.log(`[Pipeline] Session ${routeContext.sessionId} lane starting loop.`);

      const finalResult = await agenticLoop.start(routeContext.sessionId, messages);

      await responsePath.streamResponse(adapter, normalizedMessage.channelId, finalResult);

      console.log(`[Pipeline] Session ${routeContext.sessionId} lane task completed.`);
    });
  });

  if (telegramToken !== 'DUMMY_TOKEN') {
    adapter.start();
  } else {
    console.warn("TELEGRAM_BOT_TOKEN not provided, running in headless mode.");
  }
}

bootstrap().catch(console.error);
