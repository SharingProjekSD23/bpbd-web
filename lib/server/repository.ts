import type { PoolClient } from 'pg';
import { isDeepStrictEqual } from 'node:util';
import { hashPassword } from './passwords.ts';
import type { Store, User } from '../bpbd/model.ts';

const collections = ['users', 'entries', 'research', 'reports', 'imports', 'audit'] as const;
export const publicUser = (user: User): User => ({ ...user, demoPassword: '' });
export async function readStore(client: PoolClient, lock = false): Promise<{ store: Store; revision: number }> {
  const result = await client.query(`SELECT data, revision FROM bpbd_meta WHERE id = 1${lock ? ' FOR UPDATE' : ''}`);
  if (!result.rows.length) throw new Error('Database belum diinisialisasi. Jalankan npm run db:setup.');
  const store = result.rows[0].data as Store;
  for (const name of collections) {
    const rows = await client.query(`SELECT data FROM bpbd_${name} ORDER BY id`);
    (store[name] as unknown[]) = rows.rows.map(row => row.data);
  }
  store.audit.sort((a, b) => b.at.localeCompare(a.at));
  store.research.sort((a, b) => b.id.localeCompare(a.id));
  store.imports.sort((a, b) => b.at.localeCompare(a.at));
  store.reports.sort((a, b) => b.created.localeCompare(a.created));
  store.users = store.users.map(publicUser);
  return { store, revision: result.rows[0].revision };
}
export async function writeStore(client: PoolClient, previous: Store | null, next: Store) {
  for (const name of collections) {
    for (const item of next[name]) {
      const old = previous?.[name].find(row => row.id === item.id);
      if (old && isDeepStrictEqual(old, item)) continue;
      if (name === 'users') {
        const user = item as User;
        const password = user.demoPassword ? await hashPassword(user.demoPassword) : null;
        if (!old && !password) throw new Error('Kata sandi akun baru wajib diisi.');
        const values = [user.id, user.email.trim().toLowerCase(), user.role, password, JSON.stringify(publicUser(user))];
        if (old) {
          await client.query('UPDATE bpbd_users SET email=$2,role=$3,password_hash=COALESCE($4,password_hash),data=$5 WHERE id=$1', values);
        } else {
          await client.query('INSERT INTO bpbd_users (id,email,role,password_hash,data) VALUES ($1,$2,$3,$4,$5)', values);
        }
        if (old && password) await client.query('DELETE FROM bpbd_sessions WHERE user_id=$1', [user.id]);
      } else if (name === 'entries' || name === 'reports') {
        await client.query(`INSERT INTO bpbd_${name} (id,group_code,data) VALUES ($1,$2,$3)
          ON CONFLICT (id) DO UPDATE SET group_code=$2,data=$3`, [item.id, (item as Store['entries'][number]).group, JSON.stringify(item)]);
      } else if (name === 'research') {
        await client.query('INSERT INTO bpbd_research (id,owner_id,data) VALUES ($1,$2,$3) ON CONFLICT (id) DO UPDATE SET data=$3',
          [item.id, (item as Store['research'][number]).owner, JSON.stringify(item)]);
      } else if (name === 'imports') {
        const job = item as Store['imports'][number];
        await client.query('INSERT INTO bpbd_imports (id,group_code,fingerprint,data) VALUES ($1,$2,$3,$4)', [job.id, job.group, job.fingerprint, JSON.stringify(job)]);
      } else {
        await client.query('INSERT INTO bpbd_audit (id,data) VALUES ($1,$2) ON CONFLICT (id) DO NOTHING', [item.id, JSON.stringify(item)]);
      }
    }
  }
  const metadata = { ...next } as Record<string, unknown>;
  for (const name of collections) delete metadata[name];
  await client.query(`INSERT INTO bpbd_meta (id,revision,data) VALUES (1,1,$1)
    ON CONFLICT (id) DO UPDATE SET revision=bpbd_meta.revision+1,data=$1`, [JSON.stringify(metadata)]);
}
