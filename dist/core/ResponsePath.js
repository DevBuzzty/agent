"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResponsePath = void 0;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
class ResponsePath {
    logFilePath;
    constructor() {
        this.logFilePath = path_1.default.join(__dirname, '../../transcripts.jsonl');
    }
    /**
     * Appends a log entry to a deterministic JSONL transcript on disk.
     */
    async logTranscript(sessionId, entry) {
        const timestamp = new Date().toISOString();
        const line = JSON.stringify({ timestamp, sessionId, ...entry }) + '\n';
        try {
            await promises_1.default.appendFile(this.logFilePath, line, 'utf-8');
        }
        catch (e) {
            console.error(`[ResponsePath] Failed to write transcript for session ${sessionId}:`, e.message);
        }
    }
    /**
     * Streams/sends the final result asynchronously to the origin channel.
     * In a more complete implementation, this would handle SSE, Websockets, or long text splitting.
     */
    async streamResponse(adapter, channelId, text) {
        console.log(`[ResponsePath] Streaming response to channel ${channelId}`);
        try {
            await adapter.sendMessage(channelId, text);
        }
        catch (e) {
            console.error(`[ResponsePath] Failed to stream response to channel ${channelId}:`, e.message);
        }
    }
}
exports.ResponsePath = ResponsePath;
