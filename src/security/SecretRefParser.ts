import JSON5 from 'json5';
import fs from 'fs';
import { execSync } from 'child_process';

export type ExtractionMethod = 'env' | 'file' | 'exec';

export interface SecretRef {
  type: 'SecretRef';
  method: ExtractionMethod;
  value: string; // The variable name, file path, or command
}

/**
 * Validates and extracts API keys dynamically from environment,
 * encrypted file paths, or via external vault processes.
 * Denies plaintext API keys entirely.
 */
export class ConfigParser {
  /**
   * Parse a JSON5 configuration file securely.
   */
  public parseConfig(filepath: string): any {
    const rawContent = fs.readFileSync(filepath, 'utf8');
    const parsed = JSON5.parse(rawContent);

    return this.resolveSecretsRecursively(parsed);
  }

  private resolveSecretsRecursively(obj: any): any {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.resolveSecretsRecursively(item));
    }

    if (obj.type === 'SecretRef') {
      return this.resolveSecret(obj as SecretRef);
    }

    const resolvedObj: Record<string, any> = {};
    for (const [key, val] of Object.entries(obj)) {
      if (key.toLowerCase().includes('apikey') || key.toLowerCase().includes('token')) {
        if (typeof val === 'string' && val.length > 0 && val !== 'mock') {
          throw new Error(`[Security] Plaintext API Key detected for '${key}'. All secrets must use the SecretRef paradigm in JSON5 format.`);
        }
      }
      resolvedObj[key] = this.resolveSecretsRecursively(val);
    }
    return resolvedObj;
  }

  private resolveSecret(ref: SecretRef): string {
    switch (ref.method) {
      case 'env':
        const envVar = process.env[ref.value];
        if (!envVar) throw new Error(`[Security] Environment variable ${ref.value} not found.`);
        return envVar;
      case 'file':
        try {
          // Represents a file in a separate, encrypted storage
          return fs.readFileSync(ref.value, 'utf8').trim();
        } catch (e) {
          throw new Error(`[Security] Failed to read secret from file ${ref.value}`);
        }
      case 'exec':
        try {
          // Represents an execution (e.g., retrieving from HashiCorp Vault)
          // In real production, executing arbitrary strings is dangerous, so this must be tightly controlled by administrators.
          return execSync(ref.value, { encoding: 'utf8' }).trim();
        } catch (e) {
          throw new Error(`[Security] Failed to execute secret retrieval command ${ref.value}`);
        }
      default:
        throw new Error(`[Security] Unknown SecretRef method: ${ref.method}`);
    }
  }
}
