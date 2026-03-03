import fs from 'fs/promises';
import path from 'path';

export class ResponsePath {
  private logFilePath: string;

  constructor() {
    this.logFilePath = path.join(__dirname, '../../transcripts.jsonl');
  }

  /**
   * Appends a log entry to a deterministic JSONL transcript on disk.
   */
  async logTranscript(sessionId: string, entry: any): Promise<void> {
    const timestamp = new Date().toISOString();
    const line = JSON.stringify({ timestamp, sessionId, ...entry }) + '\n';
    try {
      await fs.appendFile(this.logFilePath, line, 'utf-8');
    } catch (e: any) {
      console.error(`[ResponsePath] Failed to write transcript for session ${sessionId}:`, e.message);
    }
  }

  /**
   * Streams/sends the final result asynchronously to the origin channel.
   * In a more complete implementation, this would handle SSE, Websockets, or long text splitting.
   */
  async streamResponse(adapter: any, channelId: string, text: string): Promise<void> {
    console.log(`[ResponsePath] Streaming response to channel ${channelId}`);
    try {
      await adapter.sendMessage(channelId, text);
    } catch (e: any) {
      console.error(`[ResponsePath] Failed to stream response to channel ${channelId}:`, e.message);
    }
  }
}
