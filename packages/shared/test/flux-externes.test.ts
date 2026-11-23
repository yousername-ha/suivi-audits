/* Registre des flux vers l'extérieur (ADR 0097) : identifiants stables, description complète de chaque module, schémas du
   changement (confirmation obligatoire) et du rapport de l'exécutant (modules inconnus et erreurs mal formées refusés). */
import { describe, expect, it } from 'vitest';
import {
  FLUX_ERREUR_MAX,
  FLUX_EXTERNES,
  FLUX_MODULES,
  FLUX_REPRISE_ACTEUR,
  estFluxRepris,
  FLUX_REPRISE_EXECUTANT,
  FLUX_REPRISE_MOTIFS,
  FLUX_SANS_REPRISE,
  FluxAppliques,
  FluxChangement,
  FluxConfirme,
  FluxReprise,
  FluxSouhaites,
  fluxExterne,
  sensDuFlux,
} from '../src/index.js';

describe('registre des flux vers l’extérieur', () => {
  it('décrit les cinq modules de l’ADR, puis les connecteurs Tenable et AlgoLightHouse et la veille, dans l’ordre des identifiants stables', () => {
    expect(FLUX_MODULES).toEqual([
      'assistant',
      'courriel',
      'acme',
      'antivirus',
      'mises-a-jour',
      'tenable',
      'veille-vulnerabilites',
      'algolighthouse',
      'veille-reglementaire',
    ]);
    expect(FLUX_EXTERNES.map((f) => f.id)).toEqual([...FLUX_MODULES]);
  });
  it('chaque module a destinations, ports, porteur, données, réglage et pare-feu', () => {
    for (const f of FLUX_EXTERNES) {
      expect(f.libelle, f.id).not.toBe('');
      expect(f.destinations.length, f.id).toBeGreaterThan(0);
      for (const d of f.destinations) {
        expect(['sortant', 'entrant']).toContain(d.sens);
        expect(d.hote, f.id).not.toBe('');
        expect(d.ports, f.id).toMatch(/TCP/);
      }
      expect(f.porteur.services.length, f.id).toBeGreaterThan(0);
      if (f.porteur.type === 'conteneur') expect(f.porteur.profil, f.id).toBeTruthy();
      expect(f.donnees, f.id).not.toBe('');
      // Page de réglage : Configuration système, Plateforme (dont les cartes « Intégrations », ADR 0076, et « Veille des
      // vulnérabilités », ADR 0100, lot VEILLE-PLATEFORME), rubrique Intégrations pour les connecteurs, ou écran de la veille
      // réglementaire (ADR 0110).
      expect(f.reglage.lien, f.id).toMatch(/^\/(systeme\/|plateforme\/|integrations$|veille-reglementaire$)/);
      expect(f.pareFeu.length, f.id).toBeGreaterThan(0);
      expect(f.siFerme, f.id).not.toBe('');
    }
  });
  it('reprend les porteurs décidés : relais de l’assistant, exécutant, passerelle, conteneurs de l’antivirus', () => {
    expect(fluxExterne('assistant').porteur).toMatchObject({ type: 'conteneur', profil: 'assistant' });
    expect(fluxExterne('assistant').porteur.services).toEqual(['assistant-relais']);
    expect(fluxExterne('antivirus').porteur).toMatchObject({ type: 'conteneur', profil: 'antivirus' });
    expect(fluxExterne('antivirus').porteur.services).toContain('freshclam');
    expect(fluxExterne('courriel').porteur).toMatchObject({ type: 'executant', services: ['updater'] });
    expect(fluxExterne('mises-a-jour').porteur).toMatchObject({ type: 'executant', services: ['updater'] });
    expect(fluxExterne('acme').porteur).toMatchObject({ type: 'passerelle', services: ['gateway'] });
    expect(fluxExterne('tenable').porteur).toMatchObject({ type: 'executant', services: ['updater'] });
    expect(fluxExterne('veille-vulnerabilites').porteur).toMatchObject({ type: 'executant', services: ['updater'] });
  });
  it('le certificat ACME sort vers l’autorité et reçoit sur 80 et 443 ; les autres modules ne font que sortir', () => {
    expect(sensDuFlux(fluxExterne('acme'))).toEqual(['sortant', 'entrant']);
    expect(fluxExterne('acme').destinations.find((d) => d.sens === 'entrant')!.ports).toContain('80 et 443');
    for (const m of FLUX_MODULES.filter((x) => x !== 'acme')) expect(sensDuFlux(fluxExterne(m))).toEqual(['sortant']);
    expect(fluxExterne('assistant').destinations[0]!.ports).toContain('443');
    // Tenable Security Center : adresse et port réglés (443 par défaut) ; ce qui sort : les clés d'API et des requêtes de
    // lecture.
    expect(fluxExterne('tenable').pareFeu).toEqual([
      'Sortie TCP du serveur vers Tenable Security Center, sur le port réglé (443 par défaut).',
    ]);
    expect(fluxExterne('tenable').destinations).toEqual([
      expect.objectContaining({
        sens: 'sortant',
        ports: 'TCP du port réglé (443 par défaut, HTTPS)',
        hote: expect.stringMatching(/Adresse réglée/),
      }),
    ]);
    expect(fluxExterne('tenable').donnees).toMatch(/clés d’API.*requêtes de lecture/);
    // Veille des vulnérabilités : une destination par source de la liste fermée, TCP 443 ; aucune donnée métier ne sort.
    expect(
      fluxExterne('veille-vulnerabilites').destinations.map((d) => [d.sens, d.ports, d.hote.split(' ')[0]]),
    ).toEqual([
      ['sortant', 'TCP 443 (HTTPS)', 'www.cisa.gov'],
      ['sortant', 'TCP 443 (HTTPS)', 'services.nvd.nist.gov'],
      ['sortant', 'TCP 443 (HTTPS)', 'api.first.org'],
      ['sortant', 'TCP 443 (HTTPS)', 'cert.cyber.gouv.fr'],
      ['sortant', 'TCP 443 (HTTPS)', 'cyberveille.esante.gouv.fr'],
      // Lot CVE-INC : trois hôtes nouveaux (cve.org sur clic ; sources facultatives désactivées au départ).
      ['sortant', 'TCP 443 (HTTPS)', 'cveawg.mitre.org'],
      ['sortant', 'TCP 443 (HTTPS)', 'radar.cloudflare.com'],
      ['sortant', 'TCP 443 (HTTPS)', 'tldrcve.com'],
    ]);
    expect(fluxExterne('veille-vulnerabilites').donnees).toMatch(/adresse IP du serveur et des demandes de lecture/);
    // Lot CPE-1 (décision du RSSI du 22/11/2026) : la demande des versions d'un produit choisi dans la saisie lui fait
    // connaître ce produit ; le texte le dit, et rien d'autre ne part (ni machine, ni version déclarée).
    expect(fluxExterne('veille-vulnerabilites').donnees).toMatch(
      /l’éditeur et le produit choisis pour en lire les versions/,
    );
    expect(fluxExterne('veille-vulnerabilites').donnees).toMatch(
      /Aucune donnée métier en dehors de ce produit et de cet identifiant : ni machine, ni adresse, ni domaine, ni périmètre, ni version déclarée, ni contenu de la plateforme\./,
    );
    // Lot CVE-INC : seul l'identifiant de la CVE consultée sort, sur le clic d'une personne ; les flux facultatifs sont lus
    // sans aucun paramètre (le filtre par produit surveillé est fait sur le serveur).
    expect(fluxExterne('veille-vulnerabilites').donnees).toMatch(/l’identifiant de cette CVE, vers cve\.org/);
    expect(fluxExterne('veille-vulnerabilites').donnees).toMatch(/sans aucun paramètre/);
    for (const h of ['cveawg.mitre.org', 'radar.cloudflare.com', 'tldrcve.com'])
      expect(fluxExterne('veille-vulnerabilites').pareFeu.join(' ')).toContain(h);
    expect(fluxExterne('tenable').donnees).toMatch(/contrôles Tenable qui citent cette CVE, par son seul identifiant/);
    expect(fluxExterne('veille-vulnerabilites').pareFeu.join(' ')).toContain('cyberveille.esante.gouv.fr');
    expect(fluxExterne('mises-a-jour').destinations.map((d) => d.hote)).toEqual(
      expect.arrayContaining(['github.com et api.github.com (publications)', 'ghcr.io (registre des images)']),
    );
  });
});

