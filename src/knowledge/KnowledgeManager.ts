import fs from 'fs';
import path from 'path';
import { ParsedModule, KnowledgeParser } from './KnowledgeParser';
import { KnowledgeGate } from './KnowledgeGate';

export interface HierarchyConfig {
  workspace: string;
  shared_machine: string;
  bundled: string;
}

/**
 * Manages the loading of domain knowledge modules into the LLM context.
 * Implements a strict priority hierarchy for naming conflicts:
 * Workspace > Shared Machine > Bundled Core
 */
export class KnowledgeManager {
  private parser: KnowledgeParser;
  private gate: KnowledgeGate;
  private config: HierarchyConfig;
  private activeModules: Map<string, ParsedModule> = new Map();

  constructor(config: HierarchyConfig) {
    this.config = config;
    this.parser = new KnowledgeParser();
    this.gate = new KnowledgeGate();
  }

  /**
   * Scans and loads modules from the hierarchy, applying runtime filters
   * and resolving naming conflicts deterministically.
   */
  public async refreshModules(): Promise<void> {
    const newActiveModules: Map<string, ParsedModule> = new Map();

    // The order of loading defines the priority.
    // We load lowest priority first, then overwrite with higher priorities.

    // 1. Bundled (Lowest Priority)
    this.loadFromDirectory(this.config.bundled, newActiveModules);

    // 2. Shared Machine
    this.loadFromDirectory(this.config.shared_machine, newActiveModules);

    // 3. Workspace (Highest Priority)
    this.loadFromDirectory(this.config.workspace, newActiveModules);

    this.activeModules = newActiveModules;
  }

  private loadFromDirectory(dirPath: string, map: Map<string, ParsedModule>): void {
    if (!fs.existsSync(dirPath)) return;

    // Scan the isolated directory
    const files = fs.readdirSync(dirPath);

    for (const file of files) {
      if (file.endsWith('.md')) {
        const fullPath = path.join(dirPath, file);
        try {
          const parsed = this.parser.parseFile(fullPath);
          parsed.location = fullPath;

          // Apply Runtime Filters (Load-time Gating)
          if (this.gate.evaluate(parsed.metadata || {})) {
            // Priority Resolution: Map overrides existant key
            map.set(parsed.name, parsed);
          } else {
             // Module filtered out due to host constraints
             console.log(`[KnowledgeManager] Module '${parsed.name}' filtered out by host constraints.`);
          }
        } catch (e: any) {
          console.warn(`[KnowledgeManager] Failed to load module ${fullPath}: ${e.message}`);
        }
      }
    }
  }

  public getLoadedModules(): ParsedModule[] {
    return Array.from(this.activeModules.values());
  }

  public getModule(name: string): ParsedModule | undefined {
    return this.activeModules.get(name);
  }

  /**
   * Deterministic calculation for the Token Overhead during Prompt Injection.
   * Formula: 195 characters base-overhead + SUM(97 chars + len(name) + len(desc) + len(loc)) for each loaded module.
   */
  public calculateTokenOverhead(): number {
    let overhead = 195; // Base overhead

    const modules = this.getLoadedModules();
    for (const mod of modules) {
      overhead += 97; // Per-module fixed overhead
      overhead += mod.name.length;
      overhead += mod.description.length;
      overhead += (mod.location ? mod.location.length : 0);
    }

    return overhead;
  }
}
