"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionsHistoryTool = void 0;
const FirstClassTool_1 = require("./FirstClassTool");
const db_1 = require("../db");
/**
 * Retrieves the history of the current agent strictly bound by the 'self' parameter.
 * This strict boundary prevents Cross-Context Leaks between compromised or diverse Sub-Agents.
 */
class SessionsHistoryTool extends FirstClassTool_1.BaseTool {
    name = 'sessions_history';
    description = 'Retrieves the history of the current session. Must be strictly isolated to itself using self=true to prevent cross-context data leaks.';
    parameters = {
        type: 'object',
        properties: {
            self: { type: 'boolean', description: 'Must ALWAYS be set to true to enforce context isolation.' }
        },
        required: ['self']
    };
    currentSessionId;
    constructor(currentSessionId) {
        super();
        this.currentSessionId = currentSessionId;
    }
    async execute(args) {
        if (args.self !== true) {
            return "HARD ERROR: Security Policy Violation. The 'self' parameter must strictly be true to prevent Cross-Context Data Leaks.";
        }
        try {
            const db = await (0, db_1.getDb)();
            const history = await db.all(`SELECT role, content FROM messages WHERE session_id = ? ORDER BY timestamp ASC`, [this.currentSessionId]);
            const formatted = history.map(row => `[${row.role.toUpperCase()}]: ${row.content}`).join('\n');
            return formatted.substring(0, 4000) + (formatted.length > 4000 ? '\n...[TRUNCATED]' : '');
        }
        catch (e) {
            return `Error accessing isolated history: ${e.message}`;
        }
    }
}
exports.SessionsHistoryTool = SessionsHistoryTool;
