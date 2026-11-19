import {
  ObligationTraitee,
  IncidentModification,
  EvenementRetexModification,
  EvenementRetexSaisie,
  ContributionTerminee,
  DiffusionRetex,
  InvitationRetex,
  LotEvenementsRetex,
  OuvertureRetex,
  PropositionRetexModification,
  PropositionRetexSaisie,
  ReglageCollecte,
  TraitementProposition,
  IncidentCreation,
  CorrectionQualification,
  EnvoiDeclaration,
  MiseAlEcartDeclaration,
  OuvertureDeclaration,
  PreparationDeclaration,
} from '@suivi/shared';
import { z } from 'zod';
import { docx } from '../../export/office.js';
import { requireIfMatch, setEtag } from '../../http/concurrency.js';
import { route } from '../../http/route.js';
import { tags, user, idElement, idIndice, idEvenement, idProposition, idContributeur } from './commun.js';

/** Déclaration d'un incident (ADR 0105). */
const idDeclaration = z.object({ id: z.string().trim().min(1).max(64), did: z.uuid() });
const reponseDeclaration = <T extends { version: number }>(reply: Parameters<typeof setEtag>[0], d: T) => {
  setEtag(reply, d.version);
  return d;
};

export const incidentsRoutes = [
  route({
    method: 'GET',
    url: '/api/incidents',
    summary: 'Registre des incidents',
    tags,
    access: 'incidents:lire' as const,
    query: z.object({ smsi: z.string().uuid().optional() }).strict(),
    handler: async ({ svc, s, query }) => svc.historique.incidents.vue(user(s), query.smsi),
  }),
  route({
    method: 'POST',
    url: '/api/incidents',
    summary: 'Ajouter un incident (qualifié d’après les réponses du questionnaire s’il y en a)',
    tags,
    access: 'incidents:modifier' as const,
    status: 201,
    body: IncidentCreation,
    handler: async ({ svc, s, body, ip }) => svc.historique.incidents.creer(body, user(s), ip),
  }),
  route({
    method: 'PATCH',
    url: '/api/incidents/:id',
    summary: 'Modifier un incident',
    tags,
    access: 'incidents:modifier' as const,
    params: idElement,
    body: IncidentModification,
    handler: async ({ svc, s, params, body, ip }) => svc.historique.incidents.modifier(params.id, body, user(s), ip),
  }),
  route({
    method: 'DELETE',
    url: '/api/incidents/:id',
    summary: 'Supprimer un incident',
    tags,
    access: 'incidents:supprimer' as const,
    params: idElement,
    handler: async ({ svc, s, params, ip }) => svc.historique.incidents.supprimer(params.id, user(s), ip),
  }),
  route({
    method: 'PUT',
    url: '/api/incidents/:id/obligations/:k',
    summary: 'Marquer une obligation comme traitée ou non',
    tags,
    access: 'incidents:modifier' as const,
    params: idIndice,
    body: ObligationTraitee,
    handler: async ({ svc, s, params, body, ip }) =>
      svc.historique.incidents.obligation(params.id, params.k, body, user(s), ip),
  }),
  /* Déclaration réglementaire (ADR 0105). Préparer : incidents:modifier sur le périmètre. Ouvrir, compléter, confirmer, écarter,
     marquer envoyée et corriger la date de qualification : rôle « RSSI » exigé par le service (403 pour tout autre compte,
     administrateur compris) ; la route garde incidents:modifier (module actif, session, CSRF). Périmètre fermé : 404. */
  route({
    method: 'GET',
    url: '/api/incidents/:id/declarations',
    summary: 'Déclarations réglementaires d’un incident (santé, NIS 2), avec leurs rubriques et leurs délais',
    tags,
    access: 'incidents:lire' as const,
    params: idElement,
    handler: async ({ svc, s, params }) => svc.historique.declarations.vue(user(s), params.id),
  }),
  route({
    method: 'POST',
    url: '/api/incidents/:id/declarations',
    summary: 'Ouvrir à la main une déclaration non proposée (rôle RSSI)',
    tags,
    access: 'incidents:modifier' as const,
    status: 201,
    params: idElement,
    body: OuvertureDeclaration,
    handler: async ({ svc, s, params, body, ip, reply }) =>
      reponseDeclaration(reply, await svc.historique.declarations.ouvrir(params.id, body, user(s), ip)),
  }),
  route({
    method: 'PATCH',
    url: '/api/incidents/:id/declarations/:did',
    summary:
      'Préparer une déclaration : rubriques et numéro de dossier pressenti (If-Match : version de la déclaration)',
    tags,
    access: 'incidents:modifier' as const,
    params: idDeclaration,
    body: PreparationDeclaration,
    handler: async ({ svc, s, params, body, ip, req, reply }) =>
      reponseDeclaration(
        reply,
        await svc.historique.declarations.preparer(params.id, params.did, requireIfMatch(req), body, user(s), ip),
      ),
  }),
  route({
    method: 'POST',
    url: '/api/incidents/:id/declarations/:did/confirmation',
    summary: 'Confirmer « à déclarer » une déclaration proposée (rôle RSSI, If-Match)',
    tags,
    access: 'incidents:modifier' as const,
    params: idDeclaration,
    handler: async ({ svc, s, params, ip, req, reply }) =>
      reponseDeclaration(
        reply,
        await svc.historique.declarations.confirmer(params.id, params.did, requireIfMatch(req), user(s), ip),
      ),
  }),
  route({
    method: 'POST',
    url: '/api/incidents/:id/declarations/:did/mise-a-l-ecart',
    summary: 'Écarter une déclaration « non requise », avec un motif obligatoire, figé (rôle RSSI, If-Match)',
    tags,
    access: 'incidents:modifier' as const,
    params: idDeclaration,
    body: MiseAlEcartDeclaration,
    handler: async ({ svc, s, params, body, ip, req, reply }) =>
      reponseDeclaration(
        reply,
        await svc.historique.declarations.ecarter(params.id, params.did, requireIfMatch(req), body, user(s), ip),
      ),
  }),
  route({
    method: 'POST',
    url: '/api/incidents/:id/declarations/:did/envoi',
    summary:
      'Marquer une déclaration comme envoyée : texte, date, personne et référence figés (rôle RSSI, If-Match, référence obligatoire)',
    tags,
    access: 'incidents:modifier' as const,
    params: idDeclaration,
    body: EnvoiDeclaration,
    handler: async ({ svc, s, params, body, ip, req, reply }) =>
      reponseDeclaration(
        reply,
        await svc.historique.declarations.envoyer(params.id, params.did, requireIfMatch(req), body, user(s), ip),
      ),
  }),
  route({
    method: 'POST',
    url: '/api/incidents/:id/declarations/:did/complement',
    summary: 'Ajouter un complément lié à une déclaration envoyée (rôle RSSI)',
    tags,
    access: 'incidents:modifier' as const,
    status: 201,
    params: idDeclaration,
    handler: async ({ svc, s, params, ip, reply }) =>
      reponseDeclaration(reply, await svc.historique.declarations.completer(params.id, params.did, user(s), ip)),
  }),
  route({
    method: 'GET',
    url: '/api/incidents/:id/declarations/:did/export',
    summary: 'Télécharger une déclaration au format Word (fiche de préparation, ou texte transmis si elle est envoyée)',
    tags,
    access: 'incidents:exporter' as const,
    params: idDeclaration,
    handler: async ({ svc, s, params, ip, reply }) => {
      const { modele, nom } = await svc.historique.declarations.exporter(params.id, params.did, user(s), ip);
      return reply
        .header('Cache-Control', 'no-store')
        .header('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
        .header('Content-Disposition', `attachment; filename="${nom.replace(/[^A-Za-z0-9_.-]/g, '_')}.docx"`)
        .send(docx(modele));
    },
  }),
  route({
    method: 'PUT',
    url: '/api/incidents/:id/qualification',
    summary:
      'Corriger la date et l’heure de qualification (rôle RSSI) : correction tracée, échéances non envoyées recalculées',
    tags,
    access: 'incidents:modifier' as const,
    params: idElement,
    body: CorrectionQualification,
    handler: async ({ svc, s, params, body, ip }) =>
      svc.historique.declarations.corrigerQualification(params.id, body, user(s), ip),
  }),
  route({
    method: 'POST',
    url: '/api/incidents/:id/action',
    summary: 'Créer l’action de l’incident dans le registre des écarts',
    tags,
    access: 'incidents:modifier' as const,
    status: 201,
    params: idElement,
    handler: async ({ svc, s, params, ip }) => svc.historique.incidents.action(params.id, user(s), ip),
  }),
  route({
    method: 'POST',
    url: '/api/incidents/:id/retex',
    summary: 'Ajouter un événement à la chronologie du RETEX de l’incident',
    tags,
    access: 'incidents:modifier' as const,
    status: 201,
    params: idElement,
    body: EvenementRetexSaisie,
    handler: async ({ svc, s, params, body, ip }) =>
      svc.historique.incidents.ajouterEvenement(params.id, body, user(s), ip),
  }),
  route({
    method: 'PATCH',
    url: '/api/incidents/:id/retex/:eid',
    summary: 'Modifier un événement de la chronologie du RETEX',
    tags,
    access: 'incidents:modifier' as const,
    params: idEvenement,
    body: EvenementRetexModification,
    handler: async ({ svc, s, params, body, ip }) =>
      svc.historique.incidents.modifierEvenement(params.id, params.eid, body, user(s), ip),
  }),
  route({
    method: 'DELETE',
    url: '/api/incidents/:id/retex/:eid',
    summary: 'Retirer un événement de la chronologie du RETEX',
    tags,
    access: 'incidents:supprimer' as const,
    params: idEvenement,
    handler: async ({ svc, s, params, ip }) =>
      svc.historique.incidents.supprimerEvenement(params.id, params.eid, user(s), ip),
  }),
  /* RETEX : collecte par le pilote (droit de modification des incidents). */
  route({
    method: 'POST',
    url: '/api/incidents/:id/retex/ouverture',
    summary: 'Ouvrir le RETEX d’un incident (l’utilisateur en devient le pilote)',
    tags,
    access: 'incidents:modifier' as const,
    status: 201,
    params: idElement,
    body: OuvertureRetex,
    handler: async ({ svc, s, params, body, ip }) => svc.historique.retex.ouvrir(params.id, body, user(s), ip),
  }),
  route({
    method: 'PATCH',
    url: '/api/incidents/:id/retex/collecte',
    summary: 'Modifier la consigne ou l’échéance de la collecte du RETEX',
    tags,
    access: 'incidents:modifier' as const,
    params: idElement,
    body: ReglageCollecte,
    handler: async ({ svc, s, params, body, ip }) => svc.historique.retex.regler(params.id, body, user(s), ip),
  }),
  route({
    method: 'GET',
    url: '/api/retex/candidats',
    summary: 'Comptes actifs proposables comme contributeurs d’un RETEX (nom et pôles)',
    tags,
    access: 'incidents:modifier' as const,
    handler: async ({ svc, s }) => svc.historique.retex.candidats(user(s)),
  }),
  route({
    method: 'POST',
    url: '/api/incidents/:id/retex/invitations',
    summary: 'Inviter des contributeurs au RETEX (notification à chacun)',
    tags,
    access: 'incidents:modifier' as const,
    params: idElement,
    body: InvitationRetex,
    handler: async ({ svc, s, params, body, ip }) => svc.historique.retex.inviter(params.id, body, user(s), ip),
  }),
  route({
    method: 'POST',
    url: '/api/incidents/:id/retex/relances',
    summary: 'Relancer les contributeurs qui n’ont pas terminé (ou un seul)',
    tags,
    access: 'incidents:modifier' as const,
    params: idElement,
    body: z.object({ utilisateur: z.uuid().optional() }).strict(),
    handler: async ({ svc, s, params, body, ip }) =>
      svc.historique.retex.relancer(params.id, body.utilisateur, user(s), ip),
  }),
  route({
    method: 'DELETE',
    url: '/api/incidents/:id/retex/contributeurs/:uid',
    summary: 'Retirer un contributeur du RETEX (ses propositions en attente sont retirées)',
    tags,
    access: 'incidents:modifier' as const,
    params: idContributeur,
    handler: async ({ svc, s, params, ip }) =>
      svc.historique.retex.retirerContributeur(params.id, params.uid, user(s), ip),
  }),
  route({
    method: 'POST',
    url: '/api/incidents/:id/retex/propositions/:pid/decision',
    summary: 'Accepter (éventuellement corrigée), marquer comme doublon ou rejeter une proposition',
    tags,
    access: 'incidents:modifier' as const,
    params: idProposition,
    body: TraitementProposition,
    handler: async ({ svc, s, params, body, ip }) =>
      svc.historique.retex.traiter(params.id, params.pid, body, user(s), ip),
  }),
  route({
    method: 'POST',
    url: '/api/incidents/:id/retex/import',
    summary: 'Importer des éléments dans la chronologie (fiche de l’incident, main courante de crise)',
    tags,
    access: 'incidents:modifier' as const,
    params: idElement,
    body: LotEvenementsRetex,
    handler: async ({ svc, s, params, body, ip }) => svc.historique.retex.importer(params.id, body, user(s), ip),
  }),
  route({
    method: 'POST',
    url: '/api/incidents/:id/retex/cloture',
    summary: 'Clore la collecte du RETEX (aucune proposition en attente)',
    tags,
    access: 'incidents:modifier' as const,
    params: idElement,
    handler: async ({ svc, s, params, ip }) => svc.historique.retex.cloturer(params.id, user(s), ip),
  }),
  route({
    method: 'POST',
    url: '/api/incidents/:id/retex/reouverture',
    summary: 'Rouvrir la collecte du RETEX (la diffusion est retirée)',
    tags,
    access: 'incidents:modifier' as const,
    params: idElement,
    handler: async ({ svc, s, params, ip }) => svc.historique.retex.rouvrir(params.id, user(s), ip),
  }),
  route({
    method: 'PUT',
    url: '/api/incidents/:id/retex/diffusion',
    summary: 'Diffuser (ou retirer) la chronologie aux contributeurs, en lecture seule',
    tags,
    access: 'incidents:modifier' as const,
    params: idElement,
    body: DiffusionRetex,
    handler: async ({ svc, s, params, body, ip }) => svc.historique.retex.diffuser(params.id, body, user(s), ip),
  }),
  /* RETEX : contributions déléguées. Session complète exigée ; l'habilitation (contributeur invité) est vérifiée par le
     service, sous verrou pour les écritures. Aucun droit de module : un compte non invité reçoit 404. */
  route({
    method: 'GET',
    url: '/api/retex/invitations',
    summary: 'RETEX auxquels je suis invité à contribuer',
    tags,
    access: 'auth' as const,
    handler: async ({ svc, s }) => svc.historique.retex.invitations(user(s)),
  }),
  route({
    method: 'GET',
    url: '/api/retex/:id',
    summary: 'Ma contribution à un RETEX : contexte, mes propositions, chronologie si diffusée',
    tags,
    access: 'auth' as const,
    params: idElement,
    handler: async ({ svc, s, params }) => svc.historique.retex.contribution(params.id, user(s)),
  }),
  route({
    method: 'POST',
    url: '/api/retex/:id/propositions',
    summary: 'Proposer un événement au pilote du RETEX',
    tags,
    access: 'auth' as const,
    status: 201,
    params: idElement,
    body: PropositionRetexSaisie,
    handler: async ({ svc, s, params, body, ip }) => svc.historique.retex.proposer(params.id, body, user(s), ip),
  }),
  route({
    method: 'PATCH',
    url: '/api/retex/:id/propositions/:pid',
    summary: 'Modifier une de mes propositions encore en attente',
    tags,
    access: 'auth' as const,
    params: idProposition,
    body: PropositionRetexModification,
    handler: async ({ svc, s, params, body, ip }) =>
      svc.historique.retex.modifierProposition(params.id, params.pid, body, user(s), ip),
  }),
  route({
    method: 'DELETE',
    url: '/api/retex/:id/propositions/:pid',
    summary: 'Retirer une de mes propositions encore en attente',
    tags,
    access: 'auth' as const,
    params: idProposition,
    handler: async ({ svc, s, params, ip }) =>
      svc.historique.retex.retirerProposition(params.id, params.pid, user(s), ip),
  }),
  route({
    method: 'PUT',
    url: '/api/retex/:id/terminee',
    summary: 'Déclarer ma contribution terminée (ou la reprendre)',
    tags,
    access: 'auth' as const,
    params: idElement,
    body: ContributionTerminee,
    handler: async ({ svc, s, params, body, ip }) => svc.historique.retex.terminer(params.id, body, user(s), ip),
  }),
];
