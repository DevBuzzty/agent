import * as chokidar from 'chokidar';
import { KnowledgeManager } from './KnowledgeManager';

/**
 * File System Watcher that updates the loaded modules at runtime
 * whenever changes are detected, utilizing a 250ms debounce time.
 */
export class KnowledgeWatcher {
  private manager: KnowledgeManager;
  private dirs: string[];
  private watcher?: chokidar.FSWatcher;
  private debounceTimeout?: NodeJS.Timeout;

  constructor(manager: KnowledgeManager, dirs: string[]) {
    this.manager = manager;
    this.dirs = dirs;
  }

  public watch(): void {
    // Watch only the .md files in the relevant hierarchy directories
    this.watcher = chokidar.watch(this.dirs.map(d => `${d}/*.md`), {
      persistent: true,
      ignoreInitial: true, // We already load them initially
    });

    // 250 Milliseconds Debounce Logic
    const debounceRefresh = () => {
      if (this.debounceTimeout) {
        clearTimeout(this.debounceTimeout);
      }
      this.debounceTimeout = setTimeout(() => {
        console.log(`[KnowledgeWatcher] Changes detected. Refreshing knowledge modules...`);
        this.manager.refreshModules().catch(err => {
            console.error(`[KnowledgeWatcher] Error refreshing modules: ${err.message}`);
        });
      }, 250);
    };

    this.watcher
      .on('add', debounceRefresh)
      .on('change', debounceRefresh)
      .on('unlink', debounceRefresh);

    console.log(`[KnowledgeWatcher] Watching directories for knowledge module changes.`);
  }

  public close(): void {
    if (this.watcher) {
      this.watcher.close();
    }
  }
}
