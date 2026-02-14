/**
 * Build-time guard: ensures the AsyncAPI spec's JSON schemas
 * match the Zod schemas used at runtime for inbound command validation.
 *
 * Compares structural contract (types, required fields, constraints)
 * while ignoring:
 *  - `description` fields (human-written spec enrichments)
 *  - `pattern` on UUID fields (Zod adds regex, spec uses `format: uuid`)
 *  - `maximum` safe-integer bounds added by Zod
 *  - `additionalProperties` added by Zod
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register scripts/validate-asyncapi-schemas.ts
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parse } from 'yaml';
import { z } from 'zod';
import { placeBetSchema, cashoutSchema } from '../src/messaging/schemas';

const placeBetJsonSchema = z.toJSONSchema(placeBetSchema);
const cashoutJsonSchema = z.toJSONSchema(cashoutSchema);

const specPath = resolve(__dirname, '..', 'asyncapi.yaml');
const specContent = readFileSync(specPath, 'utf-8');
const spec = parse(specContent);

/**
 * Recursively strip non-structural keys so Zod output and hand-written
 * AsyncAPI schemas can be compared on contract essentials only.
 */
function stripNonStructural(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj.map(stripNonStructural).sort();
  }
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      // Skip enrichment / Zod-specific fields
      if (['$schema', 'description', 'pattern', 'additionalProperties'].includes(key)) continue;
      // Skip safe-integer maximum added by Zod for .int()
      if (key === 'maximum' && value === 9007199254740991) continue;
      result[key] = stripNonStructural(value);
    }
    return result;
  }
  return obj;
}

function stableStringify(obj: unknown): string {
  return JSON.stringify(obj, (_, v) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      return Object.keys(v).sort().reduce<Record<string, unknown>>((acc, k) => {
        acc[k] = v[k];
        return acc;
      }, {});
    }
    return v;
  });
}

const checks: Array<{ name: string; fromZod: unknown; fromSpec: unknown }> = [
  {
    name: 'PlaceBetPayload',
    fromZod: stripNonStructural(placeBetJsonSchema),
    fromSpec: stripNonStructural(spec.components?.schemas?.PlaceBetPayload),
  },
  {
    name: 'CashoutPayload',
    fromZod: stripNonStructural(cashoutJsonSchema),
    fromSpec: stripNonStructural(spec.components?.schemas?.CashoutPayload),
  },
];

let failed = false;

for (const { name, fromZod, fromSpec } of checks) {
  if (!fromSpec) {
    console.error(`MISSING: ${name} not found in asyncapi.yaml components.schemas`);
    failed = true;
    continue;
  }

  if (stableStringify(fromZod) !== stableStringify(fromSpec)) {
    console.error(`MISMATCH: ${name}`);
    console.error('  From Zod:', JSON.stringify(fromZod, null, 2));
    console.error('  From spec:', JSON.stringify(fromSpec, null, 2));
    failed = true;
  }
}

if (failed) {
  console.error('\nAsyncAPI spec is out of sync with Zod schemas.');
  process.exit(1);
} else {
  console.log('AsyncAPI schemas are in sync with Zod schemas.');
}
