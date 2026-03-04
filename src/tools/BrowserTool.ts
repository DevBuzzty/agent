import { BaseTool } from './FirstClassTool';
import puppeteer, { Browser } from 'puppeteer';
import { globalSecurityManager } from '../security/SecurityManager';

export interface BrowserArgs {
  url: string;
  action: 'snapshot' | 'click' | 'type';
  selector?: string;
  text?: string;
  profileId?: string; // Isolated profile for parallel identities
}

/**
 * A module for direct browser control via Chrome DevTools Protocol (CDP).
 * Generates token-efficient Accessibility Trees over raw HTML using the `snapshot` command.
 * Manages isolated profiles for parallel identities.
 */
export class BrowserTool extends BaseTool<BrowserArgs> {
  name = 'browser_control';
  description = 'Direct browser control via CDP. Generates token-efficient Accessibility Trees instead of raw HTML. Supports isolated profiles for parallel identities.';
  parameters = {
    type: 'object' as const,
    properties: {
      url: { type: 'string', description: 'The URL to navigate to.' },
      action: { type: 'string', enum: ['snapshot', 'click', 'type'], description: 'The action to perform.' },
      selector: { type: 'string', description: 'CSS selector for click/type actions.' },
      text: { type: 'string', description: 'Text to type.' },
      profileId: { type: 'string', description: 'Identifier for isolated browser profile (parallel identities).' }
    },
    required: ['url', 'action']
  };

  private browserInstances: Map<string, Browser> = new Map();

  async execute(args: BrowserArgs): Promise<string> {
    const profile = args.profileId || 'default';

    let browser = this.browserInstances.get(profile);

    try {
      if (!browser) {
          // With 'puppeteer', the chromium binary is bundled.
          browser = await puppeteer.launch({
              headless: true,
              args: ['--no-sandbox', '--disable-setuid-sandbox']
          });
          this.browserInstances.set(profile, browser);
      }

      // 1. Create isolated context per profile
      const context = await browser.createBrowserContext();
      const page = await context.newPage();

      await page.goto(args.url, { waitUntil: 'networkidle2' });

      let result = '';

      if (args.action === 'snapshot') {
        // Generates token-efficient Accessibility Tree using CDP
        const client = await page.createCDPSession();
        const tree = await client.send('Accessibility.getFullAXTree');

        // Very basic simplification of the AXTree for token efficiency
        result = this.simplifyAXTree(tree.nodes);

      } else if (args.action === 'click' && args.selector) {
        await page.click(args.selector);
        result = `Clicked element: ${args.selector}`;
      } else if (args.action === 'type' && args.selector && args.text) {
        await page.type(args.selector, args.text);
        result = `Typed text into element: ${args.selector}`;
      }

      await page.close();
      await context.close();

      return result;

    } catch (e: any) {
       return `[Browser Error] Could not perform action. Details: ${e.message}`;
    }
  }

  private simplifyAXTree(nodes: any[]): string {
    const rawText = nodes
      .filter(n => n.role && n.role.value && n.name && n.name.value)
      .map(n => `[${n.role.value}] ${n.name.value}`)
      .join('\n');

    const { TokenOptimizer } = require('../core/TokenOptimizer');
    return TokenOptimizer.truncateMiddle(rawText, 4000);
  }
}
