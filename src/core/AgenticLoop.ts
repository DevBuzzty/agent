import { AgentRunner, ModelMessage, RunnerResponse } from './AgentRunner';
import { getDb } from '../db';
import { randomUUID } from 'crypto';
import { SecurePathResolver } from '../security/PathResolver';

// Tools
import { FirstClassTool } from '../tools/FirstClassTool';
import { ExecTool } from '../tools/ExecTool';
import { BrowserTool } from '../tools/BrowserTool';
import { WebFetchTool } from '../tools/WebFetchTool';
import { SessionsSpawnTool } from '../tools/SessionsSpawnTool';
import { SessionsHistoryTool } from '../tools/SessionsHistoryTool';
import { LoopDetectionTool } from '../tools/LoopDetectionTool';
import { BraveSearchTool } from '../tools/BraveSearchTool';
import { LoopDetector } from './LoopDetector';

export interface ToolResult {
  tool_call_id: string;
  result: string;
}

export type StepLogger = (logEntry: any) => Promise<void>;

export class AgenticLoop {
  private runner: AgentRunner;
  private toolsMap: Record<string, FirstClassTool> = {};
  private stepLogger: StepLogger;
  private loopDetector: LoopDetector;

  constructor(runner: AgentRunner, stepLogger: StepLogger, pathResolver: SecurePathResolver, sessionId: string, braveApiKey?: string, sandboxId?: string) {
    this.runner = runner;
    this.stepLogger = stepLogger;
    this.loopDetector = new LoopDetector();

    // Register native First-Class Tools
    const toolsList: FirstClassTool[] = [
        new ExecTool(sandboxId),
        new BrowserTool(),
        new WebFetchTool(),
        new SessionsSpawnTool(),
        new SessionsHistoryTool(sessionId),
        new LoopDetectionTool(this.loopDetector),
        new BraveSearchTool(braveApiKey || 'DUMMY_KEY')
    ];

    for (const tool of toolsList) {
        this.toolsMap[tool.name] = tool;
    }

    this.runner.registerTools(toolsList);
  }

  async start(sessionId: string, initialMessages: ModelMessage[]): Promise<string> {
    const db = await getDb();
    let currentMessages = [...initialMessages];
    let iteration = 0;
    const maxIterations = 15;

    while (iteration < maxIterations) {
      iteration++;

      await this.stepLogger({ type: 'reasoning_start', iteration, messages: currentMessages });

      const response: RunnerResponse = await this.runner.run(currentMessages);
      await this.stepLogger({ type: 'model_response', iteration, response });

      const assistantMsg: ModelMessage = {
        role: 'assistant',
        content: response.text,
        tool_calls: response.toolCalls.length > 0 ? response.toolCalls : undefined
      };

      currentMessages.push(assistantMsg);
      this.loopDetector.recordMessage(assistantMsg);

      if (response.finishReason === 'tool_calls' && response.toolCalls.length > 0) {

        const guardrailError = this.loopDetector.evaluate(response.toolCalls);
        if (guardrailError) {
             console.warn(`[Guardrail Triggered]: ${guardrailError}`);
             currentMessages.push({
                 role: 'system',
                 content: guardrailError
             });
             continue;
        }

        for (const call of response.toolCalls) {
          const tool = this.toolsMap[call.name];
          let resultStr = '';

          if (tool) {
            await this.stepLogger({ type: 'tool_execution_start', tool: call.name, args: call.args });
            resultStr = await tool.execute(call.args);
            await this.stepLogger({ type: 'tool_execution_end', tool: call.name, result: resultStr });
          } else {
            resultStr = `Tool ${call.name} not found.`;
          }

          const toolMsg: ModelMessage = {
            role: 'tool',
            content: resultStr,
            tool_call_id: call.id
          };

          currentMessages.push(toolMsg);
          this.loopDetector.recordMessage(toolMsg);
        }
      } else if (response.finishReason === 'stop' || response.finishReason === 'length') {
        await this.stepLogger({ type: 'reasoning_end', iteration, finalResponse: response.text });

        const messageId = randomUUID();
        await db.run(
          `INSERT INTO messages (id, session_id, role, content) VALUES (?, ?, ?, ?)`,
          [messageId, sessionId, 'assistant', response.text]
        );

        return response.text;
      }
    }

    return "Agent loop reached maximum iterations.";
  }
}
