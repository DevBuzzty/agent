import { BaseTool } from './FirstClassTool';
import fs from 'fs';
import { globalSecurityManager } from '../security/SecurityManager';
import { SecurePathResolver } from '../security/PathResolver';

export interface FileEditorArgs {
  filepath: string;
  search_block: string;
  replace_block: string;
}

/**
 * Allows the AI Agent to modify existing files by searching for an exact block of text
 * and replacing it. Excellent for patching code or appending configurations.
 */
export class FileEditorTool extends BaseTool<FileEditorArgs> {
  name = 'file_editor';
  description = 'Modify an existing file by replacing an exact block of text. Use this to patch code or configurations. Requires FileSystem permissions.';
  parameters = {
    type: 'object' as const,
    properties: {
      filepath: { type: 'string', description: 'The path to the file to edit.' },
      search_block: { type: 'string', description: 'The exact block of text currently in the file to find. Must match exactly.' },
      replace_block: { type: 'string', description: 'The new block of text that will replace the search_block.' }
    },
    required: ['filepath', 'search_block', 'replace_block']
  };

  private pathResolver: SecurePathResolver;

  constructor(pathResolver: SecurePathResolver) {
    super();
    this.pathResolver = pathResolver;
  }

  async execute(args: FileEditorArgs): Promise<string> {
    if (!globalSecurityManager.canAccessFileSystem()) {
      return "Error: FileSystem access is explicitly denied by the 'Secure-by-Default' policy. Cannot edit file.";
    }

    try {
      const safePath = this.pathResolver.resolveSafePath(args.filepath);

      if (!fs.existsSync(safePath)) {
          return `Error: File does not exist at path: ${safePath}`;
      }

      const content = fs.readFileSync(safePath, 'utf-8');

      if (!content.includes(args.search_block)) {
          return "Error: The provided 'search_block' could not be found in the file. It must match exactly (including whitespace and newlines). Please use file_reader first to get the exact text.";
      }

      const updatedContent = content.replace(args.search_block, args.replace_block);
      fs.writeFileSync(safePath, updatedContent, 'utf-8');

      return `File successfully updated: ${safePath}`;
    } catch (e: any) {
      return `Failed to edit file: ${e.message}`;
    }
  }
}
