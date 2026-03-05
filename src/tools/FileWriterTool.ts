import { BaseTool } from './FirstClassTool';
import fs from 'fs';
import path from 'path';
import { globalSecurityManager } from '../security/SecurityManager';
import { SecurePathResolver } from '../security/PathResolver';

export interface FileWriterArgs {
  filepath: string;
  content: string;
}

/**
 * Allows the AI Agent to create new scripts, configuration files, or general text files.
 * Provides self-development capabilities, bound strictly by the SecurityManager.
 */
export class FileWriterTool extends BaseTool<FileWriterArgs> {
  name = 'file_writer';
  description = 'Create a new file or overwrite an existing file with the provided text content. Requires FileSystem permissions.';
  parameters = {
    type: 'object' as const,
    properties: {
      filepath: { type: 'string', description: 'The path where the file should be created.' },
      content: { type: 'string', description: 'The raw text content to write into the file.' }
    },
    required: ['filepath', 'content']
  };

  private pathResolver: SecurePathResolver;

  constructor(pathResolver: SecurePathResolver) {
    super();
    this.pathResolver = pathResolver;
  }

  async execute(args: FileWriterArgs): Promise<string> {
    if (!globalSecurityManager.canAccessFileSystem()) {
      return "Error: FileSystem access is explicitly denied by the 'Secure-by-Default' policy. Cannot write file.";
    }

    try {
      const safePath = this.pathResolver.resolveSafePath(args.filepath);

      const dir = path.dirname(safePath);
      if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(safePath, args.content, 'utf-8');
      return `File successfully written to: ${safePath}`;
    } catch (e: any) {
      return `Failed to write file: ${e.message}`;
    }
  }
}
