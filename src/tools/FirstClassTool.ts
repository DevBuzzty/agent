/**
 * Represents a First-Class Tool presented to the language model.
 * It provides both a human-readable text description (for the system prompt)
 * and a strict JSON schema for deterministic parameter passing.
 */
export interface FirstClassTool<TArgs = any> {
  name: string;
  description: string;

  // Strict JSON schema for the parameters
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };

  /**
   * Generates a human-readable representation of this tool for injection into the System Prompt.
   */
  getSystemPromptText(): string;

  /**
   * Executes the tool with the provided arguments.
   */
  execute(args: TArgs, context?: any): Promise<string>;
}

/**
 * Base class to simplify tool creation.
 */
export abstract class BaseTool<TArgs> implements FirstClassTool<TArgs> {
  abstract name: string;
  abstract description: string;
  abstract parameters: { type: 'object', properties: Record<string, any>, required?: string[] };

  getSystemPromptText(): string {
    const paramsStr = JSON.stringify(this.parameters, null, 2);
    return `Tool Name: ${this.name}\nDescription: ${this.description}\nParameters JSON Schema:\n${paramsStr}\n`;
  }

  abstract execute(args: TArgs, context?: any): Promise<string>;
}
