/* États des contrôles et des certificats : mêmes règles que l'outil de suivi historique. Données fictives. */
import { describe, expect, it } from 'vitest';
import {
  ajouterMois,
  correspondFiltre,
  etatCertificats,
  etatControle,
  partSaas,
  prochainControle,
  resumeControles,
} from '../src/suivi-fournisseurs.js';

const JOUR = '2026-10-13';
describe('contrôles périodiques', () => {
  it('ajoute des mois comme l’outil historique, débordement compris', () => {
    expect(ajouterMois('2026-01-31', 1)).toBe('2026-03-03');
    expect(ajouterMois('2026-10-13', 12)).toBe('2027-10-13');
    expect(ajouterMois('', 12)).toBeNull();
  });
  it('« À réaliser » sans dernier contrôle, « En retard » après l’échéance, « Non conforme » avant, sinon « À jour »', () => {
    expect(etatControle({ t: 'x' }, JOUR)).toEqual(['À réaliser', 'mid']);
    expect(etatControle({ last: '2025-01-01', freq: 12 }, JOUR)).toEqual(['En retard', 'bad']);
    expect(etatControle({ last: '2026-09-01', freq: 12, result: 'Non conforme' }, JOUR)).toEqual([
      'Non conforme',
      'bad',
    ]);
    expect(etatControle({ last: '2026-09-01', freq: 12, result: 'Conforme' }, JOUR)).toEqual(['À jour', 'ok']);
    expect(prochainControle({ last: '2026-09-01' })).toBe('2027-09-01');
    expect(prochainControle({})).toBeNull();
  });
  it('résume les contrôles et retient la prochaine échéance', () => {
    const sp = {
      controls: [
        { last: '2025-01-01', freq: 12 },
        { last: '' },
        { last: '2026-09-01', freq: 6, result: 'Non conforme' },
        { last: '2026-10-01', freq: 12 },
      ],
    };
    expect(resumeControles(sp, JOUR)).toEqual({
      enRetard: 1,
      aRealiser: 1,
      nonConformes: 1,
      total: 4,
      prochain: '2026-01-01',
    });
    expect(resumeControles({}, JOUR)).toMatchObject({ total: 0, prochain: null });
  });
});
describe('certificats', () => {
  it('sans certificat : « À fournir » seulement pour un hébergeur HDS ou un fournisseur critique', () => {
    expect(etatCertificats({}, JOUR)).toEqual(['', '']);
    expect(etatCertificats({ hds: 'Oui' }, JOUR)).toEqual(['À fournir', 'bad']);
    expect(etatCertificats({ critical: 'Oui' }, JOUR)).toEqual(['À fournir', 'bad']);
  });
  it('qualifie les dates de validité', () => {
    const c = (validUntil: string) => ({ certs: [{ type: 'ISO 27001', validUntil }] });
    expect(etatCertificats(c(''), JOUR)).toEqual(['Date à saisir', 'mid']);
    expect(etatCertificats(c('2026-10-01'), JOUR)).toEqual(['Expiré', 'bad']);
    expect(etatCertificats(c('2026-12-31'), JOUR)).toEqual(['Expire ≤ 90 j', 'mid']);
    expect(etatCertificats(c('2027-06-01'), JOUR)).toEqual(['Valide', 'ok']);
    expect(etatCertificats({ certs: [{ type: '', validUntil: '2020-01-01' }] }, JOUR)).toEqual(['', '']);
  });
});
describe('filtres et parts SaaS', () => {
  const liste = [
    { saas: true, mfa: 'Oui', sso: 'Oui', critical: 'Oui', controls: [{ last: '2026-10-01' }] },
    { saas: true, mfa: 'Non', sso: 'Oui', controls: [{}] },
    { saas: false, mfa: '', hds: 'Oui' },
  ];
  it('applique les filtres de l’outil historique', () => {
    expect(liste.filter((s) => correspondFiltre(s, 'nomfa', JOUR))).toHaveLength(2);
    expect(liste.filter((s) => correspondFiltre(s, 'crit', JOUR))).toHaveLength(1);
    expect(liste.filter((s) => correspondFiltre(s, 'ctl', JOUR))).toHaveLength(1);
    expect(liste.filter((s) => correspondFiltre(s, 'cert', JOUR))).toHaveLength(2);
    expect(liste.filter((s) => correspondFiltre(s, 'all', JOUR))).toHaveLength(3);
  });
  it('calcule les parts de services SaaS avec MFA et SSO', () => {
    expect(partSaas(liste, 'mfa')).toEqual({ oui: 1, saas: 2, pct: 50 });
    expect(partSaas(liste, 'sso')).toEqual({ oui: 2, saas: 2, pct: 100 });
    expect(partSaas([], 'mfa')).toEqual({ oui: 0, saas: 0, pct: 0 });
  });
});
