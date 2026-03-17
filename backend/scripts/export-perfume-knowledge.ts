/// <reference types="node" />
import fs from 'fs';
import path from 'path';
import enrichedNotes from '../../perfume_knowledge/notes_info_with_profile_enriched.ts';

const outputPath = path.resolve(__dirname, '../../perfume_knowledge/notes_info_with_profile_enriched.json');

const payload = Array.isArray(enrichedNotes) ? enrichedNotes : [];
fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2), 'utf-8');

console.log(`Exported ${payload.length} records to ${outputPath}`);
