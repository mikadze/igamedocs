import { readFileSync, readdirSync, statSync } from 'fs';
import * as path from 'path';

/**
 * P4.4 — Domain Purity Verification
 *
 * Validates the Clean Architecture invariant: domain, application,
 * and shared kernel layers must contain ZERO NestJS framework imports.
 * Source dependencies point inward only.
 */

const ROOT = path.resolve(__dirname, '../../src');

const PURE_DIRECTORIES = [
  'engine/domain',
  'engine/application',
  'betting/application',
  'rng/domain',
  'shared',
];

const FORBIDDEN_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /@Injectable/, label: '@Injectable decorator' },
  { pattern: /@Inject\b/, label: '@Inject decorator' },
  { pattern: /@Module/, label: '@Module decorator' },
  { pattern: /@Controller/, label: '@Controller decorator' },
  { pattern: /from\s+['"]@nestjs\//, label: '@nestjs/ import' },
  { pattern: /require\s*\(\s*['"]@nestjs\//, label: '@nestjs/ require' },
];

function findTsFiles(dir: string): string[] {
  const results: string[] = [];
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...findTsFiles(full));
    } else if (entry.endsWith('.ts')) {
      results.push(full);
    }
  }
  return results;
}

describe('Domain purity', () => {
  const violations: string[] = [];
  let totalFiles = 0;

  beforeAll(() => {
    for (const dir of PURE_DIRECTORIES) {
      const absDir = path.join(ROOT, dir);
      const files = findTsFiles(absDir);
      totalFiles += files.length;

      for (const absPath of files) {
        const content = readFileSync(absPath, 'utf-8');
        const relPath = path.relative(ROOT, absPath);

        for (const { pattern, label } of FORBIDDEN_PATTERNS) {
          if (pattern.test(content)) {
            violations.push(`${relPath}: found ${label}`);
          }
        }
      }
    }
  });

  it('has no NestJS framework imports in domain, application, or shared layers', () => {
    if (violations.length > 0) {
      const report = violations.map((v) => `  - ${v}`).join('\n');
      fail(`Domain purity violations detected:\n${report}`);
    }
  });

  it('scans at least 10 source files (sanity check)', () => {
    expect(totalFiles).toBeGreaterThanOrEqual(10);
  });
});
