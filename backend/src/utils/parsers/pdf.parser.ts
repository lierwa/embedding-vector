import pdfParse from 'pdf-parse';
import * as fs from 'fs';

export async function parsePDF(filepath: string): Promise<string> {
  const dataBuffer = fs.readFileSync(filepath);
  const data = await pdfParse(dataBuffer);
  return data.text;
}
