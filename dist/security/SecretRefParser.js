"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigParser = void 0;
const json5_1 = __importDefault(require("json5"));
const fs_1 = __importDefault(require("fs"));
const child_process_1 = require("child_process");
/**
 * Validates and extracts API keys dynamically from environment,
 * encrypted file paths, or via external vault processes.
 * Denies plaintext API keys entirely.
 */
class ConfigParser {
    /**
     * Parse a JSON5 configuration file securely.
     */
    parseConfig(filepath) {
        const rawContent = fs_1.default.readFileSync(filepath, 'utf8');
        const parsed = json5_1.default.parse(rawContent);
        return this.resolveSecretsRecursively(parsed);
    }
    resolveSecretsRecursively(obj) {
        if (typeof obj !== 'object' || obj === null) {
            return obj;
        }
        if (Array.isArray(obj)) {
            return obj.map(item => this.resolveSecretsRecursively(item));
        }
        if (obj.type === 'SecretRef') {
            return this.resolveSecret(obj);
        }
        const resolvedObj = {};
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
    resolveSecret(ref) {
        switch (ref.method) {
            case 'env':
                const envVar = process.env[ref.value];
                if (!envVar)
                    throw new Error(`[Security] Environment variable ${ref.value} not found.`);
                return envVar;
            case 'file':
                try {
                    // Represents a file in a separate, encrypted storage
                    return fs_1.default.readFileSync(ref.value, 'utf8').trim();
                }
                catch (e) {
                    throw new Error(`[Security] Failed to read secret from file ${ref.value}`);
                }
            case 'exec':
                try {
                    // Represents an execution (e.g., retrieving from HashiCorp Vault)
                    // In real production, executing arbitrary strings is dangerous, so this must be tightly controlled by administrators.
                    return (0, child_process_1.execSync)(ref.value, { encoding: 'utf8' }).trim();
                }
                catch (e) {
                    throw new Error(`[Security] Failed to execute secret retrieval command ${ref.value}`);
                }
            default:
                throw new Error(`[Security] Unknown SecretRef method: ${ref.method}`);
        }
    }
}
exports.ConfigParser = ConfigParser;
