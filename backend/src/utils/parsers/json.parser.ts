import * as fs from 'fs';

export async function parseJSON(filepath: string): Promise<string> {
  const content = fs.readFileSync(filepath, 'utf-8');
  const data = JSON.parse(content);
  return JSON.stringify(data, null, 2);
}
