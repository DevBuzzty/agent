"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoopDetectionTool = void 0;
const FirstClassTool_1 = require("./FirstClassTool");
/**
 * An algorithmic guardrail tool presented to the LLM. It allows the LLM to explicitly
 * ask the system if it is stuck in a loop, though the system also checks this automatically.
 */
class LoopDetectionTool extends FirstClassTool_1.BaseTool {
    name = 'loop_detection';
    description = 'Algorithmically checks the current conversation history for endless loops (genericRepeat, knownPollNoProgress, pingPong). Call this if you feel stuck.';
    parameters = {
        type: 'object',
        properties: {
            check: { type: 'boolean', description: 'Set to true to perform the loop detection check.' }
        },
        required: ['check']
    };
    detector;
    constructor(detector) {
        super();
        this.detector = detector;
    }
    async execute(args) {
        // In a real execution, we'd pass the actual history or current state.
        // Since the LoopDetector passively monitors, we just return its current assessment.
        const result = this.detector.evaluate([{ name: 'loop_detection', args }]);
        if (result) {
            return result;
        }
        return "No loops detected. You may proceed.";
    }
}
exports.LoopDetectionTool = LoopDetectionTool;
