/* Flux vers l'extérieur (ADR 0097) : lecture de l'état pour l'administration (résumé) et route commune de décision,
   confirmation explicite obligatoire. Précision du RSSI du 15/11/2026 : activer le module ouvre son flux. L'ouverture par
   cette route n'est donc admise que pour un module dont l'activation est le flux lui-même (antivirus, mises à jour) ; les
   autres s'ouvrent par leur propre geste d'activation (même transaction). La fermeture est toujours admise. Aucune
   exécution : l'exécutant d'exploitation applique l'état voulu. Questions de l'assistant d'installation (lot 3) : savoir si
   l'étape reste à proposer, puis la clore ; ces deux routes n'ouvrent aucun flux. */
import {
  FLUX_MODULES,
  FluxChangement,
  FluxExterneEtat,
  FluxExternesOut,
  QuestionsFluxOut,
  fluxExterne,
} from '@suivi/shared';
import { z } from 'zod';
import { HttpError } from '../http/errors.js';
import { route } from '../http/route.js';
import { questionsFluxAProposer, questionsFluxVues } from '../installation-flux.js';

const ModuleParams = z.object({ module: z.string().max(60) }).strict();

export const fluxExternesRoutes = [
  route({
    method: 'GET',
    url: '/api/admin/flux-externes',
    summary: 'Flux vers l’extérieur : état voulu et appliqué de chaque module du registre',
    tags: ['Administration'],
    access: 'administration:lire',
    response: FluxExternesOut,
    handler: async ({ svc }) => ({ modules: await svc.flux.etat() }),
  }),
  route({
    method: 'PUT',
    url: '/api/admin/flux-externes/:module',
    summary:
      'Fermer le flux d’un module, ou ouvrir celui d’un module activé par son flux (confirmation explicite, journal d’audit)',
    tags: ['Administration'],
    access: 'administration:administrer',
    params: ModuleParams,
    body: FluxChangement,
    response: FluxExterneEtat,
    handler: async ({ svc, s, ip, params, body }) => {
      const m = FLUX_MODULES.find((x) => x === params.module);
      if (!m) throw new HttpError(404, 'Module inconnu du registre des flux.');
      const f = fluxExterne(m);
      if (body.ouvert && f.activation.par === 'module' && !(await svc.flux.ouvert(m)))
        throw new HttpError(
          409,
          `Ce flux s’ouvre en activant le module « ${f.libelle} » (${f.reglage.libelle} : ${f.activation.geste}).`,
          { reason: 'flux_par_module', module: m },
        );
      // Un flux rattaché à un module désactivé ne s'ouvre pas : la désactivation du module le referme, sa réactivation ne
      // le rouvre pas (veille des vulnérabilités, ADR 0100).
      if (body.ouvert && f.moduleActivation && (await svc.modules.state(true)).disabled.includes(f.moduleActivation))
        throw new HttpError(
          409,
          `Activez d’abord le module dans Administration, Modules : le flux « ${f.libelle} » en dépend.`,
          {
            reason: 'flux_module_desactive',
            module: f.moduleActivation,
          },
        );
      return svc.flux.changer(m, body.ouvert, s!.user, ip);
    },
  }),
  route({
    method: 'GET',
    url: '/api/installation/flux-externes',
    summary:
      'Assistant d’installation : l’étape « Flux vers l’extérieur » reste-t-elle à proposer au compte créé par l’installation ?',
    tags: ['Installation'],
    access: 'administration:administrer',
    response: QuestionsFluxOut,
    handler: async ({ svc, s }) => ({ aProposer: await questionsFluxAProposer(svc, s!.user.id) }),
  }),
  route({
    method: 'POST',
    url: '/api/installation/flux-externes/vues',
    summary:
      'Assistant d’installation : étape « Flux vers l’extérieur » terminée ou passée (n’ouvre aucun flux ; journal d’audit)',
    tags: ['Installation'],
    access: 'administration:administrer',
    body: z.object({}).strict(),
    response: QuestionsFluxOut,
    handler: async ({ svc, s, ip }) => {
      await questionsFluxVues(svc, { id: s!.user.id, username: s!.user.username }, ip);
      return { aProposer: false };
    },
  }),
];
