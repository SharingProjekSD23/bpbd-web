import test from 'node:test';
import assert from 'node:assert/strict';
import { seedStore, normalizePhone, requestedResearchEntries, researchDataValidated, authorizedResearchEntries } from '../lib/bpbd/model.ts';
import { scopeStore, mergeStore } from '../lib/server/policy.ts';
import { todayWib, researchReminderSlot, dueResearchReminders, whatsappTemplate } from '../lib/bpbd/research-reminders.ts';

test('Phone normalization supports Indonesian and international formats, rejects invalid numbers', () => {
  assert.equal(normalizePhone('0812-3456-7890'), '6281234567890');
  assert.equal(normalizePhone('+62 812 3456 7890'), '6281234567890');
  for (const phone of ['abc','123','+00000000000','0812<script>','1234567890123456']) assert.equal(normalizePhone(phone),'');
});
test('Research access blocks unvalidated legacy grants and any changed or newly added row', () => {
  const s=seedStore(),r=s.research[0];
  assert.ok(researchDataValidated(s,r));
  assert.ok(authorizedResearchEntries(s,r,r.owner).length);
  const row=requestedResearchEntries(s,r,['kejadian'])[0];
  row.version++;
  assert.equal(authorizedResearchEntries(s,r,r.owner).length,0);
  row.version--;
  s.entries.push({...row,id:'NEW-ROW'});
  assert.equal(authorizedResearchEntries(s,r,r.owner).length,0);
  s.entries.pop();
  delete r.decisions.KL.validatedRows;
  assert.equal(researchDataValidated(s,r),false);
  assert.equal(scopeStore(s,s.users.find(u=>u.id===r.owner)).entries.length,0);
});
test('Every requested field must decide before data can be accessed', () => {
  const s=seedStore(),r=s.research[0];
  delete r.decisions.PK;
  assert.equal(researchDataValidated(s,r),false);
  assert.equal(authorizedResearchEntries(s,r,r.owner).length,0);
});
test('Submission automatically validates every eligible row on the server; drafts do not',()=>{
  const store=seedStore(),actor=store.users.find(u=>u.id==='PEN-001');
  const request={...structuredClone(store.research[0]),id:'RSET-AUTO',area:'all',requestedGroups:['kejadian','mitigasi'],status:'Diajukan',access:'Belum Aktif',download:false,decisions:{},history:[],versions:[]};
  const submitted=scopeStore(store,actor);submitted.research.push(request);
  const saved=mergeStore(store,submitted,actor,'Permohonan diajukan',request.id).research.find(r=>r.id===request.id);
  const expected=requestedResearchEntries(store,request).map(e=>({id:e.id,version:e.version}));
  assert.ok(expected.length>5);assert.deepEqual(saved.validation.rows,expected);
  assert.equal(saved.history.at(-1).actor,'Sistem');assert.equal(saved.status,'Diajukan');assert.equal(saved.access,'Belum Aktif');
  const draft=structuredClone(submitted);draft.research.at(-1).status='Draf';
  assert.equal(mergeStore(store,draft,actor,'Draf',request.id).research.find(r=>r.id===request.id).validation,undefined);
  submitted.research.at(-1).validation={at:'fake',rows:[]};
  assert.throws(()=>mergeStore(store,submitted,actor,'Palsu',request.id),/dibuat otomatis/);
});
test('Reviewer approvals automatically use all current rows regardless of client validation references', () => {
  const s=seedStore(),actor=s.users.find(u=>u.role==='KL');
  const valid=requestedResearchEntries(s,s.research[0],['kejadian']).map(e=>({id:e.id,version:e.version}));
  for(const rows of [undefined,[],valid.map(v=>({...v,version:v.version+1})),[...valid,...valid],[{id:'UNRELATED',version:1}]]) {
    const submitted=scopeStore(s,actor),r=submitted.research.find(r=>r.id==='RSET-001');
    if(rows===undefined)delete r.decisions.KL.validatedRows;else r.decisions.KL.validatedRows=rows;
    r.decisions.KL.note='Persetujuan cakupan otomatis';
    const saved=mergeStore(s,submitted,actor,'Setujui','RSET-001').research[0];
    assert.deepEqual(saved.decisions.KL.validatedRows,valid);
    assert.ok(researchDataValidated(s,saved));
  }
});
test('Administrator cannot activate access without complete current row validation', () => {
  const s=seedStore(),actor=s.users.find(u=>u.role==='ADM');
  s.research[0].access='Belum Aktif';delete s.research[0].decisions.KL.validatedRows;
  const submitted=scopeStore(s,actor);submitted.research.find(r=>r.id==='RSET-001').access='Aktif';
  assert.throws(()=>mergeStore(s,submitted,actor,'Aktivasi','RSET-001'),/Setiap baris/);
});
test('Researcher can save their phone and reminder consent but cannot forge row approvals', () => {
  const s=seedStore();s.users.forEach(u=>u.demoPassword='');
  const actor=s.users.find(u=>u.id==='PEN-001'),submitted=scopeStore(s,actor);
  Object.assign(submitted.users[0],{phone:'0812-3456-7890',whatsappConsent:true});
  const saved=mergeStore(s,submitted,actor,'Profil',actor.id);
  assert.equal(saved.users.find(u=>u.id===actor.id).phone,'6281234567890');
  submitted.research[0].decisions.KL.validatedRows=[];
  assert.throws(()=>mergeStore(s,submitted,actor,'Validasi palsu','RSET-001'));
});
test('Weekly schedule starts H-30, uses WIB, and excludes overdue and invalid dates', () => {
  assert.equal(todayWib(new Date('2026-10-31T18:00:00Z')),'2026-11-01');
  for (const [today,slot] of [['2026-10-31',0],['2026-11-06',0],['2026-11-07',1],['2026-11-14',2],['2026-11-21',3],['2026-11-28',4],['2026-11-30',4]]) assert.equal(researchReminderSlot('2026-11-30',today).slot,slot);
  for (const today of ['2026-10-30','2026-12-01','invalid','2026-02-31']) assert.equal(researchReminderSlot('2026-11-30',today),null);
});
test('Reminders require active researcher, valid phone, consent, unfinished result, and submitted request', () => {
  const s=seedStore(),owner=s.users.find(u=>u.id==='PEN-001');
  owner.phone='081234567890';owner.whatsappConsent=true;
  const due=dueResearchReminders(s,'2026-10-31');assert.equal(due.length,1);
  assert.equal(due[0].key,'RSET-001:2026-11-30:0');
  owner.whatsappConsent=false;assert.equal(dueResearchReminders(s,'2026-10-31').length,0);
  owner.whatsappConsent=true;owner.status='Nonaktif';assert.equal(dueResearchReminders(s,'2026-10-31').length,0);
  owner.status='Aktif';s.research[0].versions.push({id:'V-1'});assert.equal(dueResearchReminders(s,'2026-10-31').length,0);
  s.research[0].versions=[];s.research[0].status='Draf';assert.equal(dueResearchReminders(s,'2026-10-31').length,0);
});
test('Deadline extensions produce a new reminder schedule and template uses correct recipient', () => {
  const s=seedStore(),owner=s.users.find(u=>u.id==='PEN-001');owner.phone='081234567890';owner.whatsappConsent=true;
  const initial=structuredClone(dueResearchReminders(s,'2026-10-31')[0]);
  s.research[0].deadline='2026-12-10';
  const extended=dueResearchReminders(s,'2026-11-10')[0];
  assert.notEqual(initial.key,extended.key);
  const payload=whatsappTemplate(initial,'pengingat_penelitian','id');
  assert.equal(payload.to,'6281234567890');assert.equal(payload.template.name,'pengingat_penelitian');
  assert.deepEqual(payload.template.components[0].parameters.map(p=>p.text),[owner.name,s.research[0].title,'2026-11-30']);
});
