"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebFetchTool = void 0;
const FirstClassTool_1 = require("./FirstClassTool");
const turndown_1 = __importDefault(require("turndown"));
const https_1 = __importDefault(require("https"));
const http_1 = __importDefault(require("http"));
/**
 * A Web Fetch tool that securely downloads a URL's HTML
 * and converts it to Markdown on-the-fly to maintain token efficiency.
 * It strictly enforces a hard character limit to prevent Context Overflow.
 */
class WebFetchTool extends FirstClassTool_1.BaseTool {
    name = 'web_fetch';
    description = 'Fetches a webpage and converts its HTML to Markdown on-the-fly. Includes a hard character limit to prevent context window overflow.';
    parameters = {
        type: 'object',
        properties: {
            url: { type: 'string', description: 'The URL of the webpage to fetch.' },
            maxChars: { type: 'number', description: 'The maximum allowed characters of Markdown to return (hard character limit). Default is 4000.' }
        },
        required: ['url']
    };
    turndownService = new turndown_1.default();
    async execute(args) {
        const limit = args.maxChars || 4000;
        try {
            const html = await this.fetchHtml(args.url);
            // Convert HTML to Markdown on-the-fly
            const markdown = this.turndownService.turndown(html);
            // Protect against Context Overflow using intelligent middle truncation
            const { TokenOptimizer } = require('../core/TokenOptimizer');
            return TokenOptimizer.truncateMiddle(markdown, limit);
        }
        catch (e) {
            return `Error fetching or parsing URL: ${e.message}`;
        }
    }
    fetchHtml(urlStr) {
        return new Promise((resolve, reject) => {
            const parsedUrl = new URL(urlStr);
            const protocol = parsedUrl.protocol === 'https:' ? https_1.default : http_1.default;
            protocol.get(urlStr, (res) => {
                // Basic protection: prevent downloading massive non-HTML files
                const contentType = res.headers['content-type'];
                if (contentType && !contentType.includes('text/html') && !contentType.includes('text/plain')) {
                    reject(new Error(`Unsupported content type: ${contentType}. Only text/html or text/plain allowed.`));
                    return;
                }
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                    if (data.length > 5 * 1024 * 1024) { // 5MB hard limit for downloading HTML
                        res.destroy();
                        reject(new Error('Payload too large. WebFetch is restricted to 5MB downloads.'));
                    }
                });
                res.on('end', () => resolve(data));
            }).on('error', (e) => reject(e));
        });
    }
}
exports.WebFetchTool = WebFetchTool;
