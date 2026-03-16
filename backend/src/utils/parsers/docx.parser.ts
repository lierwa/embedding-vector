import mammoth from 'mammoth';

export async function parseDOCX(filepath: string): Promise<string> {
  const result = await mammoth.extractRawText({ path: filepath });
  return result.value;
}
