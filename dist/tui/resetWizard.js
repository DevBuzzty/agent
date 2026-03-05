"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runResetWizard = runResetWizard;
const inquirer_1 = __importDefault(require("inquirer"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
async function runResetWizard() {
    console.log("\n========================================");
    console.log("⚠️  CHYI - Reset & Wipe Menu");
    console.log("========================================\n");
    const { resetType } = await inquirer_1.default.prompt([
        {
            type: 'list',
            name: 'resetType',
            message: 'Welche Art von Reset möchtest du durchführen?',
            choices: [
                { name: '❌ Abbrechen (Zurück zum Menü)', value: 'cancel' },
                new inquirer_1.default.Separator(),
                { name: '1. Config Reset (Nur API-Keys und Modell-Einstellungen löschen)', value: 'config' },
                { name: '2. Config & Persona Reset (Configs + Identität/persona.md löschen)', value: 'persona' },
                { name: '3. Full Agent Reset (Configs, Persona UND komplette Chat-Historie/DB löschen)', value: 'full' },
                new inquirer_1.default.Separator(),
                { name: '🔥 4. Wipe / Uninstall (Agent stoppen, CLI entfernen und kompletten Ordner löschen)', value: 'wipe' }
            ]
        }
    ]);
    if (resetType === 'cancel') {
        return;
    }
    console.log("\nACHTUNG: Diese Aktion kann nicht rückgängig gemacht werden!");
    const { confirmation } = await inquirer_1.default.prompt([
        {
            type: 'input',
            name: 'confirmation',
            message: 'Bitte tippe genau "yes" (ohne Anführungszeichen) um zu bestätigen, oder "no" zum Abbrechen:'
        }
    ]);
    if (confirmation.toLowerCase() !== 'yes') {
        console.log("Abbruch. Nichts wurde gelöscht.");
        return;
    }
    // --- Paths ---
    const rootDir = path_1.default.join(__dirname, '../../');
    const configJson = path_1.default.join(rootDir, 'config.json5');
    const envFile = path_1.default.join(rootDir, '.env');
    const personaFile = path_1.default.join(rootDir, 'knowledge_modules/workspace/persona.md');
    const databaseFile = path_1.default.join(rootDir, 'database.sqlite');
    const databaseWal = path_1.default.join(rootDir, 'database.sqlite-wal');
    const databaseShm = path_1.default.join(rootDir, 'database.sqlite-shm');
    const agentWorkspace = path_1.default.join(rootDir, 'agent_workspace');
    const safeDelete = (p) => {
        if (fs_1.default.existsSync(p)) {
            const stats = fs_1.default.statSync(p);
            if (stats.isDirectory()) {
                fs_1.default.rmSync(p, { recursive: true, force: true });
            }
            else {
                fs_1.default.unlinkSync(p);
            }
            console.log(`- Gelöscht: ${p}`);
        }
    };
    // --- Execution ---
    if (['config', 'persona', 'full', 'wipe'].includes(resetType)) {
        console.log("\nLösche Konfiguration...");
        safeDelete(configJson);
        safeDelete(envFile);
    }
    if (['persona', 'full', 'wipe'].includes(resetType)) {
        console.log("Lösche Persona...");
        safeDelete(personaFile);
    }
    if (['full', 'wipe'].includes(resetType)) {
        console.log("Lösche Datenbank und Workspace...");
        safeDelete(databaseFile);
        safeDelete(databaseWal);
        safeDelete(databaseShm);
        safeDelete(agentWorkspace);
    }
    if (resetType === 'wipe') {
        console.log("\n🔥 Starte vollständigen Wipe/Uninstall...");
        // Stop daemon if running
        const chyiBin = process.argv[1];
        try {
            (0, child_process_1.execSync)(`node ${chyiBin} stop`, { stdio: 'ignore' });
            console.log("- Gateway Daemon gestoppt.");
        }
        catch (e) { }
        // Unlink global npm package
        try {
            (0, child_process_1.execSync)('npm unlink -g', { cwd: rootDir, stdio: 'ignore' });
            console.log("- Globales 'chyi' Command entfernt.");
        }
        catch (e) {
            console.log("- Konnte 'chyi' Command nicht entfernen (eventuell sudo nötig).");
        }
        console.log(`\n✅ Uninstall abgeschlossen!`);
        console.log(`Damit das Skript sich nicht selbst den Boden entzieht, musst du das Verzeichnis nun manuell löschen:`);
        console.log(`--> rm -rf ${rootDir}`);
        process.exit(0);
    }
    console.log("\n✅ Reset erfolgreich durchgeführt!");
}
