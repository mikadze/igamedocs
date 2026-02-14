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

const ALLOWED_IMPORT_SOURCES = [
  (importPath: string) => importPath.startsWith('.'),
  (importPath: string) => importPath.startsWith('@shared/'),
  (importPath: string) => importPath === 'crypto',
];

function findApplicationFiles(dir: string): string[] {
  const results: string[] = [];

  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!['node_modules', 'dist', '__tests__'].includes(entry.name)) {
        results.push(...findApplicationFiles(fullPath));
      }
    } else if (
      entry.name.endsWith('.ts') &&
      !entry.name.endsWith('.spec.ts') &&
      fullPath.includes(`${path.sep}application${path.sep}`)
    ) {
      results.push(fullPath);
    }
  }
  return results;
}

describe('Application Purity', () => {
  const applicationFiles = findApplicationFiles(SRC_ROOT);

  it('should find application files to verify', () => {
    expect(applicationFiles.length).toBeGreaterThan(0);
  });

  for (const filePath of applicationFiles) {
    const relativePath = path.relative(SRC_ROOT, filePath);

    describe(relativePath, () => {
      const content = fs.readFileSync(filePath, 'utf-8');

      it('has no framework imports', () => {
        for (const { pattern, label } of FORBIDDEN_PATTERNS) {
          expect(content).not.toMatch(pattern);
        }
      });

      it('only imports from allowed sources (relative, @shared/*, crypto)', () => {
        const importLines = content.match(/^import .+ from ['"](.+)['"];?$/gm) || [];

        for (const line of importLines) {
          const match = line.match(/from ['"](.+)['"]/);
          if (!match) continue;
          const importPath = match[1];

          const isAllowed = ALLOWED_IMPORT_SOURCES.some((check) => check(importPath));

          if (!isAllowed) {
            throw new Error(`Forbidden import "${importPath}" in ${relativePath}`);
          }
        }
      });

      it('does not import from other modules', () => {
        const moduleMatch = relativePath.match(/^([^/]+)\//);
        if (!moduleMatch) return;
        const ownModule = moduleMatch[1];

        const importLines = content.match(/^import .+ from ['"](.+)['"];?$/gm) || [];

        for (const line of importLines) {
          const match = line.match(/from ['"](.+)['"]/);
          if (!match) continue;
          const importPath = match[1];

          if (!importPath.startsWith('.')) continue;

          const resolved = path.resolve(path.dirname(filePath), importPath);
          const resolvedRelative = path.relative(SRC_ROOT, resolved);
          const targetModule = resolvedRelative.split(path.sep)[0];

          if (targetModule !== ownModule) {
            throw new Error(
              `Cross-module import "${importPath}" in ${relativePath} ` +
              `(${ownModule} → ${targetModule}). Use a port interface instead.`,
            );
          }
        }
      });
    });
  }
});
