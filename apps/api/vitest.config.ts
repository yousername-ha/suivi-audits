import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Les paquets du dépôt sont résolus vers leurs sources TypeScript (condition « source »).
  resolve: { conditions: ['source', 'module', 'node', 'default'] },
  ssr: { resolve: { conditions: ['source', 'module', 'node', 'default'], externalConditions: ['source'] } },
  test: {
    include: ['test/**/*.test.ts'],
    globalSetup: ['test/global-setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // Chaque fichier de test utilise sa propre base : exécution parallèle sûre.
    pool: 'forks',
  },
});
