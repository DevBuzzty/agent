import { BaseTool } from './FirstClassTool';
import { LoopDetector } from '../core/LoopDetector';

export interface LoopArgs {
  check: boolean;
}

/**
 * An algorithmic guardrail tool presented to the LLM. It allows the LLM to explicitly
 * ask the system if it is stuck in a loop, though the system also checks this automatically.
 */
export class LoopDetectionTool extends BaseTool<LoopArgs> {
  name = 'loop_detection';
  description = 'Algorithmically checks the current conversation history for endless loops (genericRepeat, knownPollNoProgress, pingPong). Call this if you feel stuck.';
  parameters = {
    type: 'object' as const,
    properties: {
      check: { type: 'boolean', description: 'Set to true to perform the loop detection check.' }
    },
    required: ['check']
  };

  private detector: LoopDetector;

  constructor(detector: LoopDetector) {
    super();
    this.detector = detector;
  }

  async execute(args: LoopArgs): Promise<string> {
    // In a real execution, we'd pass the actual history or current state.
    // Since the LoopDetector passively monitors, we just return its current assessment.
    const result = this.detector.evaluate([{name: 'loop_detection', args}]);
    if (result) {
        return result;
    }
    return "No loops detected. You may proceed.";
  }
}
