import inquirer from 'inquirer';
import { ClawhubImportTool } from '../tools/ClawhubImportTool';
import path from 'path';

export async function runClawhubImporter() {
  console.log("\n========================================");
  console.log("🧩 CHYI CLI - Clawhub Skill Importer");
  console.log("========================================\n");

  const { url } = await inquirer.prompt([
    {
      type: 'input',
      name: 'url',
      message: 'Bitte gib die exakte (Raw) URL zum Clawhub Skill (.md) ein:'
    }
  ]);

  if (!url || !url.trim()) {
      console.log("Abbruch.");
      return;
  }

  console.log("\nLade Skill herunter...");

  // Resolve workspace relative to dist/tui
  const rootDir = path.join(__dirname, '../../');
  const workspaceDir = path.join(rootDir, 'knowledge_modules/workspace');

  const tool = new ClawhubImportTool(workspaceDir);

  const result = await tool.execute({ url: url.trim() });

  if (result.startsWith("Error") || result.startsWith("Failed")) {
      console.log(`❌ ${result}`);
  } else {
      console.log(`✅ ${result}`);
  }
}
