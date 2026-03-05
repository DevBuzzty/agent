"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.KnowledgeWatcher = void 0;
const chokidar = __importStar(require("chokidar"));
/**
 * File System Watcher that updates the loaded modules at runtime
 * whenever changes are detected, utilizing a 250ms debounce time.
 */
class KnowledgeWatcher {
    manager;
    dirs;
    watcher;
    debounceTimeout;
    constructor(manager, dirs) {
        this.manager = manager;
        this.dirs = dirs;
    }
    watch() {
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
    close() {
        if (this.watcher) {
            this.watcher.close();
        }
    }
}
exports.KnowledgeWatcher = KnowledgeWatcher;
