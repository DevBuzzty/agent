import { BaseTool } from './FirstClassTool';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { globalSecurityManager } from '../security/SecurityManager';

export interface ClawhubArgs {
  url: string;
}

/**
 * Downloads a Skill (Markdown module) from a Clawhub URL and installs it into the local Knowledge Workspace.
 */
export class ClawhubImportTool extends BaseTool<ClawhubArgs> {
  name = 'clawhub_import';
  description = 'Downloads and installs a new Skill or Knowledge Module directly from a Clawhub URL into the local agent workspace. Requires FileSystem permissions.';
  parameters = {
    type: 'object' as const,
    properties: {
      url: { type: 'string', description: 'The direct RAW URL to the Clawhub Markdown (.md) module.' }
    },
    required: ['url']
  };

  private workspaceDir: string;

  constructor(workspaceDir: string) {
    super();
    this.workspaceDir = workspaceDir;
  }

  async execute(args: ClawhubArgs): Promise<string> {
    if (!globalSecurityManager.canAccessFileSystem()) {
      return "Error: FileSystem access is explicitly denied by the 'Secure-by-Default' policy. Cannot import Clawhub skill.";
    }

    try {
      const parsedUrl = new URL(args.url);

      // Ensure we are downloading a markdown file (basic validation)
      if (!parsedUrl.pathname.endsWith('.md')) {
          return "Error: Clawhub URL must point to a raw .md Markdown file.";
      }

      const filename = path.basename(parsedUrl.pathname);
      const safePath = path.join(this.workspaceDir, filename);

      const content = await this.downloadRaw(args.url);

      if (!fs.existsSync(this.workspaceDir)) {
          fs.mkdirSync(this.workspaceDir, { recursive: true });
      }

      fs.writeFileSync(safePath, content, 'utf-8');

      return `Clawhub Skill successfully imported and saved to ${safePath}. It will be loaded dynamically by the KnowledgeManager.`;

    } catch (e: any) {
      return `Failed to import Clawhub Skill: ${e.message}`;
    }
  }

  private downloadRaw(urlStr: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(urlStr);
      const protocol = parsedUrl.protocol === 'https:' ? https : http;

      protocol.get(urlStr, (res) => {
        if (res.statusCode !== 200) {
            reject(new Error(`Server returned status code ${res.statusCode}`));
            return;
        }

        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
          if (data.length > 2 * 1024 * 1024) { // 2MB limit for a single module
             res.destroy();
             reject(new Error('Payload too large. Clawhub modules are restricted to 2MB.'));
          }
        });
        res.on('end', () => resolve(data));
      }).on('error', (e) => reject(e));
    });
  }
}
