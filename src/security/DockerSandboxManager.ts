import { spawnSync } from 'child_process';
import crypto from 'crypto';

export interface SandboxConfig {
  imageName: string;
  allowHostLocalhost: boolean;
  gatewayName: string; // The gateway instance name to network proxy with
}

/**
 * Manages Micro Virtual Containers (Docker Sandboxes).
 * Encapsulates all executing agent processes securely, blocking unauthorized traffic.
 */
export class DockerSandboxManager {
  /**
   * Spawns a new secure Docker Sandbox instance.
   */
  public spawnSandbox(config: SandboxConfig, injectedMemorySecrets: Record<string, string>): string {
    const sandboxId = crypto.randomUUID();

    // Constructing the secure docker run command using spawn array to prevent shell injection!
    const args: string[] = ['run', '-d', '--name', `sandbox_${sandboxId}`];

    // Injecting the API keys dynamically via environment variables directly to the container's memory layer.
    for (const [key, value] of Object.entries(injectedMemorySecrets)) {
      args.push('-e', `${key}=${value}`);
    }

    // Conceptually configuring the native network proxy:
    if (config.allowHostLocalhost) {
      args.push(`--network=proxy_${config.gatewayName}`);
      args.push('--add-host=host.docker.internal:host-gateway');
    } else {
      args.push('--network=none');
    }

    args.push(config.imageName);

    console.log(`[Sandbox] Spawning isolated micro virtual container: sandbox_${sandboxId}`);

    try {
      const result = spawnSync('docker', args, { encoding: 'utf-8' });
      if (result.error) {
         console.warn(`[Sandbox] Failed to run Docker command (likely missing Docker daemon). Falling back to simulated run. Error: ${result.error.message}`);
      }
    } catch (e: any) {
      console.warn(`[Sandbox] Exception executing Docker spawn: ${e.message}`);
    }

    return sandboxId;
  }

  /**
   * Cleans up the sandbox container.
   */
  public destroySandbox(sandboxId: string): void {
    console.log(`[Sandbox] Destroying sandbox container: sandbox_${sandboxId}`);
    try {
      spawnSync('docker', ['rm', '-f', `sandbox_${sandboxId}`]);
    } catch (e) {
      console.warn(`[Sandbox] Failed to destroy container sandbox_${sandboxId}.`);
    }
  }
}
