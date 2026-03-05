"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgenticLoop = void 0;
const db_1 = require("../db");
const crypto_1 = require("crypto");
const ExecTool_1 = require("../tools/ExecTool");
const BrowserTool_1 = require("../tools/BrowserTool");
const WebFetchTool_1 = require("../tools/WebFetchTool");
const SessionsSpawnTool_1 = require("../tools/SessionsSpawnTool");
const SessionsHistoryTool_1 = require("../tools/SessionsHistoryTool");
const LoopDetectionTool_1 = require("../tools/LoopDetectionTool");
const BraveSearchTool_1 = require("../tools/BraveSearchTool");
const LoopDetector_1 = require("./LoopDetector");
class AgenticLoop {
    runner;
    toolsMap = {};
    stepLogger;
    loopDetector;
    constructor(runner, stepLogger, pathResolver, sessionId, braveApiKey, sandboxId) {
        this.runner = runner;
        this.stepLogger = stepLogger;
        this.loopDetector = new LoopDetector_1.LoopDetector();
        // Register native First-Class Tools
        const toolsList = [
            new ExecTool_1.ExecTool(sandboxId),
            new BrowserTool_1.BrowserTool(),
            new WebFetchTool_1.WebFetchTool(),
            new SessionsSpawnTool_1.SessionsSpawnTool(),
            new SessionsHistoryTool_1.SessionsHistoryTool(sessionId),
            new LoopDetectionTool_1.LoopDetectionTool(this.loopDetector),
            new BraveSearchTool_1.BraveSearchTool(braveApiKey || 'DUMMY_KEY')
        ];
        for (const tool of toolsList) {
            this.toolsMap[tool.name] = tool;
        }
        this.runner.registerTools(toolsList);
    }
    async start(sessionId, initialMessages) {
        const db = await (0, db_1.getDb)();
        let currentMessages = [...initialMessages];
        let iteration = 0;
        const maxIterations = 15;
        while (iteration < maxIterations) {
            iteration++;
            await this.stepLogger({ type: 'reasoning_start', iteration, messages: currentMessages });
            const response = await this.runner.run(currentMessages);
            await this.stepLogger({ type: 'model_response', iteration, response });
            const assistantMsg = {
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
                    }
                    else {
                        resultStr = `Tool ${call.name} not found.`;
                    }
                    const toolMsg = {
                        role: 'tool',
                        content: resultStr,
                        tool_call_id: call.id
                    };
                    currentMessages.push(toolMsg);
                    this.loopDetector.recordMessage(toolMsg);
                }
            }
            else if (response.finishReason === 'stop' || response.finishReason === 'length') {
                await this.stepLogger({ type: 'reasoning_end', iteration, finalResponse: response.text });
                const messageId = (0, crypto_1.randomUUID)();
                await db.run(`INSERT INTO messages (id, session_id, role, content) VALUES (?, ?, ?, ?)`, [messageId, sessionId, 'assistant', response.text]);
                return response.text;
            }
        }
        return "Agent loop reached maximum iterations.";
    }
}
exports.AgenticLoop = AgenticLoop;
