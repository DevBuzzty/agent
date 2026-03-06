import { BaseTool } from './FirstClassTool';
import fs from 'fs';
import path from 'path';

export interface MemoryArgs {
  action: 'set' | 'delete' | 'read';
  key?: string;
  value?: string;
}

/**
 * Long-Term Adaptive Memory.
 * Allows the agent to persistently store facts about the user, their preferences,
 * or past conclusions. This memory is automatically injected into the system prompt.
 */
export class MemoryTool extends BaseTool<MemoryArgs> {
  name = 'adaptive_memory';
  description = 'Read, set, or delete long-term adaptive memory. Use this to remember user preferences, facts, or context across sessions autonomously.';
  parameters = {
    type: 'object' as const,
    properties: {
      action: { type: 'string', enum: ['set', 'delete', 'read'], description: 'The memory operation to perform.' },
      key: { type: 'string', description: 'The topic/key to remember (e.g. "user_name", "coding_preference"). Required for set and delete.' },
      value: { type: 'string', description: 'The fact or preference to store. Required only for set.' }
    },
    required: ['action']
  };

  private memoryFile: string;

  constructor(workspaceDir: string) {
    super();
    this.memoryFile = path.join(workspaceDir, 'memory.json');
  }

  private loadMemory(): Record<string, string> {
    if (!fs.existsSync(this.memoryFile)) return {};
    try {
      return JSON.parse(fs.readFileSync(this.memoryFile, 'utf-8'));
    } catch {
      return {};
    }
  }

  private saveMemory(data: Record<string, string>) {
    const dir = path.dirname(this.memoryFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.memoryFile, JSON.stringify(data, null, 2), 'utf-8');
  }

  async execute(args: MemoryArgs): Promise<string> {
    const memory = this.loadMemory();

    if (args.action === 'read') {
       if (Object.keys(memory).length === 0) return "Memory is currently empty.";
       return JSON.stringify(memory, null, 2);
    }

    if (!args.key) return "Error: 'key' is required for set/delete actions.";

    if (args.action === 'set') {
        if (!args.value) return "Error: 'value' is required for set action.";
        memory[args.key] = args.value;
        this.saveMemory(memory);
        return `Successfully remembered: [${args.key}] = ${args.value}`;
    }

    if (args.action === 'delete') {
        delete memory[args.key];
        this.saveMemory(memory);
        return `Successfully forgot: ${args.key}`;
    }

    return "Error: Invalid action.";
  }

  /**
   * Utility to statically read the memory into the system prompt.
   */
  public getMemoryDump(): string {
     const memory = this.loadMemory();
     if (Object.keys(memory).length === 0) return "";
     return JSON.stringify(memory, null, 2);
  }
}