describe('geste d’activation (précision du RSSI du 15/11/2026)', () => {
  it('chaque module s’ouvre par son activation ; l’antivirus, les mises à jour et la veille ont le flux pour seule activation', () => {
    for (const f of FLUX_EXTERNES) expect(f.activation.geste, f.id).not.toBe('');
    expect(FLUX_EXTERNES.filter((f) => f.activation.par === 'flux').map((f) => f.id)).toEqual([
      'antivirus',
      'mises-a-jour',
      'veille-vulnerabilites',
      'veille-reglementaire',
    ]);
    expect(fluxExterne('veille-vulnerabilites').activation.geste).toBe('Bouton « Activer la veille »');
    expect(fluxExterne('veille-reglementaire').activation.geste).toBe('Bouton « Activer la veille réglementaire »');
    expect(fluxExterne('antivirus').reglage.lien).toBe('/systeme/securite');
    // Lot VEILLE-PLATEFORME (décision du RSSI du 23/11/2026) : la veille se configure dans la carte de la Plateforme.
    expect(fluxExterne('veille-vulnerabilites').reglage).toEqual({
      libelle: 'Plateforme > Veille des vulnérabilités',
      lien: '/plateforme/veille-vulnerabilites',
    });
    // Activation globale (ADR 0019) : l'assistant, le module Intégrations (connecteur Tenable) et le module Vulnérabilités
    // (veille) sont des modules dont la désactivation referme le flux.
    expect(FLUX_EXTERNES.filter((f) => f.moduleActivation).map((f) => [f.id, f.moduleActivation])).toEqual([
      ['assistant', 'assistant'],
      ['tenable', 'integrations'],
      ['veille-vulnerabilites', 'vulnerabilites'],
      ['algolighthouse', 'integrations'],
      ['veille-reglementaire', 'veille_reglementaire'],
    ]);
    expect(fluxExterne('tenable').activation.par).toBe('module');
    expect(fluxExterne('algolighthouse').activation.par).toBe('module');
  });
  it('la validation jointe à l’activation est un « vrai » explicite', () => {
    expect(FluxConfirme.safeParse(true).success).toBe(true);
    for (const v of [false, 'true', 1, undefined]) expect(FluxConfirme.safeParse(v).success).toBe(false);
  });
});

