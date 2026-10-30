import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const DIRS = ['src/core', 'src/game'];

const FORBIDDEN_MODULES = ['three', 'tone'];
const FORBIDDEN_FOLDERS = ['render', 'audio', 'ui', 'input'];
const FORBIDDEN_GLOBALS = ['document', 'window', 'HTMLElement'];
const FORBIDDEN_CALLS = [
  { name: 'Math.random', re: /\bMath\s*\.\s*random\b/ },
  { name: 'Date.now', re: /\bDate\s*\.\s*now\b/ },
  { name: 'performance.now', re: /\bperformance\s*\.\s*now\b/ },
];

function listTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...listTsFiles(full));
    else if (/\.ts$/.test(name)) out.push(full);
  }
  return out;
}

/**
 * Retire les commentaires (de ligne et de bloc) en respectant les chaînes et gabarits.
 * Si `blankStrings` est vrai, le contenu des chaînes est aussi remplacé par des espaces.
 */
export function strip(src: string, blankStrings: boolean): string {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (c === '/' && n === '/') {
      while (i < src.length && src[i] !== '\n') i++;
    } else if (c === '/' && n === '*') {
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) {
        if (src[i] === '\n') out += '\n';
        i++;
      }
      i += 2;
      out += ' ';
    } else if (c === '"' || c === "'" || c === '`') {
      out += c;
      i++;
      while (i < src.length && src[i] !== c) {
        if (src[i] === '\\') {
          out += blankStrings ? '  ' : src.slice(i, i + 2);
          i += 2;
          continue;
        }
        out += blankStrings && src[i] !== '\n' ? ' ' : src[i];
        i++;
      }
      out += c;
      i++;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

function importSpecifiers(code: string): string[] {
  const specs: string[] = [];
  const re = /\b(?:import|export)\b[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]|\bimport\s*['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)|\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code)) !== null) specs.push(m[1] ?? m[2] ?? m[3] ?? m[4] ?? '');
  return specs;
}

/** Retourne la liste des violations « module : import interdit ». */
export function findViolations(moduleName: string, source: string): string[] {
  const violations: string[] = [];
  const withStrings = strip(source, false);
  const blanked = strip(source, true);

  for (const spec of importSpecifiers(withStrings)) {
    const pkg = spec.split('/')[0] ?? '';
    if (FORBIDDEN_MODULES.includes(pkg)) {
      violations.push(`${moduleName} : import interdit « ${spec} »`);
    }
    const segments = spec.split('/');
    for (const folder of FORBIDDEN_FOLDERS) {
      if (segments.slice(0, -1).includes(folder) || (spec.startsWith('.') && segments.includes(folder))) {
        violations.push(`${moduleName} : import interdit du dossier « ${folder}/ » (« ${spec} »)`);
      }
    }
  }
  for (const g of FORBIDDEN_GLOBALS) {
    if (new RegExp(`\\b${g}\\b`).test(blanked)) {
      violations.push(`${moduleName} : référence interdite à « ${g} »`);
    }
  }
  for (const { name, re } of FORBIDDEN_CALLS) {
    if (re.test(blanked)) violations.push(`${moduleName} : usage interdit de « ${name} »`);
  }
  return violations;
}

describe('architecture : imports interdits dans src/core et src/game', () => {
  const files = DIRS.flatMap((d) => listTsFiles(join(ROOT, d)));

  it('trouve des sources à analyser', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('aucun module ne contient d’import ou d’API interdits', () => {
    const violations = files.flatMap((f) =>
      findViolations(relative(ROOT, f).replace(/\\/g, '/'), readFileSync(f, 'utf8')),
    );
    expect(violations, violations.join('\n')).toEqual([]);
  });

  it('détecte les violations et ignore les commentaires (auto-vérification)', () => {
    const bad = `import * as T from 'three';\nimport { x } from '../render/scene';\nconst a = window; Math.random(); Date.now(); performance.now();`;
    const v = findViolations('src/game/fake.ts', bad);
    expect(v.length).toBe(6);
    expect(v[0]).toContain('src/game/fake.ts');
    expect(v[0]).toContain('three');

    const ok = `// window, Math.random, Date.now\n/** import x from 'three'; document */\nconst s = 'window';`;
    expect(findViolations('src/core/ok.ts', ok)).toEqual([]);
  });
});
