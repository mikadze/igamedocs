import * as fs from 'fs';
import * as path from 'path';

const SRC_ROOT = path.resolve(__dirname, '..', '..');

const FORBIDDEN_PATTERNS = [
  { pattern: /@nestjs\//, label: '@nestjs/*' },
  { pattern: /drizzle-orm/, label: 'drizzle-orm' },
  { pattern: /ioredis/, label: 'ioredis' },
  { pattern: /undici/, label: 'undici' },
  { pattern: /node:http/, label: 'node:http' },
  { pattern: /node:net/, label: 'node:net' },
  { pattern: /@Injectable/, label: '@Injectable' },
  { pattern: /@Inject\b/, label: '@Inject' },
  { pattern: /@Module/, label: '@Module' },
  { pattern: /ConfigService/, label: 'ConfigService' },
];

function findDomainFiles(dir: string): string[] {
  const results: string[] = [];

  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!['node_modules', 'dist', '__tests__'].includes(entry.name)) {
        results.push(...findDomainFiles(fullPath));
      }
    } else if (
      entry.name.endsWith('.ts') &&
      !entry.name.endsWith('.spec.ts') &&
      fullPath.includes(`${path.sep}domain${path.sep}`)
    ) {
      results.push(fullPath);
    }
  }
  return results;
}

describe('Domain Purity', () => {
  const domainFiles = findDomainFiles(SRC_ROOT);

  it('should find domain files to verify', () => {
    expect(domainFiles.length).toBeGreaterThan(0);
  });

  for (const filePath of domainFiles) {
    const relativePath = path.relative(SRC_ROOT, filePath);

    describe(relativePath, () => {
      const content = fs.readFileSync(filePath, 'utf-8');

      it('has no framework imports', () => {
        for (const { pattern, label } of FORBIDDEN_PATTERNS) {
          expect(content).not.toMatch(pattern);
        }
      });

      it('only imports from domain or shared kernel', () => {
        const importLines = content.match(/^import .+ from ['"](.+)['"];?$/gm) || [];

        for (const line of importLines) {
          const match = line.match(/from ['"](.+)['"]/);
          if (!match) continue;
          const importPath = match[1];

          const isRelative = importPath.startsWith('.');
          const isSharedKernel = importPath.startsWith('@shared/');

          expect(isRelative || isSharedKernel).toBe(true);
        }
      });
    });
  }
});
