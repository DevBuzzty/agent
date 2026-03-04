import fs from 'fs';
import path from 'path';

/**
 * Implements a "Secure-by-Default" architecture.
 * The agent has zero shell or file system access by default until explicitly granted by an administrator.
 */
export class SecurityManager {
  private fileSystemAllowed: boolean = false;
  private shellAllowed: boolean = false;
  private policyFilePath: string;

  constructor() {
    this.policyFilePath = path.join(__dirname, '../../agent_workspace/policies.json');
    this.loadPolicies();
  }

  private loadPolicies() {
    try {
      if (fs.existsSync(this.policyFilePath)) {
        const data = JSON.parse(fs.readFileSync(this.policyFilePath, 'utf8'));
        this.fileSystemAllowed = !!data.allowFileSystem;
        this.shellAllowed = !!data.allowShell;
      }
    } catch (e) {
       console.warn("[Security] Could not load policies. Defaults to Deny-All.");
    }
  }

  public savePolicies(allowFS: boolean, allowShell: boolean) {
    this.fileSystemAllowed = allowFS;
    this.shellAllowed = allowShell;

    const dir = path.dirname(this.policyFilePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    fs.writeFileSync(this.policyFilePath, JSON.stringify({
      allowFileSystem: this.fileSystemAllowed,
      allowShell: this.shellAllowed
    }, null, 2));

    console.log("[Security] Policies updated and persisted.");
  }

  public canAccessFileSystem(): boolean {
    return this.fileSystemAllowed;
  }

  public canAccessShell(): boolean {
    return this.shellAllowed;
  }
}

export const globalSecurityManager = new SecurityManager();
