import inquirer from 'inquirer';
import { execSync } from 'child_process';
import path from 'path';
import { runOnboarding } from '../onboarding';
import { runSecurityDashboard } from './securityDashboard';
import { runKnowledgeWizard } from './knowledgeWizard';
import { runTerminalChat } from './chat';

export async function showMainMenu() {
  console.log("\n========================================");
  console.log("🤖 AI Agent Gateway - Central Dashboard");
  console.log("========================================\n");

  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'Was möchtest du tun?',
      choices: [
        { name: '🟢 Gateway Starten (Daemon)', value: 'start' },
        { name: '🔴 Gateway Stoppen', value: 'stop' },
        { name: '📊 Status prüfen', value: 'status' },
        { name: '📜 Live Logs ansehen', value: 'logs' },
        new inquirer.Separator(),
        { name: '💬 Terminal Chat & Bootstrap (Hatch)', value: 'chat' },
        { name: '🧠 Wissensmodul-Generator (Knowledge)', value: 'knowledge' },
        { name: '🛡️  Security & Policy Dashboard', value: 'security' },
        { name: '⚙️  Konfiguration (Onboarding & Reset)', value: 'config' },
        new inquirer.Separator(),
        { name: '🔄 System Updaten', value: 'update' },
        { name: '🚪 Beenden', value: 'exit' }
      ]
    }
  ]);

  const chyiBin = process.argv[1];

  switch (action) {
    case 'start':
    case 'stop':
    case 'status':
    case 'logs':
    case 'update':
      try { execSync(`node ${chyiBin} ${action}`, { stdio: 'inherit' }); } catch (e) {}
      break;
    case 'config':
      await runOnboarding();
      break;
    case 'security':
      await runSecurityDashboard();
      break;
    case 'knowledge':
      await runKnowledgeWizard();
      break;
    case 'chat':
      await runTerminalChat();
      break;
    case 'exit':
      console.log("Auf Wiedersehen!");
      process.exit(0);
  }

  if (['start', 'stop', 'status', 'update', 'security', 'knowledge'].includes(action)) {
      setTimeout(showMainMenu, 1500);
  }
}
