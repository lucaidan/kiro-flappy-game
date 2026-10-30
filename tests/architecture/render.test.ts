import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

const HEX_0X = /\b0x[0-9a-fA-F]{6}\b/;
const HEX_HASH = /(['"`])[^'"`\n]*#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-fA-F])[^'"`\n]*\1/;
const FORBIDDEN_REFS = ['createTempRenderer', 'TempRenderer', 'simple-actors'];
const EXPORT_DEFAULT = /\bexport\s+default\b/;

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

/** Violations du Rendu pour un fichier de `src/render/` (couleurs littérales, export par défaut). */
export function findRenderViolations(file: string, source: string): string[] {
  const code = stripComments(source);
  const v: string[] = [];
  if (HEX_0X.test(code)) v.push(`${file} : couleur littérale 0xRRGGBB interdite (utiliser PALETTE)`);
  if (HEX_HASH.test(code)) v.push(`${file} : couleur littérale #hex interdite (utiliser PALETTE)`);
  if (EXPORT_DEFAULT.test(code)) v.push(`${file} : export default interdit`);
  return v;
}

/** Violations de références au Rendu_Temporaire pour un fichier de `src/`. */
export function findTempRendererRefs(file: string, source: string): string[] {
  const code = stripComments(source);
  return FORBIDDEN_REFS.filter((r) => code.includes(r)).map(
    (r) => `${file} : référence interdite à « ${r} »`,
  );
}

const rel = (f: string): string => relative(ROOT, f).replace(/\\/g, '/');

describe('architecture : rendu 2.5D', () => {
  const renderFiles = listTsFiles(join(ROOT, 'src/render'));
  const srcFiles = listTsFiles(join(ROOT, 'src'));

  it('trouve des sources à analyser', () => {
    expect(renderFiles.length).toBeGreaterThan(0);
    expect(srcFiles.length).toBeGreaterThan(0);
  });

  it('aucune couleur littérale ni export default dans src/render', () => {
    const violations = [...renderFiles, join(ROOT, 'src/main.ts')].flatMap((f) =>
      findRenderViolations(rel(f), readFileSync(f, 'utf8')),
    );
    expect(violations, violations.join('\n')).toEqual([]);
  });

  it('aucune référence au Rendu_Temporaire dans src', () => {
    const violations = srcFiles.flatMap((f) => findTempRendererRefs(rel(f), readFileSync(f, 'utf8')));
    expect(violations, violations.join('\n')).toEqual([]);
  });

  it('détecte les violations et ignore les commentaires (auto-vérification)', () => {
    const bad = `const a = 0xff00aa;\nconst b = '#fff';\nconst c = "#a1b2c3";\nexport default a;`;
    const v = findRenderViolations('src/render/fake.ts', bad);
    expect(v.length).toBe(3);
    expect(v[0]).toContain('src/render/fake.ts');
    expect(findTempRendererRefs('src/main.ts', 'createTempRenderer(); import "./simple-actors";')).toHaveLength(3);

    const ok = `// 0xff00aa '#fff' export default\n/** TempRenderer */\nconst n = 0xff;\nconst id = '#a';`;
    expect(findRenderViolations('src/render/ok.ts', ok)).toEqual([]);
    expect(findTempRendererRefs('src/render/ok.ts', ok)).toEqual([]);
  });
});

// Note : sans dépôt git (.git absent), la vérification est ignorée ; l'immutabilité de
// src/core et src/game est alors à vérifier manuellement (dates de modification vs travaux M2).
describe('architecture : Moteur inchangé par M2', () => {
  it.skipIf(!existsSync(join(ROOT, '.git')))(
    'src/core et src/game sont identiques au dernier commit',
    () => {
      const r = spawnSync('git', ['diff', '--quiet', 'HEAD', '--', 'src/core', 'src/game'], { cwd: ROOT });
      expect(r.status, 'src/core ou src/game modifié depuis le dernier commit').toBe(0);
    },
  );
});