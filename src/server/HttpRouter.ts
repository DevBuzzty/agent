import http, { IncomingMessage, ServerResponse } from 'http';
import crypto from 'crypto';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export interface RouteConfig {
  path: string;
  method: HttpMethod;
  auth: 'none' | 'signature' | 'token';
  match: RegExp; // Explicit URL matching
  handler: (req: IncomingMessage, res: ServerResponse, body?: any) => Promise<void>;
}

/**
 * Pre-Authentication Parsing for webhooks to defend against DoS / Billion Laughs attacks.
 */
export class SecureRouter {
  private routes: RouteConfig[] = [];
  private server: http.Server;
  private secretKey: string;

  constructor(secretKey: string) {
    this.secretKey = secretKey;
    this.server = http.createServer((req, res) => this.handleRequest(req, res));
  }

  public registerRoute(config: RouteConfig): void {
    this.routes.push(config);
    console.log(`[Router] Registered explicit route: ${config.method} ${config.path}`);
  }

  /**
   * Binds the server exclusively to Localhost to prevent external exposure.
   */
  public listen(port: number): void {
    this.server.listen(port, '127.0.0.1', () => {
      console.log(`[Security] Gateway bound securely to 127.0.0.1:${port}`);
    });
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = req.url || '/';
    const method = (req.method || 'GET') as HttpMethod;

    const route = this.routes.find(r => r.method === method && r.match.test(url));

    if (!route) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }

    try {
      const bodyBuffer = await this.readBody(req);

      // Pre-Authentication Parsing: Validate signature *before* deeply parsing JSON
      if (route.auth === 'signature') {
        const signature = req.headers['x-webhook-signature'] as string;
        if (!this.verifySignature(bodyBuffer, signature)) {
          res.writeHead(401);
          res.end('Unauthorized: Invalid Cryptographic Signature');
          return;
        }
      }

      // Safe JSON parse after auth check to prevent Billion Laughs / payload bombs
      let parsedBody: any;
      if (bodyBuffer.length > 0) {
        // Enforce hard payload limit on JSON
        if (bodyBuffer.length > 10 * 1024 * 1024) { // 10MB limit
           throw new Error("Payload too large");
        }
        parsedBody = JSON.parse(bodyBuffer.toString('utf8'));
      }

      await route.handler(req, res, parsedBody);

    } catch (e: any) {
      console.error(`[Router] Error handling request: ${e.message}`);
      res.writeHead(400);
      res.end('Bad Request');
    }
  }

  private readBody(req: IncomingMessage): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let size = 0;
      req.on('data', chunk => {
        size += chunk.length;
        // Early abort if body is unexpectedly massive (DoS defense)
        if (size > 10 * 1024 * 1024) {
          reject(new Error("Payload too large"));
          return;
        }
        chunks.push(chunk);
      });
      req.on('end', () => resolve(Buffer.concat(chunks)));
      req.on('error', reject);
    });
  }

  /**
   * Validates HMAC SHA-256 signature for pre-auth.
   */
  private verifySignature(payload: Buffer, signatureHeader: string): boolean {
    if (!signatureHeader) return false;

    const hmac = crypto.createHmac('sha256', this.secretKey);
    const expectedSignature = 'sha256=' + hmac.update(payload).digest('hex');

    try {
      return crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expectedSignature));
    } catch {
      return false;
    }
  }
}
