ALTER TABLE "tokens" ADD COLUMN "ai_summary" text;--> statement-breakpoint
ALTER TABLE "tokens" ADD COLUMN "ai_summary_generated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tokens" ADD COLUMN "ai_summary_score_snapshot" integer;