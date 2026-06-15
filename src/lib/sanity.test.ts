import { describe, it, expect } from 'vitest';
import { projectName } from '@/lib/sanity';

describe('toolchain', () => {
  it('imports source modules and runs assertions', () => {
    expect(projectName()).toBe('CCTV_Digest');
  });
});
