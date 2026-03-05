#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = require("dotenv");
const commander_1 = require("commander");
const child_process_1 = require("child_process");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// Load environment variables for the CLI commands (especially the Hatch Chat)
(0, dotenv_1.config)({ path: path_1.default.join(__dirname, '../.env') });
const program = new commander_1.Command();
const PID_FILE = path_1.default.join(__dirname, '../gateway.pid');
const LOG_FILE = path_1.default.join(__dirname, '../gateway.log');
program
    .name('chyi')
    .description('AI Agent Gateway - Command Line Interface')
    .version('1.0.0');
program
    .command('config')
    .description('Run interactive onboarding to set API keys and LLM configuration')
    .action(async () => {
    const { runOnboarding } = await Promise.resolve().then(() => __importStar(require('./onboarding')));
    await runOnboarding();
});
program
    .command('start')
    .description('Start the AI Agent Gateway background daemon')
    .action(() => {
    if (fs_1.default.existsSync(PID_FILE)) {
        const pid = fs_1.default.readFileSync(PID_FILE, 'utf-8');
        try {
            process.kill(parseInt(pid, 10), 0);
            console.log(`[chyi] Gateway is already running with PID ${pid}.`);
            return;
        }
        catch (e) {
            // Process is dead, cleanup stale PID
            fs_1.default.unlinkSync(PID_FILE);
        }
    }
    console.log("[chyi] Starting Gateway in the background...");
    const indexPath = path_1.default.join(__dirname, 'index.js');
    // Spawn detached process
    const out = fs_1.default.openSync(LOG_FILE, 'a');
    const err = fs_1.default.openSync(LOG_FILE, 'a');
    const child = (0, child_process_1.spawn)(process.execPath, [indexPath], {
        detached: true,
        stdio: ['ignore', out, err]
    });
    if (child.pid) {
        fs_1.default.writeFileSync(PID_FILE, child.pid.toString(), 'utf-8');
        child.unref(); // allow the CLI process to exit independently
        console.log(`[chyi] ✅ Gateway started successfully (PID: ${child.pid}).`);
        console.log(`[chyi] Use 'chyi logs' to view the output.`);
    }
    else {
        console.error("[chyi] ❌ Failed to start Gateway.");
    }
});
program
    .command('stop')
    .description('Stop the running Gateway daemon')
    .action(() => {
    if (!fs_1.default.existsSync(PID_FILE)) {
        console.log("[chyi] No Gateway process is currently running.");
        return;
    }
    const pid = fs_1.default.readFileSync(PID_FILE, 'utf-8');
    try {
        process.kill(parseInt(pid, 10)); // SIGTERM
        console.log(`[chyi] ✅ Gateway process ${pid} stopped.`);
    }
    catch (e) {
        console.log(`[chyi] Failed to stop process ${pid}. It might have already exited.`);
    }
    fs_1.default.unlinkSync(PID_FILE);
});
program
    .command('status')
    .description('Check if the Gateway is running')
    .action(() => {
    if (!fs_1.default.existsSync(PID_FILE)) {
        console.log("[chyi] Gateway is OFFLINE.");
        return;
    }
    const pid = fs_1.default.readFileSync(PID_FILE, 'utf-8');
    try {
        process.kill(parseInt(pid, 10), 0); // Check if alive
        console.log(`[chyi] Gateway is ONLINE and running (PID: ${pid}).`);
    }
    catch (e) {
        console.log("[chyi] Gateway is OFFLINE (stale PID file found and removed).");
        fs_1.default.unlinkSync(PID_FILE);
    }
});
program
    .action(async () => {
    // If no command is provided, show the interactive main menu
    const { showMainMenu } = await Promise.resolve().then(() => __importStar(require('./tui/mainMenu')));
    await showMainMenu();
});
program
    .command('knowledge')
    .description('Open the interactive Knowledge Module Generator Wizard')
    .action(async () => {
    const { runKnowledgeWizard } = await Promise.resolve().then(() => __importStar(require('./tui/knowledgeWizard')));
    await runKnowledgeWizard();
});
program
    .command('chat')
    .description('Start a local terminal chat with the Agent')
    .action(async () => {
    const { runTerminalChat } = await Promise.resolve().then(() => __importStar(require('./tui/chat')));
    await runTerminalChat();
});
program
    .command('security')
    .description('Open the interactive Security & Policy Dashboard')
    .action(async () => {
    const { runSecurityDashboard } = await Promise.resolve().then(() => __importStar(require('./tui/securityDashboard')));
    await runSecurityDashboard();
});
program
    .command('logs')
    .description('Tail the live logs of the Gateway daemon')
    .action(() => {
    if (!fs_1.default.existsSync(LOG_FILE)) {
        console.log("[chyi] No logs found yet. Start the gateway first.");
        return;
    }
    console.log(`[chyi] Tailing ${LOG_FILE}... (Press Ctrl+C to exit)\n`);
    // Using native tail for simplicity in the PoC. Note: Works on Unix.
    const tail = (0, child_process_1.spawn)('tail', ['-f', LOG_FILE], { stdio: 'inherit' });
    tail.on('error', (err) => {
        console.error(`[chyi] Error tailing logs: ${err.message}. Your OS might not support 'tail'.`);
    });
});
program
    .command('update')
    .description('Download and install the latest updates for the AI Agent Gateway')
    .action(() => {
    console.log("[chyi] Initiating safe auto-update process...");
    // Determine the root directory of the globally installed chyi package
    const rootDir = path_1.default.join(__dirname, '..');
    // We execute the raw install.sh script directly from GitHub, passing the --update flag.
    // This allows the script to safely pull the latest git branch, recompile, and preserve the user's config.json5/.env files.
    const updateCommand = 'curl -fsSL https://raw.githubusercontent.com/DevBuzzty/agent/refs/heads/feature/ai-gateway-architecture-15263833713041301073/install.sh | bash -s -- --update';
    try {
        // It is CRITICAL to set the cwd to the actual installation directory,
        // because chyi can be called from anywhere by the user via global symlink.
        (0, child_process_1.execSync)(updateCommand, { stdio: 'inherit', cwd: rootDir });
    }
    catch (e) {
        console.error(`[chyi] Update failed. Error: ${e.message}`);
    }
});
program.parse(process.argv);
