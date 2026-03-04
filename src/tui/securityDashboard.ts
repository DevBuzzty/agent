import inquirer from 'inquirer';
import { globalSecurityManager } from '../security/SecurityManager';

export async function runSecurityDashboard() {
  console.log("\n🛡️  Security & Policy Dashboard");
  console.log("Konfiguriere die 'Secure-by-Default' Beschränkungen des Agenten.\n");

  const currentFS = globalSecurityManager.canAccessFileSystem();
  const currentShell = globalSecurityManager.canAccessShell();

  const { policies } = await inquirer.prompt([
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

  globalSecurityManager.savePolicies(allowFS, allowShell);
  console.log("\n✅ Sicherheitsrichtlinien wurden erfolgreich aktualisiert!");
}
