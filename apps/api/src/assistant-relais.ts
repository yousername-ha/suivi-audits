/* Point d'entrée du conteneur « assistant-relais » (ADR 0086) : aucun accès à la base, aucun secret, aucun fichier. */
import { creerRelais } from './assistant/relais.js';

const vrai = (v: string | undefined) => v === '1' || v === 'true';
const port = Number(process.env.PORT || 8787);
const serveur = creerRelais({
  httpAutorise: vrai(process.env.ASSISTANT_RELAIS_HTTP),
  priveAutorise: vrai(process.env.ASSISTANT_RELAIS_PRIVE),
  journal: (ligne) =>
    process.stdout.write(JSON.stringify({ t: new Date().toISOString(), relais: 'assistant', ...ligne }) + '\n'),
});
serveur.listen(port, '0.0.0.0', () =>
  process.stdout.write(JSON.stringify({ t: new Date().toISOString(), relais: 'assistant', ecoute: port }) + '\n'),
);
for (const signal of ['SIGTERM', 'SIGINT'] as const) process.on(signal, () => serveur.close(() => process.exit(0)));
