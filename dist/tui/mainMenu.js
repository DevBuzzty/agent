"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.showMainMenu = showMainMenu;
const inquirer_1 = __importDefault(require("inquirer"));
const child_process_1 = require("child_process");
const onboarding_1 = require("../onboarding");
const securityDashboard_1 = require("./securityDashboard");
const knowledgeWizard_1 = require("./knowledgeWizard");
const chat_1 = require("./chat");
async function showMainMenu() {
    console.log("\n========================================");
    console.log("🤖 AI Agent Gateway - Central Dashboard");
    console.log("========================================\n");
    const { action } = await inquirer_1.default.prompt([
        {
            type: 'list',
            name: 'action',
            message: 'Was möchtest du tun?',
            choices: [
                { name: '🟢 Gateway Starten (Daemon)', value: 'start' },
                { name: '🔴 Gateway Stoppen', value: 'stop' },
                { name: '📊 Status prüfen', value: 'status' },
                { name: '📜 Live Logs ansehen', value: 'logs' },
                new inquirer_1.default.Separator(),
                { name: '💬 Terminal Chat & Bootstrap (Hatch)', value: 'chat' },
                { name: '🧠 Wissensmodul-Generator (Knowledge)', value: 'knowledge' },
                { name: '🛡️  Security & Policy Dashboard', value: 'security' },
                { name: '⚙️  Konfiguration (Onboarding & Reset)', value: 'config' },
                new inquirer_1.default.Separator(),
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
            try {
                (0, child_process_1.execSync)(`node ${chyiBin} ${action}`, { stdio: 'inherit' });
            }
            catch (e) { }
            break;
        case 'config':
            await (0, onboarding_1.runOnboarding)();
            break;
        case 'security':
            await (0, securityDashboard_1.runSecurityDashboard)();
            break;
        case 'knowledge':
            await (0, knowledgeWizard_1.runKnowledgeWizard)();
            break;
        case 'chat':
            await (0, chat_1.runTerminalChat)();
            break;
        case 'exit':
            console.log("Auf Wiedersehen!");
            process.exit(0);
    }
    if (['start', 'stop', 'status', 'update', 'security', 'knowledge'].includes(action)) {
        setTimeout(showMainMenu, 1500);
    }
}
