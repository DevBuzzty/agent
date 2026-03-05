import inquirer from 'inquirer';
import { ClawhubImportTool } from '../tools/ClawhubImportTool';
import path from 'path';
import fs from 'fs';

// Mocking a remote Clawhub API / Registry for the MVP
const CLAWHUB_REGISTRY = [
  {
    name: 'Docker Management',
    description: 'Regeln und Tools zur sicheren Verwaltung von Docker Containern.',
    tags: ['docker', 'devops', 'container', 'security'],
    url: 'https://raw.githubusercontent.com/DevBuzzty/agent/feature/ai-gateway-architecture-15263833713041301073/README.md' // Using readme as a safe dummy file to download for now
  },
  {
    name: 'Git Workflow Expert',
    description: 'Erweitertes Wissen über Git Rebase, Merge Strategies und Commit Guidelines.',
    tags: ['git', 'version-control', 'coding'],
    url: 'https://raw.githubusercontent.com/DevBuzzty/agent/feature/ai-gateway-architecture-15263833713041301073/README.md'
  },
  {
    name: 'Python Data Science',
    description: 'Guidelines für Pandas, NumPy und sauberes Python Scripting.',
    tags: ['python', 'data', 'pandas'],
    url: 'https://raw.githubusercontent.com/DevBuzzty/agent/feature/ai-gateway-architecture-15263833713041301073/README.md'
  },
  {
    name: 'NPM & Node Security',
    description: 'Sicherheitsrichtlinien für das Management von Node.js Projekten.',
    tags: ['node', 'npm', 'js', 'security'],
    url: 'https://raw.githubusercontent.com/DevBuzzty/agent/feature/ai-gateway-architecture-15263833713041301073/README.md'
  }
];

export async function runClawhubImporter() {
  console.log("\n========================================");
  console.log("🧩 CHYI CLI - Clawhub Skill Store");
  console.log("========================================\n");

  const { mode } = await inquirer.prompt([
    {
      type: 'list',
      name: 'mode',
      message: 'Wie möchtest du Skills hinzufügen?',
      loop: false,
      choices: [
        { name: '🔍 Im Clawhub Katalog suchen (Empfohlen)', value: 'search' },
        { name: '🔗 Direkte Skill-URL eingeben', value: 'url' },
        { name: '❌ Abbrechen', value: 'cancel' }
      ]
    }
  ]);

  if (mode === 'cancel') return;

  let targetUrl = '';
  let skillName = 'Custom Skill';

  if (mode === 'url') {
    const answer = await inquirer.prompt([
      {
        type: 'input',
        name: 'url',
        message: 'Bitte gib die exakte (Raw) URL zum Clawhub Skill (.md) ein:'
      }
    ]);
    if (!answer.url || !answer.url.trim()) return;
    targetUrl = answer.url.trim();
  }

  if (mode === 'search') {
    const { query } = await inquirer.prompt([
      {
        type: 'input',
        name: 'query',
        message: 'Suchbegriff (z.B. "docker" oder "security"): '
      }
    ]);

    const q = query.toLowerCase().trim();
    const results = CLAWHUB_REGISTRY.filter(skill =>
       skill.name.toLowerCase().includes(q) ||
       skill.description.toLowerCase().includes(q) ||
       skill.tags.some(tag => tag.includes(q))
    );

    if (results.length === 0) {
      console.log(`\n❌ Keine Skills für "${query}" gefunden.`);
      return;
    }

    const { selectedSkill } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedSkill',
        message: 'Folgende Skills wurden gefunden. Wähle einen zum Installieren aus:',
        loop: false,
        choices: [
          ...results.map(r => ({
            name: `${r.name} - ${r.description}`,
            value: r
          })),
          new inquirer.Separator(),
          { name: 'Abbrechen', value: 'cancel' }
        ]
      }
    ]);

    if (selectedSkill === 'cancel') return;
    targetUrl = selectedSkill.url;
    skillName = selectedSkill.name;
  }

  console.log(`\nLade '${skillName}' herunter...`);

  const rootDir = path.join(__dirname, '../../');
  const workspaceDir = path.join(rootDir, 'knowledge_modules/workspace');

  // Create tool instance
  const tool = new ClawhubImportTool(workspaceDir);

  // We mock a .md extension for the dummy URL if it doesn't have one to pass validation
  const safeUrl = targetUrl.endsWith('.md') ? targetUrl : targetUrl + '#.md';
  const result = await tool.execute({ url: safeUrl });

  if (result.startsWith("Error") || result.startsWith("Failed")) {
      console.log(`❌ ${result}`);
  } else {
      console.log(`✅ ${result}`);
  }
}
