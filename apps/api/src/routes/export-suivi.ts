/* Exports Excel de l'outil de suivi, par rubrique (reprise des exports de l'outil historique). */
import { z } from 'zod';
import { PorteeLecture } from '../acces/portee.js';
import type { Session } from '../auth.js';
import { classeur } from '../export/classeur.js';
import { GROUPES, feuillesDuGroupe } from '../export/rubriques.js';
import { HttpError } from '../http/errors.js';
import { route } from '../http/route.js';

const jourFr = (iso: string) => iso.split('-').reverse().join('/');

export const exportSuiviRoutes = [
  route({
    method: 'GET',
    url: '/api/suivi/export/groupes',
    summary: 'Groupes d’export Excel de l’outil de suivi',
    tags: ['Suivi'],
    access: 'import_export:exporter',
    handler: async () =>
      GROUPES.map((g) => ({ id: g.id, titre: g.titre, description: g.description, feuilles: g.jeux.length })),
  }),
  route({
    method: 'GET',
    url: '/api/suivi/export',
    summary: 'Exporter un groupe de rubriques (ou tout) en Excel : classique (données brutes) ou pro (mise en forme)',
    tags: ['Suivi'],
    access: 'import_export:exporter',
    query: z.object({ groupe: z.string().regex(/^[a-z]{2,8}$/), mode: z.enum(['std', 'pro']).default('std') }),
    handler: async ({ svc, s, ip, query, reply }) => {
      const u = (s as Session).user;
      // État historique rédigé par la porte de lecture (ADR 0083) : les rubriques illisibles sont exportées vides.
      const r = await PorteeLecture.pour(svc.grc, u).etatHistoriqueSiPresent();
      if (!r) throw new HttpError(404, 'Aucune donnée.');
      const aujourdhui = new Date().toISOString().slice(0, 10);
      const etat = r.data;
      const feuilles = feuillesDuGroupe(query.groupe, { etat, aujourdhui });
      if (!feuilles) throw new HttpError(404, 'Groupe d’export inconnu.');
      const titre =
        query.groupe === 'all' ? 'Export complet' : (GROUPES.find((g) => g.id === query.groupe)?.titre ?? 'Export');
      const fichier = classeur(feuilles, {
        mode: query.mode,
        titre,
        contexte: `${svc.cfg.orgName} — extraction du ${jourFr(aujourdhui)}`,
      });
      await svc.db.audit(u, ip, 'suivi.export', query.groupe, { mode: query.mode, feuilles: feuilles.length });
      return reply
        .header('Cache-Control', 'no-store')
        .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        .header('Content-Disposition', `attachment; filename="export-${query.groupe}-${query.mode}-${aujourdhui}.xlsx"`)
        .send(fichier);
    },
  }),
];
