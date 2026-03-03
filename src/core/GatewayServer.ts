import { NormalizedMessage } from '../adapters/ChannelAdapter';
import { getDb } from '../db';
import { randomUUID } from 'crypto';

export interface RouteContext {
  sessionId: string;
  projectContext: string;
  message: NormalizedMessage;
}

export class GatewayServer {
  /**
   * Routes an incoming normalized message to an active or new session.
   * Maps based on the `authToken` provided by the channel adapter.
   */
  async route(message: NormalizedMessage): Promise<RouteContext> {
    const db = await getDb();

    // Look up existing session for this auth token
    let session = await db.get(
      `SELECT * FROM sessions WHERE auth_token = ? ORDER BY created_at DESC LIMIT 1`,
      [message.authToken]
    );

    let sessionId: string;
    let projectContext: string;

    if (!session) {
      // Create a new session
      sessionId = randomUUID();
      projectContext = 'default-project'; // simplified context

      await db.run(
        `INSERT INTO sessions (id, auth_token, project_context) VALUES (?, ?, ?)`,
        [sessionId, message.authToken, projectContext]
      );
      console.log(`[Gateway] Created new session ${sessionId} for auth token ${message.authToken}`);
    } else {
      sessionId = session.id;
      projectContext = session.project_context;

      // Update session timestamp
      await db.run(
        `UPDATE sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [sessionId]
      );
    }

    // Persist incoming message for context history
    const messageId = randomUUID();
    await db.run(
      `INSERT INTO messages (id, session_id, role, content) VALUES (?, ?, ?, ?)`,
      [messageId, sessionId, 'user', message.text]
    );

    return {
      sessionId,
      projectContext,
      message
    };
  }
}
