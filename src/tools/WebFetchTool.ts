import { BaseTool } from './FirstClassTool';
import TurndownService from 'turndown';
import https from 'https';
import http from 'http';

export interface WebFetchArgs {
  url: string;
  maxChars?: number;
}

/**
 * A Web Fetch tool that securely downloads a URL's HTML
 * and converts it to Markdown on-the-fly to maintain token efficiency.
 * It strictly enforces a hard character limit to prevent Context Overflow.
 */
export class WebFetchTool extends BaseTool<WebFetchArgs> {
  name = 'web_fetch';
  description = 'Fetches a webpage and converts its HTML to Markdown on-the-fly. Includes a hard character limit to prevent context window overflow.';
  parameters = {
    type: 'object' as const,
    properties: {
      url: { type: 'string', description: 'The URL of the webpage to fetch.' },
      maxChars: { type: 'number', description: 'The maximum allowed characters of Markdown to return (hard character limit). Default is 4000.' }
    },
    required: ['url']
  };

  private turndownService = new TurndownService();

  async execute(args: WebFetchArgs): Promise<string> {
    const limit = args.maxChars || 4000;

    try {
      const html = await this.fetchHtml(args.url);

      // Convert HTML to Markdown on-the-fly
      const markdown = this.turndownService.turndown(html);

      // Protect against Context Overflow
      if (markdown.length > limit) {
        return markdown.substring(0, limit) + `\n\n[TRUNCATED]: Reached maxChars limit of ${limit}.`;
      }
      return markdown;
    } catch (e: any) {
      return `Error fetching or parsing URL: ${e.message}`;
    }
  }

  private fetchHtml(urlStr: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(urlStr);
      const protocol = parsedUrl.protocol === 'https:' ? https : http;

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
