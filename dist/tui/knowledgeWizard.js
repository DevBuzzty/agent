"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runKnowledgeWizard = runKnowledgeWizard;
const inquirer_1 = __importDefault(require("inquirer"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
async function runKnowledgeWizard() {
    console.log("\n🧠 Wissensmodul-Generator (Progressive Disclosure)");
    console.log("Erstelle ein perfekt formatiertes Modul für den KI-Kontext.\n");
    const answers = await inquirer_1.default.prompt([
        {
            type: 'input',
            name: 'name',
            message: 'Name des Moduls (z.B. "DockerRules"):',
            validate: (input) => input.trim() !== '' ? true : 'Name darf nicht leer sein.'
        },
        {
            type: 'input',
            name: 'description',
            message: 'Kurze Beschreibung (1 Zeile):'
        },
        {
            type: 'input',
            name: 'bins',
            message: 'Benötigte Programme im PATH? (Komma-getrennt, z.B. "docker, python" - oder leer lassen):'
        },
        {
            type: 'checkbox',
            name: 'os',
            message: 'Auf welchen Betriebssystemen soll das Modul geladen werden?',
            choices: [
                { name: 'Linux', value: 'linux', checked: true },
                { name: 'Mac OS (Darwin)', value: 'darwin', checked: true },
                { name: 'Windows', value: 'win32', checked: true }
            ]
        },
        {
            type: 'editor',
            name: 'instructions',
            message: 'Öffne den Editor, um die Markdown-Instruktionen für die KI zu schreiben:'
        }
    ]);
    // Construct JSON metadata
    const metadata = { os: answers.os };
    const bins = answers.bins.split(',').map((s) => s.trim()).filter(Boolean);
    if (bins.length > 0) {
        metadata.requires = { bins };
    }
    const fileContent = `---
name: "${answers.name}"
description: "${answers.description}"
---
${JSON.stringify(metadata)}
---
${answers.instructions}
`;
    const filename = answers.name.toLowerCase().replace(/[^a-z0-9]/g, '_') + '.md';
    // Note: __dirname in dist/tui is two levels deep, so we go up two levels to hit project root
    const workspaceDir = path_1.default.join(__dirname, '../../knowledge_modules/workspace');
    if (!fs_1.default.existsSync(workspaceDir)) {
        fs_1.default.mkdirSync(workspaceDir, { recursive: true });
    }
    const filePath = path_1.default.join(workspaceDir, filename);
    fs_1.default.writeFileSync(filePath, fileContent, 'utf-8');
    console.log(`\n✅ Wissensmodul erfolgreich erstellt!`);
    console.log(`Pfad: ${filePath}`);
    console.log(`Das Modul wird vom Gateway automatisch erkannt (Hot-Reloading).`);
}
