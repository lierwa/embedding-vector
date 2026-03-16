import { parsePDF } from './pdf.parser';
import { parseDOCX } from './docx.parser';
import { parseHTML } from './html.parser';
import { parseJSON } from './json.parser';
import { parseText } from './text.parser';

export async function parseDocument(filepath: string, filetype: string): Promise<string> {
  const ext = filetype.toLowerCase();

  switch (ext) {
    case 'pdf':
      return parsePDF(filepath);
    case 'docx':
    case 'doc':
      return parseDOCX(filepath);
    case 'html':
    case 'htm':
      return parseHTML(filepath);
    case 'json':
      return parseJSON(filepath);
    case 'txt':
    case 'md':
    case 'markdown':
      return parseText(filepath);
    default:
      throw new Error(`Unsupported file type: ${filetype}`);
  }
}
