import { ModuleMetadata } from './KnowledgeParser';
import os from 'os';
import { spawnSync } from 'child_process';

/**
 * Implements Laufzeit Filter (Load-time Gating) for Knowledge Modules.
 * Validates 'requires.bins', 'requires.env', and 'os' architecture.
 */
export class KnowledgeGate {
  /**
   * Evaluates the JSON metadata against the host environment.
   * Returns true if all conditions are strictly met.
   */
  public evaluate(metadata: ModuleMetadata): boolean {
    if (!metadata) return true;

    // 1. OS Platform architecture constraint
    if (metadata.os && metadata.os.length > 0) {
      const platform = os.platform(); // e.g., 'linux', 'darwin', 'win32'
      if (!metadata.os.includes(platform)) {
        return false;
      }
    }

    // 2. Requires Bins (Specific binaries in PATH)
    if (metadata.requires && metadata.requires.bins) {
      for (const bin of metadata.requires.bins) {
        if (!this.isBinInPath(bin)) {
          return false;
        }
      }
    }

    // 3. Requires Env (Environment variables)
    if (metadata.requires && metadata.requires.env) {
      for (const envVar of metadata.requires.env) {
        if (process.env[envVar] === undefined) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Helper to strictly check if a binary exists in the system PATH.
   * Safe execution via spawnSync to prevent OS Command Injection vulnerabilities.
   */
  private isBinInPath(bin: string): boolean {
    try {
      // Use 'which' on Unix or 'where' on Windows
      const cmd = os.platform() === 'win32' ? 'where' : 'which';
      const result = spawnSync(cmd, [bin]);
      return result.status === 0;
    } catch {
      return false;
    }
  }
}
