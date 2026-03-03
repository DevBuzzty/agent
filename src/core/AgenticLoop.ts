import { AgentRunner, ModelMessage, RunnerResponse } from './AgentRunner';
import { CalculatorTool } from '../tools/Calculator';
import { createFileReaderTool } from '../tools/FileReader';
import { getDb } from '../db';
import { randomUUID } from 'crypto';
import { SecurePathResolver } from '../security/PathResolver';

export interface ToolResult {
  tool_call_id: string;
  result: string;
}

export type StepLogger = (logEntry: any) => Promise<void>;

/**
 * ReAct (Reasoning and Acting) Zyklus.
 * Iteriert so lange, bis das Modell entscheidet, zu stoppen ("stop").
 * Ergebnisse von Tools werden als Evidenz ins Kontextfenster zurückgespeist.
 */
export class AgenticLoop {
  private runner: AgentRunner;
  private tools: Record<string, any>;
  private stepLogger: StepLogger;

  constructor(runner: AgentRunner, stepLogger: StepLogger, pathResolver: SecurePathResolver) {
    this.runner = runner;
    this.stepLogger = stepLogger;

    const fileReader = createFileReaderTool(pathResolver);

    this.tools = {
      [CalculatorTool.name]: CalculatorTool,
      [fileReader.name]: fileReader
    };
  }

  async start(sessionId: string, initialMessages: ModelMessage[]): Promise<string> {
    const db = await getDb();
    let currentMessages = [...initialMessages];
    let iteration = 0;
    const maxIterations = 10; // Hard limit to prevent infinite loops

    while (iteration < maxIterations) {
      iteration++;

      // Log the current reasoning state for replayability
      await this.stepLogger({ type: 'reasoning_start', iteration, messages: currentMessages });

      // Run the model (Stage 4)
      const response: RunnerResponse = await this.runner.run(currentMessages);

      // Log the model's raw response
      await this.stepLogger({ type: 'model_response', iteration, response });

      if (response.text) {
        currentMessages.push({ role: 'assistant', content: response.text });
      }

      // If the model called tools, execute them
      if (response.finishReason === 'tool_calls' && response.toolCalls.length > 0) {
        for (const call of response.toolCalls) {
          const tool = this.tools[call.name];
          let resultStr = '';

          if (tool) {
            await this.stepLogger({ type: 'tool_execution_start', tool: call.name, args: call.args });
            resultStr = await tool.execute(call.args);
            await this.stepLogger({ type: 'tool_execution_end', tool: call.name, result: resultStr });
          } else {
            resultStr = `Tool ${call.name} not found.`;
          }

          // Feed result back into the model context as evidence
          currentMessages.push({
            role: 'tool',
            content: resultStr,
            tool_call_id: call.id
          });
        }
      } else if (response.finishReason === 'stop' || response.finishReason === 'length') {
        // Log final thought process
        await this.stepLogger({ type: 'reasoning_end', iteration, finalResponse: response.text });

        // Persist final assistant message
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
