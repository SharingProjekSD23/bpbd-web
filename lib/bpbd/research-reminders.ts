import { normalizePhone, type Research, type Store } from './model.ts';

export function todayWib(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (type: string) => parts.find(p => p.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
function day(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
  const date = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(date) && new Date(date).toISOString().slice(0,10) === value ? date / 86400000 : NaN;
}
export function researchReminderSlot(deadline: string, today = todayWib()) {
  const remaining = day(deadline) - day(today);
  if (!Number.isFinite(remaining) || remaining < 0 || remaining > 30) return null;
  const slot = Math.floor((30 - remaining) / 7);
  return { slot, remaining, scheduledFor: new Date((day(deadline) - 30 + slot * 7) * 86400000).toISOString().slice(0,10) };
}
export function dueResearchReminders(store: Pick<Store,'research'|'users'>, today = todayWib()) {
  return store.research.flatMap(research => {
    const owner = store.users.find(u => u.id === research.owner && u.role === 'PEN' && u.status === 'Aktif');
    const schedule = researchReminderSlot(research.deadline, today);
    const phone = normalizePhone(owner?.phone || '');
    if (!owner || owner.whatsappConsent !== true || !phone || !schedule || research.versions.length || !['Diajukan','Disetujui'].includes(research.status)) return [];
    return [{ research, owner, phone, ...schedule, key: `${research.id}:${research.deadline}:${schedule.slot}` }];
  });
}
export function whatsappTemplate(reminder: {phone:string;owner:{name:string};research:Pick<Research,'title'|'deadline'>}, name:string, language:string) {
  return { messaging_product: 'whatsapp', to: reminder.phone, type: 'template', template: {
    name, language: { code: language }, components: [{ type: 'body', parameters: [reminder.owner.name, reminder.research.title, reminder.research.deadline].map(text => ({ type: 'text', text: text.slice(0,512) })) }],
  } };
}
