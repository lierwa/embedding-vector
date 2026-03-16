import { encoding_for_model, TiktokenModel } from 'tiktoken';

export class TextChunker {
  private encoder;

  constructor(model: TiktokenModel = 'gpt-3.5-turbo') {
    this.encoder = encoding_for_model(model);
  }

  chunk(text: string, chunkSize: number, overlap: number): string[] {
    const tokens: number[] = Array.from(this.encoder.encode(text));
    const chunks: string[] = [];
    const decoder = new TextDecoder();

    let start = 0;
    while (start < tokens.length) {
      const end = Math.min(start + chunkSize, tokens.length);
      const chunkTokens = tokens.slice(start, end);
      
      // Decode returns Uint8Array, convert to string
      const decodedBytes = this.encoder.decode(new Uint32Array(chunkTokens));
      const chunkText = decoder.decode(decodedBytes);
      chunks.push(chunkText);

      start += chunkSize - overlap;
    }

    return chunks;
  }

  countTokens(text: string): number {
    return Array.from(this.encoder.encode(text)).length;
  }

  free(): void {
    this.encoder.free();
  }
}
