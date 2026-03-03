import { getDb } from '../db';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'moonshot' | 'openrouter';
  modelName: string;
  apiKey: string;
  maxTokens: number; // hard token truncation limit
  coolingRateMs: number; // rate limit cooling
}

export interface ModelMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
}

export interface RunnerResponse {
  text: string;
  toolCalls: Array<{ id: string, name: string, args: Record<string, any> }>;
  finishReason: 'stop' | 'tool_calls' | 'length';
}

export class AgentRunner {
  private config: LLMConfig;
  private lastCallTime: number = 0;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  private async applyCooling(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastCallTime;
    if (elapsed < this.config.coolingRateMs) {
      const waitTime = this.config.coolingRateMs - elapsed;
      console.log(`[AgentRunner] Rate limit cooling for ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    this.lastCallTime = Date.now();
  }

  private applyContextWindowManagement(messages: ModelMessage[]): ModelMessage[] {
    const maxChars = this.config.maxTokens * 4;
    let currentChars = 0;
    const truncatedMessages: ModelMessage[] = [];

    const systemMessage = messages.find(m => m.role === 'system');
    if (systemMessage) {
      currentChars += systemMessage.content.length;
      truncatedMessages.push(systemMessage);
    }

    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.role === 'system') continue;

      if (currentChars + msg.content.length <= maxChars) {
        currentChars += msg.content.length;
        truncatedMessages.unshift(msg);
      } else {
        console.warn(`[AgentRunner] Context window full. Truncating history.`);
        break;
      }
    }

    return truncatedMessages;
  }

  async run(messages: ModelMessage[]): Promise<RunnerResponse> {
    await this.applyCooling();
    const contextMessages = this.applyContextWindowManagement(messages);

    console.log(`[AgentRunner] Running model ${this.config.provider}:${this.config.modelName}`);

    if (this.config.provider === 'openai' || this.config.provider === 'moonshot' || this.config.provider === 'openrouter' || this.config.provider === 'ollama') {
      return this.runOpenAICompatible(contextMessages);
    } else if (this.config.provider === 'anthropic') {
      return this.runAnthropic(contextMessages);
    } else if (this.config.provider === 'gemini') {
      return this.runGemini(contextMessages);
    }

    throw new Error(`Unsupported provider: ${this.config.provider}`);
  }

  private async runOpenAICompatible(messages: ModelMessage[]): Promise<RunnerResponse> {
    const baseURLs: Record<string, string> = {
      'openai': 'https://api.openai.com/v1',
      'moonshot': 'https://api.moonshot.cn/v1',
      'openrouter': 'https://openrouter.ai/api/v1',
      'ollama': 'http://localhost:11434/v1'
    };

    const baseURL = baseURLs[this.config.provider];

    // Fallback to avoid crash if mock run
    if(this.config.apiKey === 'mock') {
         return {
          text: "I am a mock LLM. I received your message and executed.",
          toolCalls: [],
          finishReason: 'stop'
        };
    }

    const openai = new OpenAI({
      apiKey: this.config.apiKey,
      baseURL: baseURL
    });

    try {
      const response = await openai.chat.completions.create({
        model: this.config.modelName,
        messages: messages.map(m => ({ role: m.role as any, content: m.content })),
        tools: [
            {
                type: "function",
                function: {
                    name: "calculator",
                    description: "Evaluate a mathematical expression safely.",
                    parameters: {
                        type: "object",
                        properties: { expression: { type: "string" } },
                        required: ["expression"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "file_reader",
                    description: "Read the contents of a text file from disk.",
                    parameters: {
                        type: "object",
                        properties: { filepath: { type: "string" } },
                        required: ["filepath"]
                    }
                }
            }
        ]
      });

      const choice = response.choices[0];
      const toolCalls = choice.message.tool_calls?.map(tc => {
        const tcall = tc as any;
        return {
          id: tc.id,
          name: tcall.function.name,
          args: JSON.parse(tcall.function.arguments)
        };
      }) || [];

      return {
        text: choice.message.content || '',
        toolCalls: toolCalls,
        finishReason: choice.finish_reason === 'tool_calls' ? 'tool_calls' : (choice.finish_reason === 'length' ? 'length' : 'stop')
      };
    } catch (e: any) {
        console.error("LLM Error:", e.message);
        return { text: "Error calling LLM", toolCalls: [], finishReason: 'stop' };
    }
  }

  private async runAnthropic(messages: ModelMessage[]): Promise<RunnerResponse> {
     // Fallback to avoid crash if mock run
    if(this.config.apiKey === 'mock') {
         return {
          text: "I am a mock Anthropic LLM.",
          toolCalls: [],
          finishReason: 'stop'
        };
    }
    const anthropic = new Anthropic({ apiKey: this.config.apiKey });

    // Convert tool format for Anthropic... (simplified for PoC)
    const system = messages.filter(m => m.role === 'system').map(m => m.content).join('\n');
    const userMsgs = messages.filter(m => m.role !== 'system').map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user' as const, content: m.content }));

    try {
        const response = await anthropic.messages.create({
            model: this.config.modelName,
            max_tokens: 1024,
            system: system,
            messages: userMsgs as any,
        });

        return {
            text: response.content.map(c => c.type === 'text' ? c.text : '').join(''),
            toolCalls: [], // Implement tool translation if needed
            finishReason: 'stop'
        }
    } catch (e: any) {
         console.error("LLM Error:", e.message);
         return { text: "Error calling LLM", toolCalls: [], finishReason: 'stop' };
    }
  }

  private async runGemini(messages: ModelMessage[]): Promise<RunnerResponse> {
      // Fallback to avoid crash if mock run
    if(this.config.apiKey === 'mock') {
         return {
          text: "I am a mock Gemini LLM.",
          toolCalls: [],
          finishReason: 'stop'
        };
    }
    const genAI = new GoogleGenerativeAI(this.config.apiKey);
    const model = genAI.getGenerativeModel({ model: this.config.modelName });

    const history = messages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{text: m.content}]
    }));

    try {
        const chat = model.startChat({ history: history.slice(0, -1) });
        const lastMsg = history[history.length - 1];
        const result = await chat.sendMessage(lastMsg.parts[0].text);

        return {
            text: result.response.text(),
            toolCalls: [], // Implement tool translation if needed
            finishReason: 'stop'
        }
    } catch (e: any) {
         console.error("LLM Error:", e.message);
         return { text: "Error calling LLM", toolCalls: [], finishReason: 'stop' };
    }
  }
}
