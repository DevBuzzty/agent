"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.KnowledgeManager = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const KnowledgeParser_1 = require("./KnowledgeParser");
const KnowledgeGate_1 = require("./KnowledgeGate");
/**
 * Manages the loading of domain knowledge modules into the LLM context.
 * Implements a strict priority hierarchy for naming conflicts:
 * Workspace > Shared Machine > Bundled Core
 */
class KnowledgeManager {
    parser;
    gate;
    config;
    activeModules = new Map();
    constructor(config) {
        this.config = config;
        this.parser = new KnowledgeParser_1.KnowledgeParser();
        this.gate = new KnowledgeGate_1.KnowledgeGate();
    }
    /**
     * Scans and loads modules from the hierarchy, applying runtime filters
     * and resolving naming conflicts deterministically.
     */
    async refreshModules() {
        const newActiveModules = new Map();
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
    loadFromDirectory(dirPath, map) {
        if (!fs_1.default.existsSync(dirPath))
            return;
        // Scan the isolated directory
        const files = fs_1.default.readdirSync(dirPath);
        for (const file of files) {
            if (file.endsWith('.md')) {
                const fullPath = path_1.default.join(dirPath, file);
                try {
                    const parsed = this.parser.parseFile(fullPath);
                    parsed.location = fullPath;
                    // Apply Runtime Filters (Load-time Gating)
                    if (this.gate.evaluate(parsed.metadata || {})) {
                        // Priority Resolution: Map overrides existant key
                        map.set(parsed.name, parsed);
                    }
                    else {
                        // Module filtered out due to host constraints
                        console.log(`[KnowledgeManager] Module '${parsed.name}' filtered out by host constraints.`);
                    }
                }
                catch (e) {
                    console.warn(`[KnowledgeManager] Failed to load module ${fullPath}: ${e.message}`);
                }
            }
        }
    }
    getLoadedModules() {
        return Array.from(this.activeModules.values());
    }
    getModule(name) {
        return this.activeModules.get(name);
    }
    /**
     * Deterministic calculation for the Token Overhead during Prompt Injection.
     * Formula: 195 characters base-overhead + SUM(97 chars + len(name) + len(desc) + len(loc)) for each loaded module.
     */
    calculateTokenOverhead() {
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
exports.KnowledgeManager = KnowledgeManager;
