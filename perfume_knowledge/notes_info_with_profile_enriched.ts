import notesInfoWithProfile from './notes_info_with_profile.js';
import perfumeMaterialsDatabase from './perfume_materials_database.js';

type Volatility = 'high' | 'medium' | 'low';
type ImpactLevel = 'high' | 'medium' | 'low';

type NoteRecord = Record<string, unknown> & {
  global_id: number;
  name: string;
  category?: unknown;
};

type MaterialMeta = {
  global_id: number;
  name: string;
  category?: unknown;
  volatility?: Volatility;
  impact_level?: ImpactLevel;
  buffer_required?: boolean;
  solo_max_ratio?: number;
  structural_power?: number;
};

const notesRaw: unknown = (notesInfoWithProfile as any)?.default ?? (notesInfoWithProfile as any);
const notesList = Array.isArray(notesRaw) ? (notesRaw as Array<Record<string, unknown>>) : [];

const dbRaw: unknown = (perfumeMaterialsDatabase as any)?.default ?? (perfumeMaterialsDatabase as any);
const dbList = Array.isArray(dbRaw) ? (dbRaw as Array<Record<string, unknown>>) : [];

const normalizeCategoryList = (input: unknown): string[] => {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  for (const v of input) {
    if (typeof v !== 'string') continue;
    const s = v.trim();
    if (!s) continue;
    if (!out.includes(s)) out.push(s);
  }
  return out;
};

const normalizeVolatility = (v: unknown): Volatility | undefined => {
  if (v === 'high' || v === 'medium' || v === 'low') return v;
  return undefined;
};

const normalizeImpactLevel = (v: unknown): ImpactLevel | undefined => {
  if (v === 'high' || v === 'medium' || v === 'low') return v;
  return undefined;
};

const dbById = new Map<number, MaterialMeta>();
const dbByName = new Map<string, MaterialMeta>();
for (const row of dbList) {
  if (!row || typeof row !== 'object') continue;
  const global_id = (row as any).global_id;
  const name = (row as any).name;
  if (typeof global_id !== 'number' || typeof name !== 'string' || !name.trim()) continue;
  const meta: MaterialMeta = {
    global_id,
    name: name.trim(),
    category: (row as any).category,
    volatility: normalizeVolatility((row as any).volatility),
    impact_level: normalizeImpactLevel((row as any).impact_level),
    buffer_required: typeof (row as any).buffer_required === 'boolean' ? ((row as any).buffer_required as boolean) : undefined,
    solo_max_ratio: typeof (row as any).solo_max_ratio === 'number' ? ((row as any).solo_max_ratio as number) : undefined,
    structural_power:
      typeof (row as any).structural_power === 'number' ? ((row as any).structural_power as number) : undefined,
  };
  dbById.set(global_id, meta);
  dbByName.set(meta.name, meta);
}

const notesById = new Map<number, NoteRecord>();
for (const row of notesList) {
  if (!row || typeof row !== 'object') continue;
  const global_id = (row as any).global_id;
  const name = (row as any).name;
  if (typeof global_id !== 'number' || typeof name !== 'string' || !name.trim()) continue;
  notesById.set(global_id, { ...(row as any), global_id, name: name.trim() });
}

const mergedNotes: NoteRecord[] = [];
for (const [global_id, note] of notesById.entries()) {
  const meta = dbById.get(global_id) || dbByName.get(note.name);
  const noteCategory = normalizeCategoryList(note.category);
  const metaCategory = normalizeCategoryList(meta?.category);
  const mergedCategory = noteCategory.length > 0 ? noteCategory : metaCategory;

  mergedNotes.push({
    ...(note as any),
    category: mergedCategory,
    volatility: meta?.volatility,
    impact_level: meta?.impact_level,
    buffer_required: meta?.buffer_required,
    solo_max_ratio: meta?.solo_max_ratio,
    structural_power: meta?.structural_power,
  });
}

const extras: NoteRecord[] = [];
for (const meta of dbById.values()) {
  if (notesById.has(meta.global_id)) continue;
  const category = normalizeCategoryList(meta.category);
  extras.push({
    global_id: meta.global_id,
    name: meta.name,
    category,
    volatility: meta.volatility,
    impact_level: meta.impact_level,
    buffer_required: meta.buffer_required,
    solo_max_ratio: meta.solo_max_ratio,
    structural_power: meta.structural_power,
  });
}

const all = [...mergedNotes, ...extras].sort((a, b) => a.global_id - b.global_id);

export default all;
