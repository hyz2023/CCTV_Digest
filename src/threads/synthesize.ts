import { generateObject } from 'ai';
import { loadStageConfig } from '@/llm/loadStageConfig';
import { getModel, JSON_SYSTEM } from '@/llm/model';
import { normalizeUsage, recordLlmRun } from '@/llm/usage';
import { buildThreadPrompt, type ThreadPromptInput } from './prompt';
import { ThreadSetSchema, type ThreadSet } from './schema';

export interface SynthesizeDeps { generate: (input: ThreadPromptInput) => Promise<ThreadSet> }

const DEFAULT_DEPS: SynthesizeDeps = {
  generate: async (input) => {
    const cfg = await loadStageConfig('thread');
    const { object, usage } = await generateObject({ model: getModel(cfg), schema: ThreadSetSchema, system: JSON_SYSTEM, prompt: buildThreadPrompt(input) });
    await recordLlmRun({ stage: 'thread', provider: cfg.provider, model: cfg.model, usage: normalizeUsage(usage) });
    return object;
  },
};

export async function synthesizeThreads(input: ThreadPromptInput, deps: SynthesizeDeps = DEFAULT_DEPS): Promise<ThreadSet> {
  if (!input.terms.length) throw new Error('cannot synthesize threads with no terms');
  return deps.generate(input);
}
