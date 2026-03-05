"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalSecurityManager = exports.SecurityManager = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
/**
 * Implements a "Secure-by-Default" architecture.
 * The agent has zero shell or file system access by default until explicitly granted by an administrator.
 */
class SecurityManager {
    fileSystemAllowed = false;
    shellAllowed = false;
    policyFilePath;
    constructor() {
        this.policyFilePath = path_1.default.join(__dirname, '../../agent_workspace/policies.json');
        this.loadPolicies();
    }
    loadPolicies() {
        try {
            if (fs_1.default.existsSync(this.policyFilePath)) {
                const data = JSON.parse(fs_1.default.readFileSync(this.policyFilePath, 'utf8'));
                this.fileSystemAllowed = !!data.allowFileSystem;
                this.shellAllowed = !!data.allowShell;
            }
        }
        catch (e) {
            console.warn("[Security] Could not load policies. Defaults to Deny-All.");
        }
    }
    savePolicies(allowFS, allowShell) {
        this.fileSystemAllowed = allowFS;
        this.shellAllowed = allowShell;
        const dir = path_1.default.dirname(this.policyFilePath);
        if (!fs_1.default.existsSync(dir))
            fs_1.default.mkdirSync(dir, { recursive: true });
        fs_1.default.writeFileSync(this.policyFilePath, JSON.stringify({
            allowFileSystem: this.fileSystemAllowed,
            allowShell: this.shellAllowed
        }, null, 2));
        console.log("[Security] Policies updated and persisted.");
    }
    canAccessFileSystem() {
        return this.fileSystemAllowed;
    }
    canAccessShell() {
        return this.shellAllowed;
    }
}
exports.SecurityManager = SecurityManager;
exports.globalSecurityManager = new SecurityManager();
