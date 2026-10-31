import { customType, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

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
