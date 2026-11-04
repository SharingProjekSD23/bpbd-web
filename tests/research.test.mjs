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
  delete r.decisions.ADM.validatedRows;
  assert.equal(researchDataValidated(s,r),false);
  assert.equal(scopeStore(s,s.users.find(u=>u.id===r.owner)).entries.length,0);
});
test('Approval must cover every requested dataset before data can be accessed', () => {
  const s=seedStore(),r=s.research[0];
  r.decisions.ADM.groups.pop();
  assert.equal(researchDataValidated(s,r),false);
  assert.equal(authorizedResearchEntries(s,r,r.owner).length,0);
});
test('Submission automatically validates all rows and rejects the removed request statuses',()=>{
  const store=seedStore(),actor=store.users.find(u=>u.id==='PEN-001');
  const request={...structuredClone(store.research[0]),id:'RSET-AUTO',area:'all',requestedGroups:['kejadian','mitigasi'],status:'Diajukan',access:'Belum Aktif',download:false,decisions:{},history:[],versions:[]};
  const submitted=scopeStore(store,actor);submitted.research.push(request);
  const saved=mergeStore(store,submitted,actor,'Permohonan diajukan',request.id).research.find(r=>r.id===request.id);
  const expected=requestedResearchEntries(store,request).map(e=>({id:e.id,version:e.version}));
  assert.ok(expected.length>5);assert.deepEqual(saved.validation.rows,expected);
  assert.equal(saved.history.at(-1).actor,'Sistem');assert.equal(saved.status,'Diajukan');assert.equal(saved.access,'Belum Aktif');
  for(const status of ['Draf','Dalam Peninjauan','Perlu Perbaikan','Disetujui Sebagian']) {
    const invalid=structuredClone(submitted);invalid.research.at(-1).status=status;
    assert.throws(()=>mergeStore(store,invalid,actor,'Status lama',request.id));
  }
  submitted.research.at(-1).validation={at:'fake',rows:[]};
  assert.throws(()=>mergeStore(store,submitted,actor,'Palsu',request.id),/dibuat otomatis/);
});
test('Only Admin decides all requested datasets, with canonical row validation and a separate activation', () => {
  const s=seedStore(),actor=s.users.find(u=>u.role==='ADM');
  for(const refs of [undefined,[],[{id:'UNRELATED',version:999}]]){
    const submitted=scopeStore(s,actor),r=submitted.research.find(r=>r.id==='RSET-001');
    r.decisions={ADM:{status:'Disetujui',note:'Persetujuan Admin lintas bidang',groups:[...r.requestedGroups],accessEnd:'2026-12-31',download:true,validatedRows:refs}};
    const saved=mergeStore(s,submitted,actor,'Keputusan Admin',r.id).research.find(x=>x.id===r.id);
    assert.equal(saved.status,'Disetujui');assert.equal(saved.access,'Belum Aktif');
    assert.deepEqual(saved.decisions.ADM.validatedRows,requestedResearchEntries(s,r).map(e=>({id:e.id,version:e.version})));
    assert.ok(researchDataValidated(s,saved));
  }
  for(const field of ['PK','KL','RR']){
    const reviewer=s.users.find(u=>u.role===field),copy=scopeStore(s,reviewer),r=copy.research.find(r=>r.requestedGroups.some(g=>({kejadian:'KL',mitigasi:'PK',edukasi:'PK',pemulihan:'RR',progres:'RR'})[g]===field));
    if(!r)continue;
    r.decisions[field]={status:'Disetujui',note:'Tentatif',groups:r.requestedGroups.filter(g=>g===(field==='KL'?'kejadian':field==='PK'?'mitigasi':'pemulihan')),accessEnd:'2026-12-31'};
    assert.throws(()=>mergeStore(s,copy,reviewer,'Keputusan bidang',r.id),/Admin Sistem/);
  }
});
test('Admin approves the whole request or rejects it and revokes previous access',()=>{
 const s=seedStore(),actor=s.users.find(u=>u.role==='ADM');
 for(const status of ['Disetujui','Ditolak']){
  const copy=scopeStore(s,actor),r=copy.research[0];
  r.decisions={ADM:{status,note:'Keputusan baru Admin',groups:status==='Disetujui'?[...r.requestedGroups]:[],accessEnd:'2026-12-31',download:true}};
  const saved=mergeStore(s,copy,actor,'Keputusan',r.id).research[0];
  assert.equal(saved.status,status);assert.equal(saved.access,'Belum Aktif');
  assert.equal(saved.download,status==='Disetujui');
 }
 for(const [status,selected] of [['Disetujui',['kejadian']],['Perlu Perbaikan',[]],['Disetujui',['logistik']]]){
  const copy=scopeStore(s,actor),r=copy.research[0];
  r.decisions={ADM:{status,note:'Tidak valid',groups:selected,accessEnd:'2026-12-31'}};
  assert.throws(()=>mergeStore(s,copy,actor,'Keputusan',r.id));
 }
});
test('Admin coordinates deadlines while the request stays submitted',()=>{
 const s=seedStore(),actor=s.users.find(u=>u.role==='ADM'),copy=scopeStore(s,actor);
 const r=copy.research.find(r=>r.status==='Diajukan');
 r.deadline='2026-12-30';
 assert.equal(mergeStore(s,copy,actor,'Koordinasi',r.id).research.find(x=>x.id===r.id).status,'Diajukan');
 for(const status of ['Dalam Peninjauan','Disetujui','Ditolak']){
  r.status=status;
  assert.throws(()=>mergeStore(s,copy,actor,'Status tidak sah',r.id));
 }
});
test('Administrator cannot activate access without complete current row validation', () => {
  const s=seedStore(),actor=s.users.find(u=>u.role==='ADM');
  s.research[0].access='Belum Aktif';delete s.research[0].decisions.ADM.validatedRows;
  const submitted=scopeStore(s,actor);submitted.research.find(r=>r.id==='RSET-001').access='Aktif';
  assert.throws(()=>mergeStore(s,submitted,actor,'Aktivasi','RSET-001'),/Validasi baris/);
});
test('Researcher can save their phone and reminder consent but cannot forge row approvals', () => {
  const s=seedStore();s.users.forEach(u=>u.demoPassword='');
  const actor=s.users.find(u=>u.id==='PEN-001'),submitted=scopeStore(s,actor);
  Object.assign(submitted.users[0],{phone:'0812-3456-7890',whatsappConsent:true});
  const saved=mergeStore(s,submitted,actor,'Profil',actor.id);
  assert.equal(saved.users.find(u=>u.id===actor.id).phone,'6281234567890');
  submitted.research[0].decisions.ADM.validatedRows=[];
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
