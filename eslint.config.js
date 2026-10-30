import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['node_modules/', 'dist/', 'assets/', 'img/', '.kiro/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // Proposition (non activée : 10 erreurs sur le code existant de src/render) :
  // {
  //   files: ['src/render/**/*.ts'],
  //   rules: { 'no-magic-numbers': ['error', { ignore: [0, 1, -1, 2, 0.5], ignoreArrayIndexes: true }] },
  // },
);
