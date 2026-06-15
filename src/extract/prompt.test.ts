import { describe, it, expect } from 'vitest';
import { buildExtractionPrompt } from './prompt';

describe('buildExtractionPrompt', () => {
  const p = buildExtractionPrompt('（示例联播正文）今日头条……');
  it('embeds the transcript', () => {
    expect(p).toContain('（示例联播正文）');
  });
  it('instructs the 三段式 segmentation and 提法/sector extraction', () => {
    expect(p).toContain('领导动态');
    expect(p).toContain('提法');
    expect(p).toMatch(/行业|板块/);
  });
  it('asks to read it as signal, not restate facts', () => {
    expect(p).toMatch(/信号|编辑选择|不要复述|不臆造|忠实/);
  });
});
