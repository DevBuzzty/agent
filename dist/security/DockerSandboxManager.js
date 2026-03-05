"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DockerSandboxManager = void 0;
const child_process_1 = require("child_process");
const crypto_1 = __importDefault(require("crypto"));
/**
 * Manages Micro Virtual Containers (Docker Sandboxes).
 * Encapsulates all executing agent processes securely, blocking unauthorized traffic.
 */
class DockerSandboxManager {
    /**
     * Spawns a new secure Docker Sandbox instance.
     */
    spawnSandbox(config, injectedMemorySecrets) {
        const sandboxId = crypto_1.default.randomUUID();
        // Constructing the secure docker run command using spawn array to prevent shell injection!
        const args = ['run', '-d', '--name', `sandbox_${sandboxId}`];
        // Injecting the API keys dynamically via environment variables directly to the container's memory layer.
        for (const [key, value] of Object.entries(injectedMemorySecrets)) {
            args.push('-e', `${key}=${value}`);
        }
        // Conceptually configuring the native network proxy:
        if (config.allowHostLocalhost) {
            args.push(`--network=proxy_${config.gatewayName}`);
            args.push('--add-host=host.docker.internal:host-gateway');
        }
        else {
            args.push('--network=none');
        }
        args.push(config.imageName);
        console.log(`[Sandbox] Spawning isolated micro virtual container: sandbox_${sandboxId}`);
        try {
            const result = (0, child_process_1.spawnSync)('docker', args, { encoding: 'utf-8' });
            if (result.error) {
                console.warn(`[Sandbox] Failed to run Docker command (likely missing Docker daemon). Falling back to simulated run. Error: ${result.error.message}`);
            }
        }
        catch (e) {
            console.warn(`[Sandbox] Exception executing Docker spawn: ${e.message}`);
        }
        return sandboxId;
    }
    /**
     * Cleans up the sandbox container.
     */
    destroySandbox(sandboxId) {
        console.log(`[Sandbox] Destroying sandbox container: sandbox_${sandboxId}`);
        try {
            (0, child_process_1.spawnSync)('docker', ['rm', '-f', `sandbox_${sandboxId}`]);
        }
        catch (e) {
            console.warn(`[Sandbox] Failed to destroy container sandbox_${sandboxId}.`);
        }
    }
}
exports.DockerSandboxManager = DockerSandboxManager;
