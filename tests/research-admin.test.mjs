import test from 'node:test';
import assert from 'node:assert/strict';
import { seedStore, canVisit } from '../lib/bpbd/model.ts';
import { scopeStore, mergeStore } from '../lib/server/policy.ts';

test('Admin can review results, verify completeness, and decide extensions; other roles cannot',()=>{
  const store=seedStore(), request=store.research[0];
  request.versions=[{id:'VERSION-1',at:new Date().toISOString(),filename:'hasil.pdf',fileId:'FILE-1',summary:'Hasil',feedback:'Rekomendasi',review:'Belum Ditinjau',note:''}];
  request.extension={date:'2026-12-30',reason:'Revisi hasil'};
  for(const role of ['ADM','SEK','KL','PK','RR']){
    const actor=store.users.find(u=>u.role===role),snapshot=scopeStore(store,actor);
    if(!snapshot.research.some(r=>r.id===request.id))snapshot.research.push(structuredClone(request));
    const next=snapshot.research.find(r=>r.id===request.id);next.versions[0].review='Perlu Perbaikan';next.versions[0].note='Lengkapi pembahasan.';
    if(role==='ADM'){
      assert.equal(canVisit(store,role,'/riset/hasil'),true);
      assert.equal(mergeStore(store,snapshot,actor,'Review',request.id).research.find(r=>r.id===request.id).versions[0].review,'Perlu Perbaikan');
      const completion=scopeStore(store,actor);completion.research.find(r=>r.id===request.id).complete=true;
      assert.equal(mergeStore(store,completion,actor,'Kelengkapan',request.id).research.find(r=>r.id===request.id).complete,true);
      const extended=scopeStore(store,actor),r=extended.research.find(r=>r.id===request.id);r.deadline=r.extension.date;delete r.extension;
      assert.equal(mergeStore(store,extended,actor,'Perpanjangan',r.id).research.find(x=>x.id===r.id).deadline,'2026-12-30');
      r.deadline='2026-02-30';assert.throws(()=>mergeStore(store,extended,actor,'Tenggat',r.id),/Tenggat tidak valid/);
    }else assert.throws(()=>mergeStore(store,snapshot,actor,'Review',request.id));
  }
});
