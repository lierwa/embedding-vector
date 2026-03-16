import { encoding_for_model, TiktokenModel } from 'tiktoken';

export class TextChunker {
  private encoder;

  constructor(model: TiktokenModel = 'gpt-3.5-turbo') {
    this.encoder = encoding_for_model(model);
  }

  chunk(text: string, chunkSize: number, overlap: number): string[] {
    const tokens = this.encoder.encode(text);
    const chunks: string[] = [];

    let start = 0;
    while (start < tokens.length) {
      const end = Math.min(start + chunkSize, tokens.length);
      const chunkTokens = tokens.slice(start, end);
      const chunkText = this.encoder.decode(chunkTokens);
      chunks.push(chunkText);

      start += chunkSize - overlap;
    }

    return chunks;
  }

  countTokens(text: string): number {
    return this.encoder.encode(text).length;
  }

  free(): void {
    this.encoder.free();
  }
}
