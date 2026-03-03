/**
 * Implements a "Secure-by-Default" architecture.
 * The agent has zero shell or file system access by default until explicitly granted by an administrator.
 */
export class SecurityManager {
  private fileSystemAllowed: boolean = false;
  private shellAllowed: boolean = false;

  constructor(options?: { allowFileSystem?: boolean, allowShell?: boolean }) {
    if (options) {
      this.fileSystemAllowed = options.allowFileSystem || false;
      this.shellAllowed = options.allowShell || false;
    }
  }

  public allowFileSystemAccess(): void {
    console.warn("[Security] WARNING: File System access explicitly granted by Administrator.");
    this.fileSystemAllowed = true;
  }

  public allowShellAccess(): void {
    console.warn("[Security] WARNING: Shell access explicitly granted by Administrator.");
    this.shellAllowed = true;
  }

  public canAccessFileSystem(): boolean {
    return this.fileSystemAllowed;
  }

  public canAccessShell(): boolean {
    return this.shellAllowed;
  }
}

export const globalSecurityManager = new SecurityManager();
