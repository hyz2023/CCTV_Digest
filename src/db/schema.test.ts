import { describe, it, expect } from 'vitest';
import * as schema from './schema';

describe('db schema', () => {
  it('defines all core tables', () => {
    for (const name of [
      'broadcastDay', 'item', 'tifa', 'tifaMention', 'sectorSignal',
      'dailyInterpretation', 'radarEvent', 'thread', 'threadPoint',
      'threadEvidence', 'stageConfig', 'pipelineRun',
    ]) {
      expect(schema, `missing table export: ${name}`).toHaveProperty(name);
    }
  });

  it('stageConfig is keyed by stage and carries provider/model/apiKeyEnv', () => {
    const cols = Object.keys(schema.stageConfig);
    expect(cols).toEqual(
      expect.arrayContaining(['stage', 'provider', 'model', 'baseUrl', 'apiKeyEnv']),
    );
  });
});
