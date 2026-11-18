/* Masque des machines (ADR 0100, V14) : dernier contrôle avant l'envoi au fournisseur du modèle. Fonctions pures, sans base :
   nom complet, premier libellé, adresse IPv4 et IPv6, identifiants de la source, casse, ponctuation, machine non lisible,
   libellé partagé par deux machines, repères laissés tels quels, inventaire vide ; transport masquant tous les messages et
   les arguments d'appels d'outils. Liste de mots à ne pas masquer (V31) : mot seul laissé, casse, nom complet, adresse et
   identifiants toujours masqués, jeton plus long toujours masqué, mot sans machine, mot partagé par deux machines, nom entier
   égal au mot, « DOMAINE\\MACHINE » et « $ », mot de forme interdite ignoré. Surface externe (lot ALH2) : domaines et
   adresses remis comme identifiants, sous-domaines d'un domaine connu, remplacement propre, repères « E-… » laissés tels
   quels, jamais démasqués par la liste. Données fictives. */
import { describe, expect, it } from 'vitest';
import {
  creerMasque,
  formesDuNom,
  type MachineAMasquer,
  MACHINE_MASQUEE,
  transportMasque,
} from '../src/assistant/masque.js';
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

  it('nom de machine avec un tiret bas (nom Windows) : reconnu en entier, avec ou sans domaine devant', async () => {
    const masquer = creerMasque([m('a', 'SRV_MASQUE_01', '192.0.2.211')], attribuer);
    expect(await masquer('Redémarrer srv_masque_01, puis EXEMPLE\\SRV_MASQUE_01.')).toBe(
      'Redémarrer M-001, puis EXEMPLE\\M-001.',
    );
    expect(await masquer('Le mot masque seul reste.')).toBe('Le mot masque seul reste.');
  });

  it('noms que le découpage en jetons ne reconnaît pas : espace, accent, « $ », « DOMAINE\\MACHINE » (relecture du 16/11/2026)', async () => {
    const masquer = creerMasque(
      [
        m('a', 'PC ACCUEIL 3', '192.0.2.221'),
        m('b', 'srv-été01', '192.0.2.222'),
        m('c', 'IMPRIMANTE$', '192.0.2.223'),
        m('d', 'EXEMPLE\\SRVBASE01', '192.0.2.224'),
      ],
      attribuer,
    );
    expect(await masquer('Le poste PC ACCUEIL 3 est touché, comme pc accueil 3.')).toBe(
      'Le poste M-001 est touché, comme M-001.',
    );
    expect(await masquer('{"machine":"PC ACCUEIL 3"}')).toBe('{"machine":"M-001"}');
    expect(await masquer('Redémarrer srv-été01 ce soir.')).toBe('Redémarrer M-002 ce soir.');
    expect(await masquer('File IMPRIMANTE$ et imprimante seule.')).toBe('File M-003 et M-003 seule.');
    expect(await masquer('Compte EXEMPLE\\SRVBASE01, ou srvbase01 seul.')).toBe('Compte M-004, ou M-004 seul.');
    // Frontière de mot : la clé au milieu d'un mot plus long n'est pas masquée.
    expect(await masquer('Le mot superPC ACCUEIL 30 reste.')).toBe('Le mot superPC ACCUEIL 30 reste.');
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

describe('liste de mots à ne pas masquer (V31)', () => {
  const UUID_DPI = '00000000-0000-4000-8000-0000000009b1';
  const dpi = m('a', 'dpi.exemple.invalid', '192.0.2.231', true, UUID_DPI);

  it('sans liste, le masque reste strict ; avec « dpi », le mot seul sort, quelle que soit sa casse', async () => {
    expect(await creerMasque([dpi], attribuer)('Le DPI est lent.')).toBe('Le M-001 est lent.');
    const masquer = creerMasque([dpi], attribuer, ['DPI']);
    expect(await masquer('Le DPI est lent ; dpi aussi, et Dpi.')).toBe('Le DPI est lent ; dpi aussi, et Dpi.');
    expect(await masquer('{"q":"dpi"} (dpi) « dpi »')).toBe('{"q":"dpi"} (dpi) « dpi »');
  });

  it('nom complet, adresse, identifiants et jetons plus longs restent masqués', async () => {
    const masquer = creerMasque([dpi], attribuer, ['dpi']);
    expect(
      await masquer(`dpi.exemple.invalid, DPI.autre.invalid, dpi:8443, 192.0.2.231, uuid:${UUID_DPI} et ${UUID_DPI}.`),
    ).toBe('M-001, M-001, M-001, M-001, M-001 et M-001.');
    // « \ » devant ou « $ » derrière : forme d'un nom de machine Windows, toujours masquée.
    expect(await masquer('EXEMPLE\\dpi et dpi$ ; le dpi seul.')).toBe('EXEMPLE\\M-001 et M-001$ ; le dpi seul.');
    expect(await masquer('https://dpi/chemin')).toBe('https://dpi/chemin');
  });

  it('mot sans machine : aucun effet ; les autres clés restent masquées', async () => {
    const masquer = creerMasque([dpi], attribuer, ['pacs']);
    expect(await masquer('Le PACS et le DPI.')).toBe('Le PACS et le M-001.');
  });

  it('mot partagé par deux machines : laissé seul, noms complets distincts toujours masqués', async () => {
    const machines = [m('d', 'web.exemple.invalid', '192.0.2.234'), m('e', 'web.autre.invalid', '192.0.2.235')];
    expect(await creerMasque(machines, attribuer)('Le web.')).toBe(`Le ${MACHINE_MASQUEE}.`);
    expect(await creerMasque(machines, attribuer, ['web'])('Le web, web.exemple.invalid et web.autre.invalid.')).toBe(
      'Le web, M-004 et M-005.',
    );
  });

  it('nom entier égal au mot : le mot seul sort ; adresse, identifiant et jeton plus long restent masqués', async () => {
    const masquer = creerMasque([m('a', 'web', '192.0.2.240')], attribuer, ['WEB']);
    expect(await masquer('Le web répond sur web:443 (192.0.2.240), ip:192.0.2.240|web.')).toBe(
      'Le web répond sur M-001 (M-001), M-001.',
    );
  });

  it('« DOMAINE\\MACHINE » et nom terminé par « $ » : le mot seul sort, le nom complet reste masqué', async () => {
    const masquer = creerMasque([m('a', 'EXEMPLE\\PACS', '192.0.2.241'), m('b', 'RIS$', '192.0.2.242')], attribuer, [
      'pacs',
      'ris',
    ]);
    expect(await masquer('Le pacs et le RIS ; EXEMPLE\\PACS, AUTRE\\PACS et RIS$.')).toBe(
      'Le pacs et le RIS ; M-001, AUTRE\\M-001 et M-002.',
    );
  });

  it('mot accentué : cherché tel quel, laissé seul, masqué quand il est relié à un autre mot', async () => {
    const masquer = creerMasque([m('a', 'été.exemple.invalid', '192.0.2.243')], attribuer, ['ÉTÉ']);
    expect(await masquer('En été ; été.exemple.invalid ; été.autre.')).toBe('En été ; M-001 ; M-001.autre.');
  });

  it('jamais une adresse, un identifiant, un repère ni un nom complet, même remis sans contrôle', async () => {
    const machines = [dpi, { ...m('b', 'pacs.exemple.invalid', '2001:db8::7'), identifiants: ['abc123'] }];
    const masquer = creerMasque(machines, attribuer, [
      UUID_DPI,
      `uuid:${UUID_DPI}`,
      '192.0.2.231',
      '2001:db8::7',
      'ip:192.0.2.231',
      'dpi.exemple.invalid',
      'dpi:8443',
      'M-001',
      // Forme admise, mais identifiant d'une machine : ignoré.
      'abc123',
    ]);
    expect(
      await masquer(`${UUID_DPI} uuid:${UUID_DPI} 192.0.2.231 [2001:db8::7] dpi.exemple.invalid dpi:8443 abc123 dpi`),
    ).toBe('M-001 M-001 M-001 [M-002] M-001 M-001 M-002 M-001');
  });

  it('formes d’un nom : nom entier, partie après « \\ », nom sans « $ », premier libellé', () => {
    expect(formesDuNom('dpi.exemple.invalid')).toEqual(['dpi.exemple.invalid', 'dpi']);
    expect(formesDuNom('EXEMPLE\\PACS$')).toEqual(['exemple\\pacs$', 'pacs$', 'exemple\\pacs', 'pacs']);
    expect(formesDuNom('web')).toEqual(['web']);
    expect(formesDuNom('db.exemple.invalid')).toEqual(['db.exemple.invalid']);
    expect(formesDuNom('10.exemple.invalid')).toEqual(['10.exemple.invalid']);
    expect(formesDuNom(null)).toEqual([]);
  });
});

describe('surface externe (lot ALH2)', () => {
  const actif = (id: string, valeurs: string[], lisible = true): MachineAMasquer => ({
    id,
    nom: null,
    adresse: null,
    identifiants: valeurs,
    domaines: valeurs.filter((v) => v.includes('.') && !/^[0-9.]+$/.test(v)),
    lisible,
    masque: '[actif externe]',
  });
  const reperes = async (ids: string[]) => new Map(ids.map((id) => [id, id === 'x1' ? 'E-001' : 'E-002']));

  it('domaine, sous-domaine, adresse : repère externe pour qui les lit, sinon leur propre remplacement', async () => {
    const masquer = creerMasque(
      [actif('x1', ['www.exemple-fictif.example', '192.0.2.10']), actif('x2', ['198.51.100.20'], false)],
      reperes,
    );
    expect(
      await masquer(
        'WWW.Exemple-Fictif.example, https://api.www.exemple-fictif.example/x, 192.0.2.10:443, 198.51.100.20.',
      ),
    ).toBe('E-001, https://E-001/x, E-001, [actif externe].');
    // Un domaine parent ou voisin, inconnu, n'est pas masqué ; un repère E-… déjà présent est laissé tel quel.
    expect(await masquer('exemple-fictif.example et E-002')).toBe('exemple-fictif.example et E-002');
  });

  it('jamais démasqués par la liste de mots (V31) ; sans repère, en ronde : leur propre remplacement', async () => {
    const parcExterne = [actif('x1', ['intranet', 'intranet.exemple-fictif.example'])];
    expect(await creerMasque(parcExterne, reperes, ['intranet'])('Voir intranet.')).toBe('Voir E-001.');
    expect(await creerMasque(parcExterne)('Voir intranet.')).toBe('Voir [actif externe].');
  });
});
