import * as cheerio from 'cheerio';
import * as fs from 'fs';

export async function parseHTML(filepath: string): Promise<string> {
  const html = fs.readFileSync(filepath, 'utf-8');
  const $ = cheerio.load(html);
  $('script, style').remove();
  return $('body').text().trim();
}
