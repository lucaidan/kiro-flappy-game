import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Validates: Requirements 14.6
describe('package.json scripts', () => {
  const pkg = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf-8')) as {
    scripts?: Record<string, string>;
  };

  it.each(['dev', 'build', 'typecheck', 'test', 'lint:fix', 'format'])(
    'defines the "%s" script',
    (name) => {
      expect(typeof pkg.scripts?.[name]).toBe('string');
      expect(pkg.scripts?.[name]?.length).toBeGreaterThan(0);
    },
  );
});
