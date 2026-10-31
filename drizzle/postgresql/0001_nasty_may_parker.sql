CREATE TABLE "bpbd_research_reminders" (
	"key" text PRIMARY KEY NOT NULL,
	"research_id" text NOT NULL,
	"deadline" text NOT NULL,
	"slot" integer NOT NULL,
	"state" text NOT NULL,
	"message_id" text,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bpbd_research_reminders" ADD CONSTRAINT "bpbd_research_reminders_research_id_bpbd_research_id_fk" FOREIGN KEY ("research_id") REFERENCES "public"."bpbd_research"("id") ON DELETE cascade ON UPDATE no action;