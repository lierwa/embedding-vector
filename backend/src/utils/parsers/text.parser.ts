import * as fs from 'fs';

export async function parseText(filepath: string): Promise<string> {
  return fs.readFileSync(filepath, 'utf-8');
}
