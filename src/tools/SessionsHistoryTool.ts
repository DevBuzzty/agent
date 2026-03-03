import { BaseTool } from './FirstClassTool';
import { getDb } from '../db';

export interface HistoryArgs {
  self: boolean;
}

/**
 * Retrieves the history of the current agent strictly bound by the 'self' parameter.
 * This strict boundary prevents Cross-Context Leaks between compromised or diverse Sub-Agents.
 */
export class SessionsHistoryTool extends BaseTool<HistoryArgs> {
  name = 'sessions_history';
  description = 'Retrieves the history of the current session. Must be strictly isolated to itself using self=true to prevent cross-context data leaks.';
  parameters = {
    type: 'object' as const,
    properties: {
      self: { type: 'boolean', description: 'Must ALWAYS be set to true to enforce context isolation.' }
    },
    required: ['self']
  };

  private currentSessionId: string;

  constructor(currentSessionId: string) {
    super();
    this.currentSessionId = currentSessionId;
  }

  async execute(args: HistoryArgs): Promise<string> {
    if (args.self !== true) {
       return "HARD ERROR: Security Policy Violation. The 'self' parameter must strictly be true to prevent Cross-Context Data Leaks.";
    }

    try {
      const db = await getDb();
      const history = await db.all(
        `SELECT role, content FROM messages WHERE session_id = ? ORDER BY timestamp ASC`,
        [this.currentSessionId]
      );

      const formatted = history.map(row => `[${row.role.toUpperCase()}]: ${row.content}`).join('\n');
      return formatted.substring(0, 4000) + (formatted.length > 4000 ? '\n...[TRUNCATED]' : '');
    } catch (e: any) {
      return `Error accessing isolated history: ${e.message}`;
    }
  }
}
