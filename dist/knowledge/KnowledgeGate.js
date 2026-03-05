"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.KnowledgeGate = void 0;
const os_1 = __importDefault(require("os"));
const child_process_1 = require("child_process");
/**
 * Implements Laufzeit Filter (Load-time Gating) for Knowledge Modules.
 * Validates 'requires.bins', 'requires.env', and 'os' architecture.
 */
class KnowledgeGate {
    /**
     * Evaluates the JSON metadata against the host environment.
     * Returns true if all conditions are strictly met.
     */
    evaluate(metadata) {
        if (!metadata)
            return true;
        // 1. OS Platform architecture constraint
        if (metadata.os && metadata.os.length > 0) {
            const platform = os_1.default.platform(); // e.g., 'linux', 'darwin', 'win32'
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
    isBinInPath(bin) {
        try {
            // Use 'which' on Unix or 'where' on Windows
            const cmd = os_1.default.platform() === 'win32' ? 'where' : 'which';
            const result = (0, child_process_1.spawnSync)(cmd, [bin]);
            return result.status === 0;
        }
        catch {
            return false;
        }
    }
}
exports.KnowledgeGate = KnowledgeGate;
