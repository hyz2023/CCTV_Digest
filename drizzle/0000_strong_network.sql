CREATE TABLE "broadcast_day" (
	"date" date PRIMARY KEY NOT NULL,
	"blob_url" text,
	"source" text,
	"segment_stats" jsonb,
	"status" text DEFAULT 'ingested' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_interpretation" (
	"id" serial PRIMARY KEY NOT NULL,
	"day" date NOT NULL,
	"top_signals" jsonb,
	"model" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "daily_interpretation_day_unique" UNIQUE("day")
);
--> statement-breakpoint
CREATE TABLE "item" (
	"id" serial PRIMARY KEY NOT NULL,
	"day" date NOT NULL,
	"ord" integer NOT NULL,
	"segment" text NOT NULL,
	"title" text,
	"length_proxy" integer,
	"text" text,
	"summary" text,
	CONSTRAINT "item_day_ord_unique" UNIQUE("day","ord")
);
--> statement-breakpoint
CREATE TABLE "pipeline_run" (
	"id" serial PRIMARY KEY NOT NULL,
	"day" date,
	"stage" text NOT NULL,
	"provider" text,
	"model" text,
	"input_tokens" integer,
	"output_tokens" integer,
	"cost_usd" real,
	"status" text NOT NULL,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "radar_event" (
	"id" serial PRIMARY KEY NOT NULL,
	"day" date NOT NULL,
	"type" text NOT NULL,
	"target" text NOT NULL,
	"magnitude" real,
	"detail" jsonb,
	CONSTRAINT "radar_event_day_type_target_unique" UNIQUE("day","type","target")
);
--> statement-breakpoint
CREATE TABLE "sector_signal" (
	"id" serial PRIMARY KEY NOT NULL,
	"day" date NOT NULL,
	"sector" text NOT NULL,
	"polarity" text NOT NULL,
	"strength" real,
	CONSTRAINT "sector_signal_day_sector_unique" UNIQUE("day","sector")
);
--> statement-breakpoint
CREATE TABLE "stage_config" (
	"stage" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"base_url" text,
	"api_key_env" text NOT NULL,
	"params" jsonb,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "thread" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"color" text,
	"status" text DEFAULT 'active' NOT NULL,
	"meta" jsonb
);
--> statement-breakpoint
CREATE TABLE "thread_evidence" (
	"id" serial PRIMARY KEY NOT NULL,
	"thread_id" integer NOT NULL,
	"day" date NOT NULL,
	"item_id" integer
);
--> statement-breakpoint
CREATE TABLE "thread_point" (
	"id" serial PRIMARY KEY NOT NULL,
	"thread_id" integer NOT NULL,
	"period" text NOT NULL,
	"intensity" real NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tifa" (
	"id" serial PRIMARY KEY NOT NULL,
	"term" text NOT NULL,
	"first_seen" date,
	"aliases" jsonb,
	CONSTRAINT "tifa_term_unique" UNIQUE("term")
);
--> statement-breakpoint
CREATE TABLE "tifa_mention" (
	"id" serial PRIMARY KEY NOT NULL,
	"day" date NOT NULL,
	"term" text NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"context" text,
	CONSTRAINT "tifa_mention_day_term_unique" UNIQUE("day","term")
);
