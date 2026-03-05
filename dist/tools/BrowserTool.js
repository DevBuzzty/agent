"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrowserTool = void 0;
const FirstClassTool_1 = require("./FirstClassTool");
const puppeteer_1 = __importDefault(require("puppeteer"));
/**
 * A module for direct browser control via Chrome DevTools Protocol (CDP).
 * Generates token-efficient Accessibility Trees over raw HTML using the `snapshot` command.
 * Manages isolated profiles for parallel identities.
 */
class BrowserTool extends FirstClassTool_1.BaseTool {
    name = 'browser_control';
    description = 'Direct browser control via CDP. Generates token-efficient Accessibility Trees instead of raw HTML. Supports isolated profiles for parallel identities.';
    parameters = {
        type: 'object',
        properties: {
            url: { type: 'string', description: 'The URL to navigate to.' },
            action: { type: 'string', enum: ['snapshot', 'click', 'type'], description: 'The action to perform.' },
            selector: { type: 'string', description: 'CSS selector for click/type actions.' },
            text: { type: 'string', description: 'Text to type.' },
            profileId: { type: 'string', description: 'Identifier for isolated browser profile (parallel identities).' }
        },
        required: ['url', 'action']
    };
    browserInstances = new Map();
    async execute(args) {
        const profile = args.profileId || 'default';
        let browser = this.browserInstances.get(profile);
        try {
            if (!browser) {
                // With 'puppeteer', the chromium binary is bundled.
                browser = await puppeteer_1.default.launch({
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
            }
            else if (args.action === 'click' && args.selector) {
                await page.click(args.selector);
                result = `Clicked element: ${args.selector}`;
            }
            else if (args.action === 'type' && args.selector && args.text) {
                await page.type(args.selector, args.text);
                result = `Typed text into element: ${args.selector}`;
            }
            await page.close();
            await context.close();
            return result;
        }
        catch (e) {
            return `[Browser Error] Could not perform action. Details: ${e.message}`;
        }
    }
    simplifyAXTree(nodes) {
        const rawText = nodes
            .filter(n => n.role && n.role.value && n.name && n.name.value)
            .map(n => `[${n.role.value}] ${n.name.value}`)
            .join('\n');
        const { TokenOptimizer } = require('../core/TokenOptimizer');
        return TokenOptimizer.truncateMiddle(rawText, 4000);
    }
}
exports.BrowserTool = BrowserTool;
