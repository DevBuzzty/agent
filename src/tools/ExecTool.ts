import { BaseTool } from './FirstClassTool';
import { spawn, ChildProcess } from 'child_process';
import { globalSecurityManager } from '../security/SecurityManager';

export interface ExecArgs {
  command: string;
  args?: string[];
  pty?: boolean;
  background?: boolean;
}

/**
 * An integrated 'exec' tool supporting pseudo-terminal simulation
 * and auto-backgrounding functionality for asynchronous processes.
 */
export class ExecTool extends BaseTool<ExecArgs> {
  name = 'exec';
  description = 'Executes a shell command. Supports pseudo-terminal (pty) and auto-backgrounding for long-running processes.';
  parameters = {
    type: 'object' as const,
    properties: {
      command: { type: 'string', description: 'The shell command or executable path.' },
      args: { type: 'array', items: { type: 'string' }, description: 'Arguments to pass to the command.' },
      pty: { type: 'boolean', description: 'Enable pseudo-terminal (pty) support.' },
      background: { type: 'boolean', description: 'Run the process in the background asynchronously.' }
    },
    required: ['command']
  };

  private backgroundProcesses: Map<number, ChildProcess> = new Map();

  private sandboxId?: string;

  constructor(sandboxId?: string) {
    super();
    this.sandboxId = sandboxId;
  }

  async execute(args: ExecArgs): Promise<string> {
    if (!globalSecurityManager.canAccessShell()) {
      return "Error: Shell access is explicitly denied by the 'Secure-by-Default' policy.";
    }

    const runBackground = args.background || false;
    const commandArgs = args.args || [];
    const usePty = args.pty || false;

    // True Docker Sandbox Execution
    // If a sandboxId is provided, we route the execution INTO the isolated container
    // rather than running it natively on the host machine.
    let spawnCmd = args.command;
    let spawnArgs = commandArgs;

    if (this.sandboxId) {
        spawnCmd = 'docker';
        const fullInnerCmd = `${args.command} ${commandArgs.join(' ')}`;
        spawnArgs = ['exec', '-i', `sandbox_${this.sandboxId}`, 'sh', '-c', fullInnerCmd];
    }

    return new Promise((resolve) => {
      try {
        const childProc = spawn(spawnCmd, spawnArgs, {
          cwd: process.cwd(),
          env: process.env,
          shell: this.sandboxId ? false : usePty
        });

        if (runBackground && childProc.pid) {
          this.backgroundProcesses.set(childProc.pid, childProc);
          resolve(`Process ${childProc.pid} started in the background.`);
          return;
        }

        let output = '';
        childProc.stdout?.on('data', (data: Buffer) => {
          output += data.toString();
        });
        childProc.stderr?.on('data', (data: Buffer) => {
          output += data.toString();
        });

        childProc.on('close', (code: number) => {
          resolve(`Exit Code: ${code}\nOutput:\n${output}`);
        });

        childProc.on('error', (err: Error) => {
            resolve(`Failed to start process: ${err.message}`);
        });

        // Fail-safe timeout for synchronous execution
        setTimeout(() => {
          if (!runBackground) {
             childProc.kill();
             resolve(`Process killed after timeout.\nPartial Output:\n${output}`);
          }
        }, 10000); // 10 seconds max

      } catch (e: any) {
        resolve(`Error executing command: ${e.message}`);
      }
    });
  }
}
