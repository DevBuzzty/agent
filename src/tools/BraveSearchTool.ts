import { BaseTool } from './FirstClassTool';
import https from 'https';

export interface BraveSearchArgs {
  query: string;
}

/**
 * An integrated 'brave_search' tool that queries the Brave Search API.
 * Allows the AI to actively search the internet for real-time information.
 */
export class BraveSearchTool extends BaseTool<BraveSearchArgs> {
  name = 'brave_search';
  description = 'Searches the internet using the Brave Search API to retrieve up-to-date information, news, and website snippets.';
  parameters = {
    type: 'object' as const,
    properties: {
      query: { type: 'string', description: 'The search query or keywords.' }
    },
    required: ['query']
  };

  private apiKey: string;

  constructor(apiKey: string) {
    super();
    this.apiKey = apiKey;
  }

  async execute(args: BraveSearchArgs): Promise<string> {
    if (!this.apiKey || this.apiKey === 'DUMMY_KEY') {
        return "Error: Brave Search API key is not configured. Ask the administrator to run the onboarding process to set BRAVE_API_KEY.";
    }

    return new Promise((resolve) => {
      const url = new URL('https://api.search.brave.com/res/v1/web/search');
      url.searchParams.append('q', args.query);
      url.searchParams.append('count', '5'); // Limit to top 5 results to save tokens

      const options = {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'X-Subscription-Token': this.apiKey
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode !== 200) {
              resolve(`[Brave Search Error] Status: ${res.statusCode} - ${data}`);
              return;
          }

          try {
            const json = JSON.parse(data);
            const results = json.web?.results;

            if (!results || results.length === 0) {
              resolve(`No search results found for query: "${args.query}"`);
              return;
            }

            const formattedResults = results.map((r: any, idx: number) => {
               return `[${idx + 1}] Title: ${r.title}\nURL: ${r.url}\nSnippet: ${r.description}\n---`;
            }).join('\n');

            resolve(`Search Results for "${args.query}":\n\n${formattedResults}`);
          } catch (e: any) {
            resolve(`[Brave Search Error] Failed to parse results: ${e.message}`);
          }
        });
      });

      req.on('error', (e) => {
        resolve(`[Brave Search Error] Request failed: ${e.message}`);
      });

      req.end();
    });
  }
}
