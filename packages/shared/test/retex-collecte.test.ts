/* Collecte du RETEX : lecture tolérante, identifiants de proposition, synthèse, règle de modification par l'auteur et
   validation des échanges. Données fictives. */
import { describe, expect, it } from 'vitest';
import {
  InvitationRetex,
  LotEvenementsRetex,
  OuvertureRetex,
  TraitementProposition,
  identifiantProposition,
  lireCollecteRetex,
  lireIncident,
  propositionModifiable,
  syntheseCollecte,
} from '../src/index.js';

const brut = {
  statut: 'ouverte',
  piloteId: 'p',
  piloteNom: 'Pilote fictif',
  contributeurs: [
    { id: 'a', nom: 'A', termineLe: '2026-10-20T10:00:00Z' },
    { id: 'b', nom: 'B' },
    { nom: 'sans identifiant' },
  ],
  propositions: [
    { id: 'PR-002', auteurId: 'b', ts: '2026-10-12T10:00', titre: 'Deux', statut: 'rejetee', motif: 'Hors sujet' },
    { id: 'PR-001', auteurId: 'a', ts: '2026-10-12T09:00', titre: 'Un', statut: 'inconnu' },
    { id: 'PR-003', auteurId: 'a', ts: '2026-10-12T11:00', titre: 'Trois', statut: 'acceptee', evenementId: 'EV-001' },
    { id: 'PR-004', ts: '2026-10-12T11:00' },
  ],
};

describe('RETEX : collecte', () => {
  it('lit la collecte, ignore les entrées incomplètes et trie les propositions', () => {
    const c = lireCollecteRetex(brut)!;
    expect(c.contributeurs.map((x) => x.id)).toEqual(['a', 'b']);
    expect(c.propositions.map((p) => [p.id, p.statut])).toEqual([
      ['PR-001', 'en_attente'],
      ['PR-002', 'rejetee'],
      ['PR-003', 'acceptee'],
    ]);
    expect(lireCollecteRetex({ statut: 'ouverte' })).toBeNull();
    expect(lireCollecteRetex(null)).toBeNull();
  });
  it('rattache la collecte à l’incident sans toucher au texte « retex » historique', () => {
    const i = lireIncident({ id: 'INC-1', retex: 'Enseignements', retexCollecte: brut })!;
    expect(i.retex).toBe('Enseignements');
    expect(i.collecte?.piloteNom).toBe('Pilote fictif');
  });
  it('numérote les propositions sans réattribuer un numéro retiré', () => {
    expect(identifiantProposition([])).toBe('PR-001');
    expect(identifiantProposition(['PR-001'], 3)).toBe('PR-004');
  });
  it('synthétise la collecte et applique la règle de modification', () => {
    const c = lireCollecteRetex(brut)!;
    expect(syntheseCollecte(c)).toEqual({ contributeurs: 2, termines: 1, enAttente: 1, traitees: 2, acceptees: 1 });
    expect(syntheseCollecte(null)).toEqual({ contributeurs: 0, termines: 0, enAttente: 0, traitees: 0, acceptees: 0 });
    const [p1, p2] = c.propositions;
    expect(propositionModifiable(c, p1!, 'a')).toBe(true);
    expect(propositionModifiable(c, p1!, 'b')).toBe(false);
    expect(propositionModifiable(c, p2!, 'b')).toBe(false);
    expect(propositionModifiable({ ...c, statut: 'cloturee' }, p1!, 'a')).toBe(false);
  });
  it('valide les échanges', () => {
    expect(OuvertureRetex.safeParse({ echeance: '2026-11-31' }).success).toBe(false);
    expect(OuvertureRetex.safeParse({ echeance: '', consigne: 'x' }).success).toBe(true);
    expect(InvitationRetex.safeParse({ utilisateurs: [] }).success).toBe(false);
    expect(InvitationRetex.safeParse({ utilisateurs: ['pas-un-uuid'] }).success).toBe(false);
    expect(TraitementProposition.safeParse({ decision: 'rejeter' }).success).toBe(false);
    expect(TraitementProposition.safeParse({ decision: 'rejeter', motif: 'Hors sujet' }).success).toBe(true);
    expect(TraitementProposition.safeParse({ decision: 'doublon', evenementId: 'EV-001' }).success).toBe(true);
    expect(
      LotEvenementsRetex.safeParse({ evenements: [{ ts: '2026-10-12T09:00', type: 'Analyse', titre: 'x' }] }).success,
    ).toBe(false);
  });
});
