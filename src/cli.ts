#!/usr/bin/env node
import { Command } from 'commander';
import { spawn, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const program = new Command();
const PID_FILE = path.join(__dirname, '../gateway.pid');
const LOG_FILE = path.join(__dirname, '../gateway.log');

program
  .name('chyi')
  .description('AI Agent Gateway - Command Line Interface')
  .version('1.0.0');

program
  .command('config')
  .description('Run interactive onboarding to set API keys and LLM configuration')
  .action(async () => {
    const { runOnboarding } = await import('./onboarding');
    await runOnboarding();
  });

program
  .command('start')
  .description('Start the AI Agent Gateway background daemon')
  .action(() => {
    if (fs.existsSync(PID_FILE)) {
      const pid = fs.readFileSync(PID_FILE, 'utf-8');
      try {
        process.kill(parseInt(pid, 10), 0);
        console.log(`[chyi] Gateway is already running with PID ${pid}.`);
        return;
      } catch (e) {
        // Process is dead, cleanup stale PID
        fs.unlinkSync(PID_FILE);
      }
    }

    console.log("[chyi] Starting Gateway in the background...");
    const indexPath = path.join(__dirname, 'index.js');

    // Spawn detached process
    const out = fs.openSync(LOG_FILE, 'a');
    const err = fs.openSync(LOG_FILE, 'a');

    const child = spawn(process.execPath, [indexPath], {
      detached: true,
      stdio: ['ignore', out, err]
    });

    if (child.pid) {
      fs.writeFileSync(PID_FILE, child.pid.toString(), 'utf-8');
      child.unref(); // allow the CLI process to exit independently
      console.log(`[chyi] ✅ Gateway started successfully (PID: ${child.pid}).`);
      console.log(`[chyi] Use 'chyi logs' to view the output.`);
    } else {
      console.error("[chyi] ❌ Failed to start Gateway.");
    }
  });

program
  .command('stop')
  .description('Stop the running Gateway daemon')
  .action(() => {
    if (!fs.existsSync(PID_FILE)) {
      console.log("[chyi] No Gateway process is currently running.");
      return;
    }

    const pid = fs.readFileSync(PID_FILE, 'utf-8');
    try {
      process.kill(parseInt(pid, 10)); // SIGTERM
      console.log(`[chyi] ✅ Gateway process ${pid} stopped.`);
    } catch (e: any) {
      console.log(`[chyi] Failed to stop process ${pid}. It might have already exited.`);
    }

    fs.unlinkSync(PID_FILE);
  });

program
  .command('status')
  .description('Check if the Gateway is running')
  .action(() => {
    if (!fs.existsSync(PID_FILE)) {
      console.log("[chyi] Gateway is OFFLINE.");
      return;
    }

    const pid = fs.readFileSync(PID_FILE, 'utf-8');
    try {
      process.kill(parseInt(pid, 10), 0); // Check if alive
      console.log(`[chyi] Gateway is ONLINE and running (PID: ${pid}).`);
    } catch (e) {
      console.log("[chyi] Gateway is OFFLINE (stale PID file found and removed).");
      fs.unlinkSync(PID_FILE);
    }
  });

program
  .command('logs')
  .description('Tail the live logs of the Gateway daemon')
  .action(() => {
    if (!fs.existsSync(LOG_FILE)) {
      console.log("[chyi] No logs found yet. Start the gateway first.");
      return;
    }

    console.log(`[chyi] Tailing ${LOG_FILE}... (Press Ctrl+C to exit)\n`);

    // Using native tail for simplicity in the PoC. Note: Works on Unix.
    const tail = spawn('tail', ['-f', LOG_FILE], { stdio: 'inherit' });

    tail.on('error', (err) => {
        console.error(`[chyi] Error tailing logs: ${err.message}. Your OS might not support 'tail'.`);
    });
  });

program.parse(process.argv);
