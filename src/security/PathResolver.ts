import path from 'path';
import fs from 'fs';

/**
 * Hardens the system against Symlink Breakouts and path traversals.
 * Resolves paths strictly relative to a dedicated workspace.
 */
export class SecurePathResolver {
  private workspaceRoot: string;

  constructor(workspacePath: string) {
    // Resolve strictly
    this.workspaceRoot = path.resolve(workspacePath);
    if (!fs.existsSync(this.workspaceRoot)) {
      fs.mkdirSync(this.workspaceRoot, { recursive: true });
    }
  }

  /**
   * Safely resolves a requested path and guarantees it resides within the workspace boundary.
   */
  public resolveSafePath(requestedPath: string): string {
    // 1. Resolve the path relative to the root to neutralize traversal characters (e.g. '../')
    const resolvedPath = path.resolve(this.workspaceRoot, requestedPath);

    // 2. Symlink checks (Ensure the real, absolute path is also within the workspace)
    let realPath: string;
    try {
      realPath = fs.realpathSync(resolvedPath);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // File doesn't exist yet; validate the resolved target's location
        realPath = resolvedPath;
      } else {
        throw new Error(`[Security] Error resolving file path: ${error.message}`);
      }
    }

    if (!realPath.startsWith(this.workspaceRoot + path.sep) && realPath !== this.workspaceRoot) {
      throw new Error(`[Security Violation] Path Traversal or Symlink Breakout Attempted. Access Denied to: ${requestedPath}`);
    }

    return realPath;
  }
}
