/* Les vues natives des modules repris ne renvoient aucune clé d'un module que la personne ne peut pas lire : écarts
   (findings, closeDeadline) pour qui n'a pas ecarts:lire, déclaration d'applicabilité (dda) pour qui n'a pas pilotage:lire.
   L'écriture de la DdA exige aussi pilotage:modifier. Données fictives. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, ecartCommun, login, makeUser, seedState, type Agent, type TestApp } from './helpers.js';

let t: TestApp, admin: Agent, seulAudit: Agent, auditEcritureSeule: Agent, seulConformite: Agent;
let idEcart = '';
const item = (id: string, ref: string, num: string) => ({
  id,
  ref,
  num,
  title: `Mesure fictive ${num}`,
  group: 'G',
  depth: 0,
  afnor: {},
  interne: {},
});

beforeAll(async () => {
  t = await createTestApp();
  admin = await login(t, await makeUser(t, 'dc_admin', 'admin'));
  seulAudit = await login(t, await makeUser(t, 'dc_audit', 'ro', { modules: ['audit'] }));
  auditEcritureSeule = await login(t, await makeUser(t, 'dc_audit_rw', 'rw', { modules: ['audit'] }));
  seulConformite = await login(t, await makeUser(t, 'dc_conformite', 'ro', { modules: ['conformite'] }));
  const s = (await admin.get('/api/suivi/etat')).json();
  s.items = [item('A-5.1', 'A', '5.1'), item('A-5.2', 'A', '5.2')];
  s.dda = { 'A-5.1': { app: 'oui', level: 'Total', just: 'Justification fictive' } };
  s.closeDeadline = '2027-01-31';
  await seedState(t, s);
  idEcart = (await ecartCommun(admin, { name: 'Écart fictif', classification: 'mineure', items: ['A-5.1'] })).id;
});
afterAll(() => t.close());

describe('écarts : réservés à ecarts:lire dans toutes les vues', () => {
  it('témoin : l’administrateur voit les écarts et l’échéance de clôture', async () => {
    const v = (await admin.get('/api/audit-suivi')).json();
    expect(v.findings).toHaveLength(1);
    expect(v.closeDeadline).toBe('2027-01-31');
    expect((await admin.get('/api/dda?reference=A')).json().ecarts).toHaveLength(1);
  });

  it('un compte limité à l’audit ne reçoit ni écart ni échéance de clôture', async () => {
    const r = await seulAudit.get('/api/audit-suivi');
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().findings).toEqual([]);
    expect(r.json().closeDeadline).toBe('');
    expect(r.json().items.length).toBeGreaterThan(0); // les exigences relèvent bien de l’audit
    const d = await seulAudit.get('/api/dda?reference=A');
    expect(d.statusCode, d.body).toBe(200);
    expect(d.json().ecarts).toEqual([]);
  });

  it('GAP et incidents ne donnent pas l’état des écarts à qui n’a pas ecarts:lire', async () => {
    const gap = await seulConformite.get('/api/gap');
    expect(gap.statusCode, gap.body).toBe(200);
    expect(gap.json().ecarts).toEqual({});
    expect(gap.body).not.toContain(idEcart);
  });
});

describe('déclaration d’applicabilité : clé « dda » du pilotage', () => {
  it('la lecture de « dda » exige pilotage:lire', async () => {
    expect(Object.keys((await admin.get('/api/dda?reference=A')).json().dda)).toEqual(['A-5.1']);
    const r = await seulAudit.get('/api/dda?reference=A');
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().dda).toEqual({});
    expect(r.json().mesures.map((m: { id: string }) => m.id)).toEqual(['A-5.1', 'A-5.2']);
  });

  it('l’écriture exige aussi pilotage:modifier : audit seul est refusé, rien n’est écrit', async () => {
    const r = await auditEcritureSeule.patch('/api/dda/A-5.2', { app: 'non', just: 'Hors périmètre' });
    expect(r.statusCode, r.body).toBe(403);
    const etat = (await admin.get('/api/suivi/etat')).json();
    expect(etat.dda['A-5.2']).toBeUndefined();
  });

  it('témoin : un contributeur complet écrit toujours', async () => {
    const complet = await login(t, await makeUser(t, 'dc_complet', 'rw'));
    expect((await complet.patch('/api/dda/A-5.2', { app: 'non', just: 'Hors périmètre' })).statusCode).toBe(200);
  });
});
