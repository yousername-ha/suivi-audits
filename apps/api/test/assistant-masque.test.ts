/* Masque des machines (ADR 0100, V14) : dernier contrôle avant l'envoi au fournisseur du modèle. Fonctions pures, sans base :
   nom complet, premier libellé, adresse IPv4 et IPv6, identifiants de la source, casse, ponctuation, machine non lisible,
   libellé partagé par deux machines, repères laissés tels quels, inventaire vide ; transport masquant tous les messages et
   les arguments d'appels d'outils. Données fictives. */
import { describe, expect, it } from 'vitest';
import { creerMasque, type MachineAMasquer, MACHINE_MASQUEE, transportMasque } from '../src/assistant/masque.js';
import type { DemandeModele, ReponseModele, TransportModele } from '../src/assistant/modele.js';

const m = (id: string, nom: string | null, adresse: string | null, lisible = true, uuid?: string): MachineAMasquer => ({
  id,
  nom,
  adresse,
  identifiants: uuid ? [`uuid:${uuid}`, uuid] : adresse ? [`ip:${adresse}|${nom ?? ''}`] : [],
  lisible,
});
const UUID = '00000000-0000-4000-8000-0000000009a1';
const parc = [
  m('a', 'srv-masque-01.exemple.invalid', '192.0.2.201', true, UUID),
  m('b', 'srv-masque-02.exemple.invalid', '2001:db8::2'),
  m('c', 'srv-masque-03.exemple.invalid', '192.0.2.203', false),
  m('d', 'app.exemple.invalid', '192.0.2.204'),
  m('e', 'app.autre.invalid', '192.0.2.205'),
  m('f', '10.exemple.invalid', null),
];
const attribuer = async (ids: string[]) => new Map(ids.map((id) => [id, `M-00${'abcdef'.indexOf(id) + 1}`]));

describe('masque des machines', () => {
  it('remplace nom, premier libellé, adresse et identifiant de la source par le repère de la conversation', async () => {
    const masquer = creerMasque(parc, attribuer);
    expect(await masquer('Patcher srv-masque-01.exemple.invalid puis SRV-MASQUE-02.')).toBe(
      'Patcher M-001 puis M-002.',
    );
    expect(await masquer('Adresse 192.0.2.201:443, ou [2001:db8::2], uuid:' + UUID + ' et ' + UUID + '.')).toBe(
      'Adresse M-001, ou [M-002], M-001 et M-001.',
    );
    expect(await masquer('https://srv-masque-01.autre.invalid/chemin')).toBe('https://M-001/chemin');
  });

  it('machine non lisible, libellé partagé par deux machines : « [machine] », sans repère', async () => {
    const vus: string[] = [];
    const masquer = creerMasque(parc, async (ids) => {
      vus.push(...ids);
      return attribuer(ids);
    });
    expect(await masquer('srv-masque-03 et 192.0.2.203')).toBe(`${MACHINE_MASQUEE} et ${MACHINE_MASQUEE}`);
    // « app » désigne deux machines : aucune n'est désignée, mais le nom ne sort pas ; les noms complets restent distincts.
    expect(await masquer('app, app.exemple.invalid et app.autre.invalid')).toBe(`${MACHINE_MASQUEE}, M-004 et M-005`);
    expect(vus.sort()).toEqual(['d', 'e']);
  });

  it('laisse les repères, les mots sans rapport et les libellés numériques ; sans repère possible : « [machine] »', async () => {
    const masquer = creerMasque(parc, attribuer);
    expect(await masquer('M-001 et M-777 restent ; 10 machines ; srv-masque-010 non plus.')).toBe(
      'M-001 et M-777 restent ; 10 machines ; srv-masque-010 non plus.',
    );
    expect(await creerMasque(parc)('srv-masque-01 et 192.0.2.204')).toBe(`${MACHINE_MASQUEE} et ${MACHINE_MASQUEE}`);
    expect(await creerMasque([], attribuer)('srv-masque-01')).toBe('srv-masque-01');
    // L'identifiant « ip:2001:db8::2|… » ne fait pas de « 2001 » ni de « db8 » une désignation de machine.
    expect(await masquer('En 2001, db8 était un nom de code.')).toBe('En 2001, db8 était un nom de code.');
  });

  it('transport : chaque message et chaque argument d’appel d’outil est masqué avant l’envoi', async () => {
    const recus: DemandeModele[] = [];
    const reel: TransportModele = {
      declare: () => true,
      async completer(_a, _c, d): Promise<ReponseModele> {
        recus.push(d);
        return { message: { role: 'assistant', content: 'ok' }, jetonsEntree: 0, jetonsSortie: 0 };
      },
    };
    const t = transportMasque(reel, creerMasque(parc, attribuer));
    expect(t.declare()).toBe(true);
    const demande: DemandeModele = {
      model: 'modele-fictif',
      messages: [
        { role: 'system', content: 'Contexte : srv-masque-01 est sensible.' },
        { role: 'user', content: 'Et 192.0.2.203 ?' },
        {
          role: 'assistant',
          content: null,
          tool_calls: [
            {
              id: 'x',
              type: 'function',
              function: { name: 'outil', arguments: '{"q":"srv-masque-02.exemple.invalid"}' },
            },
          ],
        },
        { role: 'tool', tool_call_id: 'x', name: 'outil', content: '{"nom":"app.exemple.invalid"}' },
      ],
    };
    await t.completer('https://modele.example.invalid', 'cle', demande);
    const envoye = JSON.stringify(recus[0]);
    expect(envoye).not.toMatch(/srv-masque|192\.0\.2|app\.exemple/);
    expect(recus[0]!.messages.map((x) => x.content)).toEqual([
      'Contexte : M-001 est sensible.',
      `Et ${MACHINE_MASQUEE} ?`,
      null,
      '{"nom":"M-004"}',
    ]);
    expect(recus[0]!.messages[2]!.tool_calls![0]!.function.arguments).toBe('{"q":"M-002"}');
    // La demande d'origine n'est pas modifiée.
    expect(demande.messages[0]!.content).toContain('srv-masque-01');
  });
});
