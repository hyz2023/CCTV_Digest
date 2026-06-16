import {
  pgTable,
  date,
  text,
  jsonb,
  timestamp,
  serial,
  integer,
  real,
  unique,
} from 'drizzle-orm/pg-core';

// ---------------------------------------------------------------------------
// broadcast_day
// ---------------------------------------------------------------------------
export const broadcastDay = pgTable('broadcast_day', {
  date: date('date').primaryKey(),
  blobUrl: text('blob_url'),
  source: text('source'),
  segmentStats: jsonb('segment_stats'),
  status: text('status').notNull().default('ingested'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// item
// ---------------------------------------------------------------------------
export const item = pgTable('item', {
  id: serial('id').primaryKey(),
  day: date('day').notNull(),
  ord: integer('ord').notNull(),
  segment: text('segment').notNull(),
  title: text('title'),
  lengthProxy: integer('length_proxy'),
  text: text('text'),
  summary: text('summary'),
}, (t) => ({
  dayOrdUnique: unique('item_day_ord_unique').on(t.day, t.ord),
}));

// ---------------------------------------------------------------------------
// tifa  (Topic / Issue / Figure / Acronym)
// ---------------------------------------------------------------------------
export const tifa = pgTable('tifa', {
  id: serial('id').primaryKey(),
  term: text('term').notNull().unique(),
  firstSeen: date('first_seen'),
  aliases: jsonb('aliases'),
});

// ---------------------------------------------------------------------------
// tifa_mention
// ---------------------------------------------------------------------------
export const tifaMention = pgTable('tifa_mention', {
  id: serial('id').primaryKey(),
  day: date('day').notNull(),
  term: text('term').notNull(), // denormalized natural key; tifa table holds metadata (first_seen/aliases)
  count: integer('count').notNull().default(1),
  context: text('context'),
}, (t) => ({
  dayTermUnique: unique('tifa_mention_day_term_unique').on(t.day, t.term),
}));

// ---------------------------------------------------------------------------
// sector_signal
// ---------------------------------------------------------------------------
export const sectorSignal = pgTable('sector_signal', {
  id: serial('id').primaryKey(),
  day: date('day').notNull(),
  sector: text('sector').notNull(),
  polarity: text('polarity').notNull(),
  strength: real('strength'),
}, (t) => ({
  daySectorUnique: unique('sector_signal_day_sector_unique').on(t.day, t.sector),
}));

// ---------------------------------------------------------------------------
// daily_interpretation
// ---------------------------------------------------------------------------
export const dailyInterpretation = pgTable('daily_interpretation', {
  id: serial('id').primaryKey(),
  day: date('day').notNull(),
  topSignals: jsonb('top_signals'),
  model: text('model'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  dayUnique: unique('daily_interpretation_day_unique').on(t.day),
}));

// ---------------------------------------------------------------------------
// radar_event
// ---------------------------------------------------------------------------
export const radarEvent = pgTable('radar_event', {
  id: serial('id').primaryKey(),
  day: date('day').notNull(),
  type: text('type').notNull(),
  target: text('target').notNull(),
  magnitude: real('magnitude'),
  detail: jsonb('detail'),
}, (t) => ({
  dayTypeTargetUnique: unique('radar_event_day_type_target_unique').on(t.day, t.type, t.target),
}));

// ---------------------------------------------------------------------------
// thread
// ---------------------------------------------------------------------------
export const thread = pgTable('thread', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  color: text('color'),
  status: text('status').notNull().default('active'),
  meta: jsonb('meta'),
});

// ---------------------------------------------------------------------------
// thread_point
// ---------------------------------------------------------------------------
export const threadPoint = pgTable('thread_point', {
  id: serial('id').primaryKey(),
  threadId: integer('thread_id').notNull(),
  period: text('period').notNull(),
  intensity: real('intensity').notNull(),
});

// ---------------------------------------------------------------------------
// thread_evidence
// ---------------------------------------------------------------------------
export const threadEvidence = pgTable('thread_evidence', {
  id: serial('id').primaryKey(),
  threadId: integer('thread_id').notNull(),
  day: date('day').notNull(),
  itemId: integer('item_id'),
});

// ---------------------------------------------------------------------------
// stage_config
// ---------------------------------------------------------------------------
export const stageConfig = pgTable('stage_config', {
  stage: text('stage').primaryKey(),
  provider: text('provider').notNull(),
  model: text('model').notNull(),
  baseUrl: text('base_url'),
  apiKeyEnv: text('api_key_env').notNull(),
  params: jsonb('params'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// pipeline_run
// ---------------------------------------------------------------------------
export const pipelineRun = pgTable('pipeline_run', {
  id: serial('id').primaryKey(),
  day: date('day'),
  stage: text('stage').notNull(),
  provider: text('provider'),
  model: text('model'),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  costUsd: real('cost_usd'),
  status: text('status').notNull(),
  error: text('error'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
