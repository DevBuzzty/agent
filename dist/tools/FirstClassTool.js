"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseTool = void 0;
/**
 * Base class to simplify tool creation.
 */
class BaseTool {
    getSystemPromptText() {
        const paramsStr = JSON.stringify(this.parameters, null, 2);
        return `Tool Name: ${this.name}\nDescription: ${this.description}\nParameters JSON Schema:\n${paramsStr}\n`;
    }
}
exports.BaseTool = BaseTool;
