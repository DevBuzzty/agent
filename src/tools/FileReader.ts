import fs from 'fs/promises';
import { globalSecurityManager } from '../security/SecurityManager';
import { SecurePathResolver } from '../security/PathResolver';

export const createFileReaderTool = (pathResolver: SecurePathResolver) => ({
  name: 'file_reader',
  description: 'Read the contents of a text file from disk securely.',
  execute: async (args: { filepath: string }): Promise<string> => {
    try {
      if (!globalSecurityManager.canAccessFileSystem()) {
        return "Error: File system access is explicitly denied by the security policy.";
      }

      // Secure path resolution to prevent symlink breakouts and path traversal
      const safePath = pathResolver.resolveSafePath(args.filepath);

      const content = await fs.readFile(safePath, 'utf-8');
      return content;
    } catch (e: any) {
      return `Error reading file: ${e.message}`;
    }
  }
});
