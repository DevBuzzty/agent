"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createFileReaderTool = void 0;
const promises_1 = __importDefault(require("fs/promises"));
const SecurityManager_1 = require("../security/SecurityManager");
const createFileReaderTool = (pathResolver) => ({
    name: 'file_reader',
    description: 'Read the contents of a text file from disk securely.',
    execute: async (args) => {
        try {
            if (!SecurityManager_1.globalSecurityManager.canAccessFileSystem()) {
                return "Error: File system access is explicitly denied by the security policy.";
            }
            // Secure path resolution to prevent symlink breakouts and path traversal
            const safePath = pathResolver.resolveSafePath(args.filepath);
            const content = await promises_1.default.readFile(safePath, 'utf-8');
            return content;
        }
        catch (e) {
            return `Error reading file: ${e.message}`;
        }
    }
});
exports.createFileReaderTool = createFileReaderTool;
