import { generateObject } from 'ai';
import { loadStageConfig } from '@/llm/loadStageConfig';
import { getModel } from '@/llm/model';
import { buildExtractionPrompt } from './prompt';
import { ExtractionSchema, type Extraction } from './schema';

export interface ExtractDeps {
  generate: (text: string) => Promise<Extraction>;
}

const DEFAULT_DEPS: ExtractDeps = {
  generate: async (text) => {
    const cfg = await loadStageConfig('extraction');
    const { object } = await generateObject({
      model: getModel(cfg),
      schema: ExtractionSchema,
      prompt: buildExtractionPrompt(text),
    });
    return object;
  },
};

export async function extractTranscript(text: string, deps: ExtractDeps = DEFAULT_DEPS): Promise<Extraction> {
  if (!text.trim()) throw new Error('transcript must not be empty');
  return deps.generate(text);
}
