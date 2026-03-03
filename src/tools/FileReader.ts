import fs from 'fs/promises';
export const FileReaderTool = {
  name: 'file_reader',
  description: 'Read the contents of a text file from disk.',
  execute: async (args: { filepath: string }): Promise<string> => {
    try {
      const content = await fs.readFile(args.filepath, 'utf-8');
      return content;
    } catch (e: any) {
      return `Error reading file: ${e.message}`;
    }
  }
};
