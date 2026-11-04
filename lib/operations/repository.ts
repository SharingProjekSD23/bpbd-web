import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import type { User } from '../bpbd/model.ts';
import { modules, type Row, moduleOf } from './domain.ts';

export async function readRecords(client: PoolClient): Promise<Record<string, Row[]>> {
  const result: Record<string, Row[]> = Object.fromEntries(modules.map(m => [m.id, []]));
  for (const row of (await client.query('SELECT module,data FROM bpbd_op_records ORDER BY module,id')).rows) result[row.module]?.push(row.data);
  return result;
}
export async function saveRecord(client: PoolClient, module: string, row: Row) {
  await client.query('INSERT INTO bpbd_op_records(module,id,data) VALUES($1,$2,$3) ON CONFLICT(module,id) DO UPDATE SET data=$3', [module, row.id, JSON.stringify(row)]);
  await client.query('DELETE FROM bpbd_op_links WHERE module=$1 AND record_id=$2', [module, row.id]);
  for (const field of moduleOf(module).fields.filter(f => ['barang', 'kejadian'].includes(f.type))) {
    if (row[field.key]) await client.query('INSERT INTO bpbd_op_links(module,record_id,field,target_module,target_id) VALUES($1,$2,$3,$4,$5)', [module, row.id, field.key, field.type, String(row[field.key])]);
  }
}
export async function audit(client: PoolClient, actor: User, action: string, object: string) {
  const id = `AUD-${randomUUID()}`;
  await client.query('INSERT INTO bpbd_audit(id,data) VALUES($1,$2)', [id, JSON.stringify({ id, at: new Date().toISOString(), actor: actor.name, role: actor.role, action, object })]);
}
