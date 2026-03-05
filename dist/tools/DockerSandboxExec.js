"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDockerCmd = buildDockerCmd;
// Just to test and verify the fix for the shell arguments splitting in Sandbox Manager
function buildDockerCmd(commandArgs) {
    return commandArgs.map(arg => {
        // Enclose arguments with spaces in quotes, escape inner quotes
        if (arg.includes(' ')) {
            return `"${arg.replace(/"/g, '\\"')}"`;
        }
        return arg;
    }).join(' ');
}
