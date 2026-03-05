"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CalculatorTool = void 0;
const mathjs_1 = require("mathjs");
exports.CalculatorTool = {
    name: 'calculator',
    description: 'Evaluate a mathematical expression safely.',
    execute: async (args) => {
        try {
            // Use mathjs evaluate instead of dangerous eval()
            const result = (0, mathjs_1.evaluate)(args.expression);
            return String(result);
        }
        catch (e) {
            return `Error calculating expression: ${e.message}`;
        }
    }
};
