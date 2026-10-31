import { setTimeout as delay } from 'node:timers/promises';
import { getPool } from '../db/index.ts';
import { dueResearchReminders, whatsappTemplate } from '../lib/bpbd/research-reminders.ts';
import { readStore } from '../lib/server/repository.ts';
import type { Store } from '../lib/bpbd/model.ts';

const send = process.argv.includes('--send');
const watch = process.argv.includes('--watch');
if (process.argv.slice(2).some(arg => !['--send','--watch'].includes(arg)) || watch && !send) throw new Error('Gunakan tanpa argumen untuk pratinjau, --send untuk mengirim, atau --send --watch untuk pemeriksaan per jam.');

function configuration() {
  const { WHATSAPP_ACCESS_TOKEN: token, WHATSAPP_PHONE_NUMBER_ID: sender, WHATSAPP_GRAPH_VERSION: version, WHATSAPP_TEMPLATE_NAME: template, WHATSAPP_TEMPLATE_LANGUAGE: language } = process.env;
  if (!token || !sender || !version || !template || !language) throw new Error('Lengkapi WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_GRAPH_VERSION, WHATSAPP_TEMPLATE_NAME, dan WHATSAPP_TEMPLATE_LANGUAGE di .env.local.');
  if (!/^\d+$/.test(sender) || !/^v\d+\.\d+$/.test(version)) throw new Error('Phone Number ID atau versi Graph API tidak valid.');
  return { token, sender, version, template, language };
}
async function run() {
  const config = send ? configuration() : null;
  const client = await getPool().connect();
  let locked = false;
  try {
    // A session lock prevents overlapping schedulers from dispatching together.
    const lock = await client.query("SELECT pg_try_advisory_lock(hashtext('bpbd-research-reminders')) AS acquired");
    if (!lock.rows[0].acquired) { console.log('Pemeriksaan lain masih berjalan.'); return; }
    locked = true;
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    let store: Store;
    try { store = (await readStore(client)).store; await client.query('COMMIT'); }
    catch (error) { await client.query('ROLLBACK'); throw error; }
    const reminders = dueResearchReminders(store);
    if (!send) {
      console.log('PRATINJAU: tidak ada pesan yang dikirim.');
      console.log(JSON.stringify(reminders.map(r => ({ penelitian: r.research.id, tenggat: r.research.deadline, jadwal: r.scheduledFor, minggu: r.slot + 1 })), null, 2));
      return;
    }
    for (const candidate of reminders) {
      // Recheck the current deadline, recipient, consent, and result submission.
      const latest = await client.query('SELECT r.data AS research,u.data AS owner FROM bpbd_research r JOIN bpbd_users u ON u.id=r.owner_id WHERE r.id=$1', [candidate.research.id]);
      if (!latest.rows[0]) continue;
      const reminder = dueResearchReminders({ research: [latest.rows[0].research], users: [latest.rows[0].owner] }).find(r => r.key === candidate.key);
      if (!reminder) continue;
      const claim = await client.query(`INSERT INTO bpbd_research_reminders (key,research_id,deadline,slot,state) VALUES ($1,$2,$3,$4,'sending')
        ON CONFLICT (key) DO UPDATE SET state='sending',attempted_at=now()
        WHERE bpbd_research_reminders.state='failed' AND bpbd_research_reminders.attempted_at < now()-interval '1 hour'
        RETURNING key`, [reminder.key,reminder.research.id,reminder.research.deadline,reminder.slot]);
      if (!claim.rowCount) continue;
      let state = 'uncertain';
      let messageId: string | null = null;
      try {
        const result = await fetch(`https://graph.facebook.com/${config!.version}/${config!.sender}/messages`, {
          method: 'POST', headers: { Authorization: `Bearer ${config!.token}`, 'Content-Type':'application/json' },
          body: JSON.stringify(whatsappTemplate(reminder,config!.template,config!.language)), signal: AbortSignal.timeout(20000),
        });
        if (result.ok) {
          const body = await result.json() as { messages?: { id: string }[] };
          messageId = body.messages?.[0]?.id || null;
          state = messageId ? 'accepted' : 'uncertain';
        } else { state = 'failed'; console.error(`WhatsApp menolak ${reminder.research.id}: HTTP ${result.status}. Periksa konfigurasi penyedia.`); }
      } catch { console.error(`Status pengiriman ${reminder.research.id} belum dapat dipastikan; tidak dicoba ulang otomatis untuk menghindari pesan ganda.`); }
      await client.query('UPDATE bpbd_research_reminders SET state=$2,message_id=$3 WHERE key=$1',[reminder.key,state,messageId]);
      console.log(`${reminder.research.id}: ${state === 'accepted' ? 'diterima API WhatsApp (belum konfirmasi terkirim)' : state}`);
    }
    console.log(`Pemeriksaan selesai: ${reminders.length} jadwal memenuhi syarat.`);
  } finally {
    if (locked) await client.query("SELECT pg_advisory_unlock(hashtext('bpbd-research-reminders'))");
    client.release();
  }
}
try {
  do { await run(); if (watch) await delay(60 * 60 * 1000); } while (watch);
} catch (error) { console.error((error as Error).message); process.exitCode = 1; }
finally { await getPool().end(); }
