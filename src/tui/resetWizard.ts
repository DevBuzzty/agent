import inquirer from 'inquirer';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

export async function runResetWizard() {
  console.log("\n========================================");
  console.log("⚠️  CHYI - Reset & Wipe Menu");
  console.log("========================================\n");

  const { resetType } = await inquirer.prompt([
    {
      type: 'list',
      name: 'resetType',
      message: 'Welche Art von Reset möchtest du durchführen?',
      choices: [
        { name: '❌ Abbrechen (Zurück zum Menü)', value: 'cancel' },
        new inquirer.Separator(),
        { name: '1. Config Reset (Nur API-Keys und Modell-Einstellungen löschen)', value: 'config' },
        { name: '2. Config & Persona Reset (Configs + Identität/persona.md löschen)', value: 'persona' },
        { name: '3. Full Agent Reset (Configs, Persona UND komplette Chat-Historie/DB löschen)', value: 'full' },
        new inquirer.Separator(),
        { name: '🔥 4. Wipe / Uninstall (Agent stoppen, CLI entfernen und kompletten Ordner löschen)', value: 'wipe' }
      ]
    }
  ]);

  if (resetType === 'cancel') {
      return;
  }

  console.log("\nACHTUNG: Diese Aktion kann nicht rückgängig gemacht werden!");
  const { confirmation } = await inquirer.prompt([
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
  const rootDir = path.join(__dirname, '../../');
  const configJson = path.join(rootDir, 'config.json5');
  const envFile = path.join(rootDir, '.env');
  const personaFile = path.join(rootDir, 'knowledge_modules/workspace/persona.md');
  const databaseFile = path.join(rootDir, 'database.sqlite');
  const databaseWal = path.join(rootDir, 'database.sqlite-wal');
  const databaseShm = path.join(rootDir, 'database.sqlite-shm');
  const agentWorkspace = path.join(rootDir, 'agent_workspace');

  const safeDelete = (p: string) => {
      if (fs.existsSync(p)) {
          const stats = fs.statSync(p);
          if (stats.isDirectory()) {
              fs.rmSync(p, { recursive: true, force: true });
          } else {
              fs.unlinkSync(p);
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
          execSync(`node ${chyiBin} stop`, { stdio: 'ignore' });
          console.log("- Gateway Daemon gestoppt.");
      } catch (e) {}

      // Unlink global npm package
      try {
          execSync('npm unlink -g', { cwd: rootDir, stdio: 'ignore' });
          console.log("- Globales 'chyi' Command entfernt.");
      } catch (e) {
          console.log("- Konnte 'chyi' Command nicht entfernen (eventuell sudo nötig).");
      }

      console.log(`\n✅ Uninstall abgeschlossen!`);
      console.log(`Damit das Skript sich nicht selbst den Boden entzieht, musst du das Verzeichnis nun manuell löschen:`);
      console.log(`--> rm -rf ${rootDir}`);
      process.exit(0);
  }

  console.log("\n✅ Reset erfolgreich durchgeführt!");
}
