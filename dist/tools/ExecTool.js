"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExecTool = void 0;
const FirstClassTool_1 = require("./FirstClassTool");
const child_process_1 = require("child_process");
const SecurityManager_1 = require("../security/SecurityManager");
/**
 * An integrated 'exec' tool supporting pseudo-terminal simulation
 * and auto-backgrounding functionality for asynchronous processes.
 */
class ExecTool extends FirstClassTool_1.BaseTool {
    name = 'exec';
    description = 'Executes a shell command. Supports pseudo-terminal (pty) and auto-backgrounding for long-running processes.';
    parameters = {
        type: 'object',
        properties: {
            command: { type: 'string', description: 'The shell command or executable path.' },
            args: { type: 'array', items: { type: 'string' }, description: 'Arguments to pass to the command.' },
            pty: { type: 'boolean', description: 'Enable pseudo-terminal (pty) support.' },
            background: { type: 'boolean', description: 'Run the process in the background asynchronously.' }
        },
        required: ['command']
    };
    backgroundProcesses = new Map();
    sandboxId;
    constructor(sandboxId) {
        super();
        this.sandboxId = sandboxId;
    }
    async execute(args) {
        if (!SecurityManager_1.globalSecurityManager.canAccessShell()) {
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
            const safeArgs = commandArgs.map(arg => arg.includes(' ') ? `"${arg.replace(/"/g, '\\"')}"` : arg).join(' ');
            const fullInnerCmd = `${args.command} ${safeArgs}`;
            spawnArgs = ['exec', '-i', `sandbox_${this.sandboxId}`, 'sh', '-c', fullInnerCmd];
        }
        return new Promise((resolve) => {
            try {
                const childProc = (0, child_process_1.spawn)(spawnCmd, spawnArgs, {
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
                childProc.stdout?.on('data', (data) => {
                    output += data.toString();
                });
                childProc.stderr?.on('data', (data) => {
                    output += data.toString();
                });
                childProc.on('close', (code) => {
                    resolve(`Exit Code: ${code}\nOutput:\n${output}`);
                });
                childProc.on('error', (err) => {
                    resolve(`Failed to start process: ${err.message}`);
                });
                // Fail-safe timeout for synchronous execution
                setTimeout(() => {
                    if (!runBackground) {
                        childProc.kill();
                        resolve(`Process killed after timeout.\nPartial Output:\n${output}`);
                    }
                }, 10000); // 10 seconds max
            }
            catch (e) {
                resolve(`Error executing command: ${e.message}`);
            }
        });
    }
}
exports.ExecTool = ExecTool;
