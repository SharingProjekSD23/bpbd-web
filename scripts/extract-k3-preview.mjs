import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

// Explicit opt-in: the preview is a source snapshot, not a demonstration seed.
const sourceDir = process.argv[2] || 'backups/sources';
const manifestPath = join(sourceDir, 'manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const file = join(manifest.root, 'Kelompok_3', 'BUKA_PRATINJAU.html');
const html = await readFile(file, 'utf8');
const marker = 'const previewData=';
const start = html.indexOf(marker);
if (start < 0) throw new Error('Snapshot pratinjau tidak ditemukan.');
// Scan only the JSON literal; never execute source HTML or JavaScript.
const input = html.slice(start + marker.length).trimStart();
let depth = 0, quoted = false, escaped = false, end = -1;
for (let i = 0; i < input.length; i++) {
  const c = input[i];
  if (quoted) {
    if (escaped) escaped = false;
    else if (c === '\\') escaped = true;
    else if (c === '"') quoted = false;
  } else if (c === '"') quoted = true;
  else if (c === '{' || c === '[') depth++;
  else if (c === '}' || c === ']') { if (--depth === 0) { end = i + 1; break; } }
}
if (end < 0 || input[0] !== '{') throw new Error('Snapshot bukan JSON lengkap.');
const snapshot = JSON.parse(input.slice(0, end));
const rows = Object.fromEntries(Object.entries(snapshot).filter(([key]) => key.startsWith('api/v2/records/')).map(([key, value]) => [key.split('/').at(-1), value]));
for (const [name, values] of Object.entries(rows)) {
  if (!Array.isArray(values) || values.some(r => typeof r.id !== 'string' || !r.id) || new Set(values.map(r => r.id)).size !== values.length) throw new Error(`ID snapshot tidak valid/duplikat: ${name}.`);
}
const digest = createHash('sha256').update(html).digest('hex');
if (manifest.preview && manifest.preview.sha256 !== digest) throw new Error('Pratinjau berubah sejak ekstraksi sebelumnya. Rekonsiliasi sumber terlebih dahulu.');
await writeFile(join(sourceDir, 'kelompok3-preview.json'), JSON.stringify(rows));
manifest.preview = { file, sha256: digest, activated: true, counts: Object.fromEntries(Object.entries(rows).map(([k,v]) => [k,v.length])), conflicts: snapshot['sumber/manifest.json']?.conflicting_event_ids || [] };
await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
console.log(JSON.stringify({ preview: manifest.preview.counts, conflicts: manifest.preview.conflicts.length }));
