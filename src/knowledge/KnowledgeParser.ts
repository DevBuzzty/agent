import fs from 'fs';

export interface ModuleMetadata {
  requires?: {
    bins?: string[];
    env?: string[];
  };
  os?: string[];
}

export interface ParsedModule {
  name: string;
  description: string;
  metadata: ModuleMetadata;
  instructions: string;
  location?: string; // Filled in by the manager
}

/**
 * Highly specialized parser for the strict 3-part module file format.
 * Format:
 * ---
 * name: "ModuleName"
 * description: "Single line description"
 * ---
 * {"requires": {"bins": ["jq"]}, "os": ["linux", "darwin"]}
 * ---
 * Markdown instructions for the LLM...
 */
export class KnowledgeParser {
  public parseFile(filepath: string): ParsedModule {
    const content = fs.readFileSync(filepath, 'utf8');

    // Strict splitting based on the 3-part format separated by ---
    // Part 1: YAML Frontmatter (name & description only)
    // Part 2: Single-line JSON metadata
    // Part 3: Markdown Textblock

    const parts = content.split(/^---\s*$/m);

    // Clean empty splits if file starts with ---
    const cleanParts = parts.filter(p => p.trim() !== '');

    if (cleanParts.length < 3) {
      throw new Error(`[KnowledgeParser] Invalid format in ${filepath}. Must contain 3 distinct sections separated by '---'`);
    }

    const yamlStr = cleanParts[0].trim();
    const jsonStr = cleanParts[1].trim();
    const markdownStr = cleanParts.slice(2).join('---').trim();

    // Parse YAML-like frontmatter (Single-line keys)
    const nameMatch = yamlStr.match(/^name:\s*(.+)$/m);
    const descMatch = yamlStr.match(/^description:\s*(.+)$/m);

    if (!nameMatch || !descMatch) {
      throw new Error(`[KnowledgeParser] Missing 'name' or 'description' in frontmatter of ${filepath}`);
    }

    const name = nameMatch[1].replace(/^["'](.*)["']$/, '$1'); // Strip quotes if any
    const description = descMatch[1].replace(/^["'](.*)["']$/, '$1');

    // Parse single-line JSON metadata
    let metadata: ModuleMetadata = {};
    try {
      if (jsonStr) {
          metadata = JSON.parse(jsonStr);
      }
    } catch (e: any) {
      throw new Error(`[KnowledgeParser] Invalid JSON metadata in ${filepath}: ${e.message}`);
    }

    return {
      name,
      description,
      metadata,
      instructions: markdownStr
    };
  }
}
