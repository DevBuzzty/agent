"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runSecurityDashboard = runSecurityDashboard;
const inquirer_1 = __importDefault(require("inquirer"));
const SecurityManager_1 = require("../security/SecurityManager");
async function runSecurityDashboard() {
    console.log("\n🛡️  Security & Policy Dashboard");
    console.log("Konfiguriere die 'Secure-by-Default' Beschränkungen des Agenten.\n");
    const currentFS = SecurityManager_1.globalSecurityManager.canAccessFileSystem();
    const currentShell = SecurityManager_1.globalSecurityManager.canAccessShell();
    const { policies } = await inquirer_1.default.prompt([
        {
            type: 'checkbox',
            name: 'policies',
            message: 'Welche Berechtigungen möchtest du dem Agenten erteilen? (Leertaste = An/Aus)',
            choices: [
                { name: ' Dateisystem-Zugriff erlauben (Workspace)', value: 'fs', checked: currentFS },
                { name: ' Shell/Terminal-Zugriff erlauben (Exec Tool)', value: 'shell', checked: currentShell }
            ]
        }
    ]);
    const allowFS = policies.includes('fs');
    const allowShell = policies.includes('shell');
    SecurityManager_1.globalSecurityManager.savePolicies(allowFS, allowShell);
    console.log("\n✅ Sicherheitsrichtlinien wurden erfolgreich aktualisiert!");
}
