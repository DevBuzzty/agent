import { config } from 'dotenv';
import { initDb, getDb } from './db';
import { TelegramAdapter } from './adapters/TelegramAdapter';
import { GatewayServer } from './core/GatewayServer';
import { LaneQueue } from './core/LaneQueue';
import { AgentRunner, ModelMessage } from './core/AgentRunner';
import { AgenticLoop } from './core/AgenticLoop';
import { ResponsePath } from './core/ResponsePath';

config();

async function bootstrap() {
  console.log("Initializing Agent Gateway Background Process...");

  // Phase 1 Initialization
  await initDb();

  // Stage 1: Channel Adapter
  const telegramToken = process.env.TELEGRAM_BOT_TOKEN || 'DUMMY_TOKEN';
  const adapter = new TelegramAdapter(telegramToken);

  // Stage 2: Gateway Server
  const gateway = new GatewayServer();

  // Stage 3: Lane Queue
  const laneQueue = new LaneQueue();

  // Stage 4: Agent Runner (Configured for a mocked OpenAI model with hard limits)
  const agentRunner = new AgentRunner({
    provider: 'openai',
    modelName: 'gpt-4',
    apiKey: process.env.OPENAI_API_KEY || 'DUMMY_API_KEY',
    maxTokens: 4000,
    coolingRateMs: 1000 // 1 req/sec limit
  });

  // Stage 6: Response Path
  const responsePath = new ResponsePath();

  // Connect the pipeline
  adapter.onMessage(async (normalizedMessage) => {
    // Stage 2: Gateway routing
    const routeContext = await gateway.route(normalizedMessage);

    // Stage 3: Enqueue task in strictly serial, FIFO lane per session
    laneQueue.enqueue(routeContext.sessionId, async () => {
      // Setup the logger for Stage 6 to store deterministic transcripts
      const stepLogger = async (entry: any) => {
        await responsePath.logTranscript(routeContext.sessionId, entry);
      };

      // Stage 5: Agentic Loop
      const agenticLoop = new AgenticLoop(agentRunner, stepLogger);

      const db = await getDb();
      // Fetch conversation history for this session as initial context
      const history = await db.all(
        `SELECT role, content FROM messages WHERE session_id = ? ORDER BY timestamp ASC`,
        [routeContext.sessionId]
      );

      const messages: ModelMessage[] = history.map(row => ({
        role: row.role as any,
        content: row.content
      }));

      console.log(`[Pipeline] Session ${routeContext.sessionId} lane starting loop.`);

      // Execute the reasoning loop
      const finalResult = await agenticLoop.start(routeContext.sessionId, messages);

      // Stage 6: Stream the result back to the user
      await responsePath.streamResponse(adapter, normalizedMessage.channelId, finalResult);

      console.log(`[Pipeline] Session ${routeContext.sessionId} lane task completed.`);
    });
  });

  // Start listening
  if (telegramToken !== 'DUMMY_TOKEN') {
    adapter.start();
  } else {
    console.warn("TELEGRAM_BOT_TOKEN not provided, running in headless mode.");
  }
}

bootstrap().catch(console.error);
