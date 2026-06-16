import { generateObject } from 'ai';
import { loadStageConfig } from '@/llm/loadStageConfig';
import { getModel, JSON_SYSTEM } from '@/llm/model';
import { normalizeUsage, recordLlmRun } from '@/llm/usage';
import { buildInterpretationPrompt, type InterpInput } from './prompt';
import { DeepInterpretationSchema, type DeepInterpretation } from './schema';

export interface InterpretDeps { generate: (input: InterpInput) => Promise<DeepInterpretation> }

const DEFAULT_DEPS: InterpretDeps = {
  generate: async (input) => {
    const cfg = await loadStageConfig('deep');
    const { object, usage } = await generateObject({
      model: getModel(cfg),
      schema: DeepInterpretationSchema,
      system: JSON_SYSTEM,
      prompt: buildInterpretationPrompt(input),
    });
    await recordLlmRun({ day: input.date, stage: 'deep', provider: cfg.provider, model: cfg.model, usage: normalizeUsage(usage) });
    return object;
  },
};

export async function interpretDay(input: InterpInput, deps: InterpretDeps = DEFAULT_DEPS): Promise<DeepInterpretation> {
  if (!input.items.length) throw new Error('cannot interpret a day with no items');
  return deps.generate(input);
}
