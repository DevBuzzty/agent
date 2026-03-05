"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecureRouter = void 0;
const http_1 = __importDefault(require("http"));
const crypto_1 = __importDefault(require("crypto"));
/**
 * Pre-Authentication Parsing for webhooks to defend against DoS / Billion Laughs attacks.
 */
class SecureRouter {
    routes = [];
    server;
    secretKey;
    constructor(secretKey) {
        this.secretKey = secretKey;
        this.server = http_1.default.createServer((req, res) => this.handleRequest(req, res));
    }
    registerRoute(config) {
        this.routes.push(config);
        console.log(`[Router] Registered explicit route: ${config.method} ${config.path}`);
    }
    /**
     * Binds the server exclusively to Localhost to prevent external exposure.
     */
    listen(port) {
        this.server.listen(port, '127.0.0.1', () => {
            console.log(`[Security] Gateway bound securely to 127.0.0.1:${port}`);
        });
    }
    async handleRequest(req, res) {
        const url = req.url || '/';
        const method = (req.method || 'GET');
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
                const signature = req.headers['x-webhook-signature'];
                if (!this.verifySignature(bodyBuffer, signature)) {
                    res.writeHead(401);
                    res.end('Unauthorized: Invalid Cryptographic Signature');
                    return;
                }
            }
            // Safe JSON parse after auth check to prevent Billion Laughs / payload bombs
            let parsedBody;
            if (bodyBuffer.length > 0) {
                // Enforce hard payload limit on JSON
                if (bodyBuffer.length > 10 * 1024 * 1024) { // 10MB limit
                    throw new Error("Payload too large");
                }
                parsedBody = JSON.parse(bodyBuffer.toString('utf8'));
            }
            await route.handler(req, res, parsedBody);
        }
        catch (e) {
            console.error(`[Router] Error handling request: ${e.message}`);
            res.writeHead(400);
            res.end('Bad Request');
        }
    }
    readBody(req) {
        return new Promise((resolve, reject) => {
            const chunks = [];
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
    verifySignature(payload, signatureHeader) {
        if (!signatureHeader)
            return false;
        const hmac = crypto_1.default.createHmac('sha256', this.secretKey);
        const expectedSignature = 'sha256=' + hmac.update(payload).digest('hex');
        try {
            return crypto_1.default.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expectedSignature));
        }
        catch {
            return false;
        }
    }
}
exports.SecureRouter = SecureRouter;