describe('changement d’un flux', () => {
  it('exige la confirmation explicite, dans les deux sens', () => {
    expect(FluxChangement.safeParse({ ouvert: true, confirmation: true }).success).toBe(true);
    expect(FluxChangement.safeParse({ ouvert: false, confirmation: true }).success).toBe(true);
    expect(FluxChangement.safeParse({ ouvert: true }).success).toBe(false);
    expect(FluxChangement.safeParse({ ouvert: true, confirmation: false }).success).toBe(false);
    expect(FluxChangement.safeParse({ ouvert: true, confirmation: 'oui' }).success).toBe(false);
    expect(FluxChangement.safeParse({ ouvert: true, confirmation: true, module: 'courriel' }).success).toBe(false);
  });
});

describe('protocole de l’exécutant', () => {
  it('les flux souhaités ne nomment que des modules du registre', () => {
    expect(FluxSouhaites.safeParse({ ouverts: ['assistant', 'acme'] }).success).toBe(true);
    expect(FluxSouhaites.safeParse({ ouverts: ['inconnu'] }).success).toBe(false);
  });
  it('le rapport appliqué est validé strictement', () => {
    expect(
      FluxAppliques.safeParse({ assistant: { etat: 'ouvert' }, antivirus: { etat: 'erreur', erreur: 'profil absent' } })
        .success,
    ).toBe(true);
    expect(FluxAppliques.safeParse({}).success).toBe(true);
    // Module inconnu, champ inattendu, état inconnu.
    expect(FluxAppliques.safeParse({ inconnu: { etat: 'ouvert' } }).success).toBe(false);
    expect(FluxAppliques.safeParse({ assistant: { etat: 'ouvert', detail: 'x' } }).success).toBe(false);
    expect(FluxAppliques.safeParse({ assistant: { etat: 'demarre' } }).success).toBe(false);
    // Une erreur accompagne l'état « erreur », et lui seul ; courte, sur une ligne.
    expect(FluxAppliques.safeParse({ assistant: { etat: 'erreur' } }).success).toBe(false);
    expect(FluxAppliques.safeParse({ assistant: { etat: 'ouvert', erreur: 'x' } }).success).toBe(false);
    expect(
      FluxAppliques.safeParse({ assistant: { etat: 'erreur', erreur: 'a'.repeat(FLUX_ERREUR_MAX + 1) } }).success,
    ).toBe(false);
    expect(FluxAppliques.safeParse({ assistant: { etat: 'erreur', erreur: 'ligne 1\nligne 2' } }).success).toBe(false);
    expect(FluxAppliques.safeParse({ assistant: { etat: 'ferme', erreur: null } }).success).toBe(true);
  });
});

