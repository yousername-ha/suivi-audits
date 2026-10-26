// ESLint (configuration « flat ») : JavaScript, TypeScript strict, règles des hooks React.
import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/test-results/**',
      'tests/e2e/.tmp-e2e/**',
      'app/public/**',
      'docs/cartographie/**',
      'apps/web/src/generated/**',
      '**/*.generated.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...globals.node } },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      eqeqeq: ['error', 'smart'],
      'no-console': 'off',
    },
  },
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks },
    // Mêmes contrôles qu'avec le plugin 5 (règles des hooks et dépendances) ; les règles « React Compiler » ajoutées en 7
    // ne sont pas reprises ici (36 constats de conception à traiter séparément).
    rules: { 'react-hooks/rules-of-hooks': 'error', 'react-hooks/exhaustive-deps': 'warn' },
  },
  {
    // Accès aux données (ADR 0062) : requêtes Kysely paramétrées ou SQL paramétré ($1, $2…). sql.raw insère du texte
    // sans paramètre : interdit dans l'API. Drizzle est retiré.
    files: ['apps/api/src/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[object.name='sql'][property.name=/^(raw|lit)$/]",
          message:
            'sql.raw / sql.lit insèrent du texte non paramétré (ADR 0062) : utiliser une valeur liée ou sql.ref.',
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          paths: [{ name: 'drizzle-orm', message: 'Drizzle est retiré (ADR 0062) : utiliser Kysely (svc.db.k).' }],
          patterns: ['drizzle-orm/*'],
        },
      ],
    },
  },
  {
    // Intégration de l'outil historique : script navigateur classique (ES5, sans module).
    files: ['docker/maintenance/*.js'],
    languageOptions: { sourceType: 'script', globals: { ...globals.browser } },
  },
  {
    files: ['**/test/**/*.ts', 'tests/e2e/**/*.ts'],
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  },
);
