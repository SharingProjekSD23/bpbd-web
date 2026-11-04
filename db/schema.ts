import { customType, integer, jsonb, pgTable, text, timestamp, uniqueIndex, primaryKey, foreignKey, index, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Stable identifiers and relationships are columns; prototype-specific fields
// remain JSONB so existing forms and report snapshots keep their shape.
export const users = pgTable('bpbd_users', {
  id: text('id').primaryKey(), email: text('email').notNull(),
  role: text('role').notNull(), passwordHash: text('password_hash').notNull(),
  data: jsonb('data').notNull(),
}, table => [uniqueIndex('bpbd_users_email_unique').on(table.email)]);
export const entries = pgTable('bpbd_entries', {
  id: text('id').primaryKey(), groupCode: text('group_code').notNull(), data: jsonb('data').notNull(),
});
export const research = pgTable('bpbd_research', {
  id: text('id').primaryKey(), ownerId: text('owner_id').notNull().references(() => users.id), data: jsonb('data').notNull(),
});
export const reports = pgTable('bpbd_reports', {
  id: text('id').primaryKey(), groupCode: text('group_code').notNull(), data: jsonb('data').notNull(),
});
export const imports = pgTable('bpbd_imports', {
  id: text('id').primaryKey(), groupCode: text('group_code').notNull(), fingerprint: text('fingerprint').notNull().unique(), data: jsonb('data').notNull(),
});
export const audit = pgTable('bpbd_audit', { id: text('id').primaryKey(), data: jsonb('data').notNull() });
export const meta = pgTable('bpbd_meta', {
  id: integer('id').primaryKey(), revision: integer('revision').notNull().default(1), data: jsonb('data').notNull(),
});
export const sessions = pgTable('bpbd_sessions', {
  tokenHash: text('token_hash').primaryKey(), userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});
const bytea = customType<{ data: Buffer }>({ dataType: () => 'bytea' });
export const files = pgTable('bpbd_files', {
  id: text('id').primaryKey(), ownerId: text('owner_id').notNull().references(() => users.id),
  name: text('name').notNull(), mime: text('mime').notNull(), content: bytea('content').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Durable dispatch records prevent duplicate weekly research reminders.
export const researchReminders = pgTable('bpbd_research_reminders', {
  key: text('key').primaryKey(), researchId: text('research_id').notNull().references(() => research.id, { onDelete: 'cascade' }),
  deadline: text('deadline').notNull(), slot: integer('slot').notNull(),
  state: text('state').notNull(), messageId: text('message_id'),
  attemptedAt: timestamp('attempted_at', { withTimezone: true }).notNull().defaultNow(),
});

export const opRecords = pgTable('bpbd_op_records', {
  module: text('module').notNull(), id: text('id').notNull(), data: jsonb('data').notNull(),
}, t => [primaryKey({ columns: [t.module, t.id] }), check('bpbd_op_records_check', sql`${t.data}->>'id'=${t.id}`)]);
export const opLinks = pgTable('bpbd_op_links', {
  module: text('module').notNull(), recordId: text('record_id').notNull(), field: text('field').notNull(),
  targetModule: text('target_module').notNull(), targetId: text('target_id').notNull(),
}, t => [primaryKey({ columns: [t.module,t.recordId,t.field] }),
  foreignKey({ columns: [t.module,t.recordId], foreignColumns: [opRecords.module,opRecords.id] }),
  foreignKey({ columns: [t.targetModule,t.targetId], foreignColumns: [opRecords.module,opRecords.id] }),
  index('bpbd_op_links_target').on(t.targetModule,t.targetId)]);
export const opFiles = pgTable('bpbd_op_files', {
  id: text('id').primaryKey(), module: text('module').notNull(), recordId: text('record_id').notNull(),
  data: jsonb('data').notNull(), content: bytea('content').notNull(), sha256: text('sha256').notNull(),
}, t => [foreignKey({ columns: [t.module,t.recordId], foreignColumns: [opRecords.module,opRecords.id] }), index('bpbd_op_files_record').on(t.module,t.recordId)]);
export const opImports = pgTable('bpbd_op_imports', {
  fingerprint: text('fingerprint').primaryKey(), module: text('module').notNull(), count: integer('count').notNull(),
  actor: text('actor').notNull().references(() => users.id), createdAt: timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),
});
export const sourceRecords = pgTable('bpbd_source_records', {
  source: text('source').notNull(), entity: text('entity').notNull(), sourceId: text('source_id').notNull(),
  data: jsonb('data').notNull(), sha256: text('sha256').notNull(),
}, t => [primaryKey({columns:[t.source,t.entity,t.sourceId]})]);
export const sourceMap = pgTable('bpbd_source_map', {
  source: text('source').notNull(), entity: text('entity').notNull(), sourceId: text('source_id').notNull(),
  module: text('module').notNull(), recordId: text('record_id').notNull(),
}, t => [primaryKey({columns:[t.source,t.entity,t.sourceId]}),
  foreignKey({columns:[t.source,t.entity,t.sourceId],foreignColumns:[sourceRecords.source,sourceRecords.entity,sourceRecords.sourceId]}),
  foreignKey({columns:[t.module,t.recordId],foreignColumns:[opRecords.module,opRecords.id]})]);
export const sourceFiles = pgTable('bpbd_source_files', {
  id: text('id').primaryKey(), source: text('source').notNull(), ownerRole: text('owner_role').notNull(),
  name: text('name').notNull(), mime: text('mime').notNull(), content: bytea('content').notNull(), sha256: text('sha256').notNull(),
});
export const sourceLinks = pgTable('bpbd_source_links', {
  source: text('source').notNull(), entity: text('entity').notNull(), sourceId: text('source_id').notNull(), field: text('field').notNull(),
  targetEntity: text('target_entity').notNull(), targetId: text('target_id').notNull(),
}, t => [primaryKey({columns:[t.source,t.entity,t.sourceId,t.field]}),
  foreignKey({columns:[t.source,t.entity,t.sourceId],foreignColumns:[sourceRecords.source,sourceRecords.entity,sourceRecords.sourceId]}),
  foreignKey({columns:[t.source,t.targetEntity,t.targetId],foreignColumns:[sourceRecords.source,sourceRecords.entity,sourceRecords.sourceId]})]);