describe('reprise de l’existant (précision du RSSI du 16/11/2026)', () => {
  it('un acteur système explicite, des motifs pour chaque module du registre', () => {
    expect(FLUX_REPRISE_ACTEUR).toBe('reprise-mise-a-jour');
    // Les flux nés avec le registre (Tenable, AlgoLightHouse, veille des vulnérabilités) n'ont rien à reprendre : ils sont
    // nommés, pas oubliés.
    expect([...FLUX_SANS_REPRISE].sort()).toEqual([
      'algolighthouse',
      'tenable',
      'veille-reglementaire',
      'veille-vulnerabilites',
    ]);
    const repris = FLUX_MODULES.filter(estFluxRepris);
    expect(Object.keys(FLUX_REPRISE_MOTIFS).sort()).toEqual([...repris].sort());
    for (const m of repris)
      for (const [code, phrase] of Object.entries(FLUX_REPRISE_MOTIFS[m])) {
        expect(code, m).toMatch(/^[a-z][a-z-]{2,40}$/);
        expect(phrase, `${m}.${code}`).toMatch(/\.$/);
      }
    // Le courriel est constaté par l'API au démarrage, jamais déclaré par un exécutant.
    expect([...FLUX_REPRISE_EXECUTANT].sort()).toEqual(repris.filter((m) => m !== 'courriel').sort());
    // Aucune déclaration d'exécutant ne peut ouvrir un flux né avec le registre.
    for (const m of FLUX_SANS_REPRISE)
      expect(FluxReprise.safeParse({ enService: { [m]: 'conteneur-present' } }).success).toBe(false);
  });
  it('l’entrée de l’exécutant est validée strictement', () => {
    expect(FluxReprise.safeParse({ enService: {} }).success).toBe(true);
    expect(
      FluxReprise.safeParse({
        enService: {
          assistant: 'conteneur-present',
          acme: 'env-acme',
          antivirus: 'env-renseigne',
          'mises-a-jour': 'mise-a-jour-installee',
        },
      }).success,
    ).toBe(true);
    for (const entree of [
      {},
      { enService: { inconnu: 'conteneur-present' } },
      { enService: { courriel: 'envoi-actif' } },
      { enService: { acme: 'conteneur-present' } },
      { enService: { 'mises-a-jour': 'env-renseigne' } },
      { enService: { acme: '' } },
      { enService: { acme: 'passerelle-acme' }, motif: 'texte' },
      { enService: ['acme'] },
    ])
      expect(FluxReprise.safeParse(entree).success, JSON.stringify(entree)).toBe(false);
  });
});
