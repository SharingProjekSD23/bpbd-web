import ExcelJS from 'exceljs';
import { moduleOf, type Row } from './domain.ts';
import { requireThat } from '../server/policy.ts';

export function parseCsv(input: string) {
  const text = input.replace(/^\ufeff/, '');
  const delimiter = text.split(/\r?\n/)[0].includes(';') && !text.split(/\r?\n/)[0].includes(',') ? ';' : ',';
  const rows: string[][] = []; let row: string[] = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
    else if (!quoted && c === delimiter) { row.push(cell.trim()); cell = ''; }
    else if (!quoted && /[\r\n]/.test(c)) { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell.trim()); if (row.some(Boolean)) rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  requireThat(!quoted, 'Tanda kutip CSV tidak ditutup.', 400); row.push(cell.trim()); if (row.some(Boolean)) rows.push(row); return rows;
}
function checkArchive(bytes: Uint8Array) {
  // Bound uncompressed ZIP size before handing XLSX to the parser.
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); let size = 0, count = 0;
  for (let at = 0; at + 46 <= bytes.length; at++) if (view.getUint32(at, true) === 0x02014b50) {
    size += view.getUint32(at + 24, true); count++;
    requireThat(size <= 64 * 1024 * 1024 && count <= 2000, 'Isi Excel terlalu besar.', 413);
    at += 45 + view.getUint16(at + 28, true) + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
  }
  requireThat(count > 0, 'Excel tidak valid.', 400);
}
export async function parseSheet(module: string, file: File) {
  requireThat(file.size > 0 && file.size <= 15 * 1024 * 1024, 'Maksimal 15 MB per impor.', 413);
  let cells: unknown[][];
  if (/\.csv$/i.test(file.name)) cells = parseCsv(await file.text());
  else {
    requireThat(/\.xlsx$/i.test(file.name), 'Gunakan CSV UTF-8 atau XLSX.', 400);
    const bytes = new Uint8Array(await file.arrayBuffer()); checkArchive(bytes);
    const book = new ExcelJS.Workbook(); await book.xlsx.load(bytes as unknown as ExcelJS.Buffer);
    const sheet = book.worksheets[0]; requireThat(sheet && sheet.rowCount <= 5001 && sheet.columnCount <= 80, 'Maksimal 5.000 baris dan 80 kolom.', 400);
    cells = [];
    sheet.eachRow(row => {
      const values: unknown[] = [];
      for (let c = 1; c <= sheet.columnCount; c++) {
        const cell = row.getCell(c);
        requireThat(cell.type !== ExcelJS.ValueType.Formula, 'Tempelkan nilai Excel, bukan rumus.', 400);
        values.push(cell.value instanceof Date ? cell.value.toISOString().slice(0, 10) : cell.text);
      }
      if (values.some(v => String(v ?? '').trim())) cells.push(values);
    });
  }
  requireThat(cells.length > 1 && cells.length <= 5001, 'File harus berisi 1–5.000 baris data.', 400);
  const headers = cells[0].map(v => String(v ?? '').trim());
  const fields = moduleOf(module).fields, allowed = new Set(['id', ...fields.map(f => f.key)]);
  requireThat(new Set(headers).size === headers.length && headers.every(h => allowed.has(h)), 'Kolom asing atau duplikat. Gunakan template modul.', 400);
  requireThat(fields.filter(f => f.required).every(f => headers.includes(f.key)), 'Kolom wajib tidak lengkap.', 400);
  return cells.slice(1).map(row => {
    requireThat(row.length <= headers.length || row.slice(headers.length).every(v => !v), 'Jumlah kolom tidak sesuai header.', 400);
    return Object.fromEntries(headers.map((key, i) => [key, row[i] ?? '']));
  });
}
export async function exportSheet(module: string, rows: Row[], format: string, template = false, hideIncident = false) {
  const headers = ['id', ...moduleOf(module).fields.map(f => f.key)].filter(k => !hideIncident || !['kejadian_id','kejadian_ref'].includes(k));
  if (format === 'csv') {
    const safe = (v: unknown) => { const s = String(v ?? ''); return `"${(/^[=+@\-\t\r]/.test(s) ? "'" + s : s).replaceAll('"', '""')}"`; };
    return new Response('\ufeff' + [headers, ...rows.map(r => headers.map(k => r[k]))].map(r => r.map(safe).join(',')).join('\r\n'),
      { headers: { 'Content-Type': 'text/csv;charset=utf-8', 'Content-Disposition': `attachment; filename=${module}.csv` } });
  }
  requireThat(format === 'xlsx', 'Format ekspor tidak dikenal.', 400);
  const book = new ExcelJS.Workbook(), sheet = book.addWorksheet('Data'); sheet.addRow(headers);
  for (const row of rows) sheet.addRow(headers.map(k => row[k] ?? ''));
  sheet.views = [{ state: 'frozen', ySplit: 1 }]; sheet.columns.forEach(c => { c.width = 24; });
  return new Response(new Uint8Array(await book.xlsx.writeBuffer()), { headers: {
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename=${template ? 'template-' : ''}${module}.xlsx`,
  } });
}
