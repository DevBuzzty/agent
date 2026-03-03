import { evaluate } from 'mathjs';

export const CalculatorTool = {
  name: 'calculator',
  description: 'Evaluate a mathematical expression safely.',
  execute: async (args: { expression: string }): Promise<string> => {
    try {
      // Use mathjs evaluate instead of dangerous eval()
      const result = evaluate(args.expression);
      return String(result);
    } catch (e: any) {
      return `Error calculating expression: ${e.message}`;
    }
  }
};
