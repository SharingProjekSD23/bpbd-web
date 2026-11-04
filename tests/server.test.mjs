import test from 'node:test';
import assert from 'node:assert/strict';
import { seedStore, DEMO_PASSWORD } from '../lib/bpbd/model.ts';
import { mergeStore, scopeStore } from '../lib/server/policy.ts';
import { hashPassword, verifyPassword } from '../lib/server/passwords.ts';

test('Passwords are salted and verified without exposing plaintext', async () => {
  const first = await hashPassword(DEMO_PASSWORD), second = await hashPassword(DEMO_PASSWORD);
  assert.notEqual(first, second); assert.ok(!first.includes(DEMO_PASSWORD));
  assert.equal(await verifyPassword(DEMO_PASSWORD, first), true);
  assert.equal(await verifyPassword('incorrect', first), false);
});
test('Snapshots omit credentials and exclude other fields and researcher requests', () => {
  const store = seedStore();
  const field = scopeStore(store, store.users.find(u => u.role === 'KL'));
  assert.ok(field.users.every(u => u.demoPassword === ''));
  assert.ok(field.entries.every(e => ['kejadian','korban','kebutuhan','logistik','distribusi'].includes(e.group)));
  const researcher = scopeStore(store, store.users.find(u => u.id === 'PEN-001'));
  assert.ok(researcher.research.every(r => r.owner === 'PEN-001'));
  assert.ok(researcher.entries.every(e => e.group === 'kejadian' && e.area === 'Genuk' && !e.fileId && !e.history.length));
  const pending = scopeStore(store, store.users.find(u => u.id === 'PEN-002'));
  assert.equal(pending.research.length, 0); assert.equal(pending.entries.length, 0);
});
test('Legacy dataset writers cannot bypass the integrated operational API', () => {
  const store = seedStore(), actor = store.users.find(u => u.role === 'KL');
  const next = scopeStore(store, actor), row = next.entries[0];
  row.title = 'Kegiatan uji'; row.status = 'Menunggu Persetujuan';
  row.history.push({at:'forged',actor:'forged',action:'Diajukan'});
  assert.throws(() => mergeStore(store, next, actor, 'Data diperbarui', row.id), /Gunakan modul Operasional/);
  assert.equal(store.entries[0].title === 'Kegiatan uji', false);
});
test('Forged role, cross-field record, audit edit and removing records are denied', () => {
  const store = seedStore(), actor = store.users.find(u => u.role === 'KL');
  for (const tamper of [
    state => { state.users.find(u=>u.id===actor.id).role='ADM'; },
    state => { state.entries.push({...store.entries.find(e=>e.group==='mitigasi'),title:'forged'}); },
    state => { state.audit=[]; },
    state => { state.entries.pop(); },
    state => { state.adminOperational=true; },
  ]) {
    const next = scopeStore(store,actor);tamper(next);
    assert.throws(() => mergeStore(store,next,actor,'',''));
  }
});
test('Operational approvals are retired from legacy dataset API', () => {
  const store=seedStore(), actor=store.users.find(u=>u.role==='ADM'), next=scopeStore(store,actor);
  next.entries[0].status='Disetujui'; next.entries[0].title='changed';
  assert.throws(()=>mergeStore(store,next,actor,'',''), /Gunakan modul Operasional/);
});
test('Researchers cannot change grants and reviewers cannot decide another field', () => {
  const store=seedStore(), researcher=store.users.find(u=>u.id==='PEN-001');
  const next=scopeStore(store,researcher);next.research[0].decisions.ADM.groups.push('logistik');
  assert.throws(()=>mergeStore(store,next,researcher,'',''));
  const actor=store.users.find(u=>u.role==='KL'),field=scopeStore(store,actor);
  assert.equal(field.research.length,0);
  field.research.push(structuredClone(store.research[0]));
  field.research[0].decisions.PK={status:'Disetujui',groups:['mitigasi'],note:'forged'};
  assert.throws(()=>mergeStore(store,field,actor,'',''));
});
