import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

const FORBIDDEN_TIMERS: readonly [string, RegExp][] = [
  ['setTimeout', /\bsetTimeout\b/],
  ['setInterval', /\bsetInterval\b/],
  ['Date.now', /\bDate\s*\.\s*now\b/],
  ['performance.now', /\bperformance\s*\.\s*now\b/],
  ['requestAnimationFrame', /\brequestAnimationFrame\b/],
];

const IMPORT_SPEC = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*)(['"])([^'"\n]+)\1/g;

function listTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...listTsFiles(full));
    else if (/\.ts$/.test(name)) out.push(full);
  }
  return out;
}

/** Retire les commentaires (de ligne et de bloc) en respectant les chaînes et gabarits. */
function stripComments(src: string): string {
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
          out += src.slice(i, i + 2);
          i += 2;
          continue;
        }
        out += src[i];
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

function importSpecifiers(source: string): string[] {
  const code = stripComments(source);
  return [...code.matchAll(IMPORT_SPEC)].map((m) => m[2] ?? '');
}

const isTone = (s: string): boolean => s === 'tone' || s.startsWith('tone/');
const isAudio = (s: string): boolean => /(^|\/)audio(\/|$)/.test(s);

/** Violations de l'horloge : timers JS interdits dans `src/audio/`. */
export function findTimerViolations(file: string, source: string): string[] {
  const code = stripComments(source);
  return FORBIDDEN_TIMERS.filter(([, re]) => re.test(code)).map(
    ([name]) => `${file} : « ${name} » interdit (seule l'horloge audio fait foi)`,
  );
}

/** Violations d'import pour un fichier de `src/game` ou `src/core` (audio/ et tone interdits). */
export function findGameCoreImportViolations(file: string, source: string): string[] {
  return importSpecifiers(source)
    .filter((s) => isTone(s) || isAudio(s))
    .map((s) => `${file} : import interdit de « ${s} »`);
}

/** Violation si un fichier autre que tone-adapter.ts importe `tone`. */
export function findToneImportViolations(file: string, source: string): string[] {
  if (file.endsWith('/tone-adapter.ts')) return [];
  return importSpecifiers(source)
    .filter(isTone)
    .map((s) => `${file} : seul tone-adapter.ts peut importer « ${s} »`);
}

const rel = (f: string): string => relative(ROOT, f).replace(/\\/g, '/');

describe('architecture : audio', () => {
  const audioFiles = listTsFiles(join(ROOT, 'src/audio'));
  const gameCoreFiles = [...listTsFiles(join(ROOT, 'src/game')), ...listTsFiles(join(ROOT, 'src/core'))];
  const srcFiles = listTsFiles(join(ROOT, 'src'));

  it('trouve des sources à analyser', () => {
    expect(audioFiles.length).toBeGreaterThan(0);
    expect(gameCoreFiles.length).toBeGreaterThan(0);
  });

  it('aucun timer ni horloge murale dans src/audio', () => {
    const v = audioFiles.flatMap((f) => findTimerViolations(rel(f), readFileSync(f, 'utf8')));
    expect(v, v.join('\n')).toEqual([]);
  });

  it('src/game et src/core n\'importent ni audio/ ni tone', () => {
    const v = gameCoreFiles.flatMap((f) => findGameCoreImportViolations(rel(f), readFileSync(f, 'utf8')));
    expect(v, v.join('\n')).toEqual([]);
  });

  it('seul tone-adapter.ts importe tone', () => {
    const v = srcFiles.flatMap((f) => findToneImportViolations(rel(f), readFileSync(f, 'utf8')));
    expect(v, v.join('\n')).toEqual([]);
  });

  it('détecte les violations et ignore les commentaires (auto-vérification)', () => {
    const bad = `setTimeout(f, 1); setInterval(f, 1); Date.now(); performance.now(); requestAnimationFrame(f);`;
    expect(findTimerViolations('src/audio/x.ts', bad)).toHaveLength(5);
    expect(findTimerViolations('src/audio/x.ts', `// setTimeout\n/* Date.now */ const a = 1;`)).toEqual([]);

    expect(findGameCoreImportViolations('src/game/x.ts', `import { a } from '../audio/conductor';`)).toHaveLength(1);
    expect(findGameCoreImportViolations('src/core/x.ts', `import * as T from 'tone';`)).toHaveLength(1);
    expect(findGameCoreImportViolations('src/game/x.ts', `import { a } from '../config/game.config';`)).toEqual([]);

    expect(findToneImportViolations('src/audio/conductor.ts', `import * as T from 'tone';`)).toHaveLength(1);
    expect(findToneImportViolations('src/audio/tone-adapter.ts', `import * as T from 'tone';`)).toEqual([]);
  });
});
