import test from 'node:test';
import assert from 'node:assert/strict';
import { seedStore, authenticateDemo, migrateDemoStore, sessionUser, DEMO_PASSWORD, canRead, canVisit, canEdit, filterEntries, authorizedResearchEntries, defaultFilters, validateEntry, DEMO_USER } from '../lib/bpbd/model.ts';
test('Operational approvals are retired; research decisions belong to Admin',()=>{const s=seedStore();assert.equal(canEdit(s,'ADM','kejadian'),false);assert.equal(canVisit(s,'ADM','/persetujuan'),false);assert.equal(canVisit(s,'ADM','/riset/permohonan'),true);s.adminOperational=true;assert.equal(canEdit(s,'ADM','kejadian'),true);assert.equal(canVisit(s,'ADM','/persetujuan'),false);});
test('Legacy approval routes stay closed to field staff',()=>{const s=seedStore();assert.equal(canVisit(s,'PK','/persetujuan/KJD-048'),false);assert.equal(canVisit(s,'PK','/persetujuan/MIT-005'),false);s.reviewer.PK=false;assert.equal(canVisit(s,'PK','/persetujuan'),false);assert.equal(canVisit(s,'PK','/data/kejadian/baru'),false);});
test('Pending researcher is restricted even with a direct route',()=>{const s=seedStore();s.users.find(u=>u.id===DEMO_USER).status='Menunggu Persetujuan';assert.equal(canVisit(s,'PEN','/peneliti',DEMO_USER),false);assert.equal(canVisit(s,'PEN','/status-akun',DEMO_USER),true);assert.equal(canVisit(s,'PEN','/profil',DEMO_USER),true);assert.equal(canVisit(s,'PEN','/dashboard',DEMO_USER),false);});
test('Research access respects owner, approved groups, dates, area and expiry',()=>{const s=seedStore(),r=s.research[0];const rows=authorizedResearchEntries(s,r,DEMO_USER);assert.ok(rows.length>0);assert.ok(rows.every(e=>e.group==='kejadian'&&e.area==='Genuk'&&e.status==='Disetujui'&&e.date>=r.start&&e.date<=r.end));assert.equal(authorizedResearchEntries(s,r,'PEN-002').length,0);r.access='Dicabut';assert.equal(authorizedResearchEntries(s,r,DEMO_USER).length,0);r.access='Aktif';r.accessEnd='2026-10-01';assert.equal(authorizedResearchEntries(s,r,DEMO_USER).length,0);assert.equal(canVisit(s,'PEN','/peneliti/hasil/kirim/RSET-001',DEMO_USER),true);});
test('All aggregations share the same date, area, status and search filter',()=>{const s=seedStore();const result=filterEntries(s.entries,{...defaultFilters,area:'Genuk',status:'Disetujui',search:'banjir'});assert.ok(result.length>0);assert.ok(result.every(e=>e.area==='Genuk'&&e.status==='Disetujui'&&e.title.toLowerCase().includes('banjir')));assert.equal(filterEntries(s.entries,{...defaultFilters,from:'2030-01-01',to:'2030-12-31'}).length,0);});
test('Invalid dates, blank titles, negative counts and over-100 progress are rejected',()=>{const base=seedStore().entries[0];assert.equal(Object.keys(validateEntry(base)).length,0);assert.ok(validateEntry({...base,date:'2026-02-31'}).date);assert.ok(validateEntry({...base,title:' '}).title);assert.ok(validateEntry({...base,amount:-1}).amount);assert.ok(validateEntry({...base,amount:101,unit:'%'}).amount);assert.ok(validateEntry({...base,amount:NaN}).amount);});

test('Each demo login resolves its own identity, handles case and rejects invalid or inactive accounts',()=>{
 const s=seedStore();
 for(const user of s.users) assert.equal(authenticateDemo(s,user.email.toUpperCase(),DEMO_PASSWORD)?.id,user.id);
 assert.equal(authenticateDemo(s,'adm@bpbd.example','wrong'),undefined);
 assert.equal(authenticateDemo(s,'demo@bpbd.test',DEMO_PASSWORD),undefined);
 s.users[0].status='Nonaktif';
 assert.equal(authenticateDemo(s,'adm@bpbd.example',DEMO_PASSWORD),undefined);
 assert.equal(sessionUser(s,'USER-ADM'),undefined);
});
test('Legacy migration preserves existing records, credentials and statuses',()=>{
 const s=seedStore();delete s.users[0].demoPassword;s.users[1].demoPassword='CustomDemo!';s.users[1].status='Nonaktif';s.entries[0].title='Perubahan pengguna';
 const migrated=migrateDemoStore(s);
 assert.equal(migrated.users[0].demoPassword,DEMO_PASSWORD);
 assert.equal(migrated.users[1].demoPassword,'CustomDemo!');assert.equal(migrated.users[1].status,'Nonaktif');
 assert.equal(migrated.entries[0].title,'Perubahan pengguna');assert.equal(migrated.entries.length,s.entries.length);
});
test('All non-admin internal accounts stay within their operational field',()=>{
 const s=seedStore();
 for(const [role,own] of [['PK','mitigasi'],['KL','kejadian'],['RR','pemulihan'],['SEK','administrasi']]){
  assert.equal(canRead(role,own),true);assert.equal(canVisit(s,role,'/persetujuan'),false);
  for(const other of ['mitigasi','kejadian','pemulihan','administrasi'].filter(g=>g!==own))assert.equal(canVisit(s,role,'/data/'+other),false);
  assert.equal(canVisit(s,role,'/dashboard'),false);
 }
 assert.equal(canVisit(s,'SEK','/dashboard/kedaruratan'),false);
});
test('Research identity follows the session account, never the old shared researcher selector',()=>{
 const s=seedStore();s.researcherId='PEN-002';s.users.find(u=>u.id==='PEN-002').status='Aktif';
 assert.equal(canVisit(s,'PEN','/peneliti/permohonan/RSET-001',DEMO_USER),true);
 assert.equal(canVisit(s,'PEN','/peneliti/permohonan/RSET-001','PEN-002'),false);
 assert.equal(canVisit(s,'PEN','/peneliti'),false);
});
