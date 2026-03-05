"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecurePathResolver = void 0;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
/**
 * Hardens the system against Symlink Breakouts and path traversals.
 * Resolves paths strictly relative to a dedicated workspace.
 */
class SecurePathResolver {
    workspaceRoot;
    constructor(workspacePath) {
        // Resolve strictly
        this.workspaceRoot = path_1.default.resolve(workspacePath);
        if (!fs_1.default.existsSync(this.workspaceRoot)) {
            fs_1.default.mkdirSync(this.workspaceRoot, { recursive: true });
        }
    }
    /**
     * Safely resolves a requested path and guarantees it resides within the workspace boundary.
     */
    resolveSafePath(requestedPath) {
        // 1. Resolve the path relative to the root to neutralize traversal characters (e.g. '../')
        const resolvedPath = path_1.default.resolve(this.workspaceRoot, requestedPath);
        // 2. Symlink checks (Ensure the real, absolute path is also within the workspace)
        let realPath;
        try {
            realPath = fs_1.default.realpathSync(resolvedPath);
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                // File doesn't exist yet; validate the resolved target's location
                realPath = resolvedPath;
            }
            else {
                throw new Error(`[Security] Error resolving file path: ${error.message}`);
            }
        }
        if (!realPath.startsWith(this.workspaceRoot + path_1.default.sep) && realPath !== this.workspaceRoot) {
            throw new Error(`[Security Violation] Path Traversal or Symlink Breakout Attempted. Access Denied to: ${requestedPath}`);
        }
        return realPath;
    }
}
exports.SecurePathResolver = SecurePathResolver;
