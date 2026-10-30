CREATE TABLE "bpbd_audit" (
	"id" text PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bpbd_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"group_code" text NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bpbd_files" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"mime" text NOT NULL,
	"content" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bpbd_imports" (
	"id" text PRIMARY KEY NOT NULL,
	"group_code" text NOT NULL,
	"fingerprint" text NOT NULL,
	"data" jsonb NOT NULL,
	CONSTRAINT "bpbd_imports_fingerprint_unique" UNIQUE("fingerprint")
);
--> statement-breakpoint
CREATE TABLE "bpbd_meta" (
	"id" integer PRIMARY KEY NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bpbd_reports" (
	"id" text PRIMARY KEY NOT NULL,
	"group_code" text NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bpbd_research" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bpbd_sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bpbd_users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"password_hash" text NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bpbd_files" ADD CONSTRAINT "bpbd_files_owner_id_bpbd_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."bpbd_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bpbd_research" ADD CONSTRAINT "bpbd_research_owner_id_bpbd_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."bpbd_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bpbd_sessions" ADD CONSTRAINT "bpbd_sessions_user_id_bpbd_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."bpbd_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bpbd_users_email_unique" ON "bpbd_users" USING btree ("email");