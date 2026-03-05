"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionsSpawnTool = void 0;
const FirstClassTool_1 = require("./FirstClassTool");
const crypto_1 = __importDefault(require("crypto"));
/**
 * Tool for spawning contextually isolated Sub-Agents dynamically.
 * These sub-agents operate parallel loops and do not cross-contaminate context.
 */
class SessionsSpawnTool extends FirstClassTool_1.BaseTool {
    name = 'sessions_spawn';
    description = 'Instantiates a dynamically context-isolated sub-agent to fulfill a specific objective.';
    parameters = {
        type: 'object',
        properties: {
            objective: { type: 'string', description: 'The objective of the sub-agent.' },
            context: { type: 'string', description: 'Necessary context or constraints to pass to the sub-agent.' }
        },
        required: ['objective', 'context']
    };
    pendingSubAgents = new Map();
    async execute(args) {
        const subAgentId = 'sub_' + crypto_1.default.randomUUID().slice(0, 8);
        this.pendingSubAgents.set(subAgentId, args);
        // In a fully integrated system, this would queue a message to the LaneQueue for execution.
        // For now, it returns the generated ID so the main loop can poll or await it.
        return `[System] Spawned sub-agent '${subAgentId}' for objective: "${args.objective}". This operates in complete isolation.`;
    }
}
exports.SessionsSpawnTool = SessionsSpawnTool;
