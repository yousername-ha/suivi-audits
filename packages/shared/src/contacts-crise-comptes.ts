/* Contacts de crise issus des comptes de la plateforme (ADR 0105, décision du RSSI du 18/11/2026) : l'administrateur marque
   un compte comme contact de crise (rôle de crise, téléphones, disponibilité, contact clé, périmètres) ; la personne met à
   jour ses téléphones et sa disponibilité dans Mon compte ; la page des contacts de crise et la cellule de crise les
   reprennent en lecture seule, pour qui lit les incidents du périmètre. Longueurs : celles des contacts saisis à la main
   (`ContactModification`, suivi-crise.ts). */
import { z } from 'zod';
import type { ContactCrise } from './suivi-crise.js';

const t = (n: number) => z.string().trim().max(n);
/** Nombre maximal de périmètres choisis pour un contact de crise (contrainte de la migration 089). */
export const CONTACT_CRISE_PERIMETRES_MAX = 200;

/** Contact de crise d'un compte, tel que le lit une personne qui lit les incidents du périmètre (`GET /api/crise`,
    `contactsComptes`). Nom : nom affiché du compte, à défaut son identifiant ; courriel : celui du compte. */
export const ContactCriseCompte = z.object({
  userId: z.string(),
  nom: z.string(),
  courriel: z.string(),
  role: z.string(),
  phone: z.string(),
  phone2: z.string(),
  avail: z.string(),
  key: z.boolean(),
});
export type ContactCriseCompte = z.infer<typeof ContactCriseCompte>;

/** Écriture par l'administrateur (`PUT /api/admin/users/:id/contact-crise`, If-Match) : la fiche entière. `actif: false`
    retire le compte des contacts de crise (la fiche est supprimée). Une liste de périmètres choisis n'est jamais vide. */
export const ContactCriseCompteAdmin = z
  .object({
    actif: z.boolean(),
    role: t(200).default(''),
    telephone: t(100).default(''),
    telephone2: t(100).default(''),
    disponibilite: t(200).default(''),
    cle: z.boolean().default(false),
    tousPerimetres: z.boolean().default(true),
    perimetres: z
      .array(z.uuid())
      .max(CONTACT_CRISE_PERIMETRES_MAX)
      .default([])
      .transform((l) => [...new Set(l)]),
  })
  .strict()
  .refine((b) => !b.actif || b.tousPerimetres || b.perimetres.length > 0, {
    message: 'Choisissez au moins un périmètre, ou « Tous les périmètres ».',
    path: ['perimetres'],
  });
export type ContactCriseCompteAdmin = z.infer<typeof ContactCriseCompteAdmin>;

/** Écriture par la personne elle-même (`PATCH /api/account/contact-crise`, If-Match) : ses téléphones et sa disponibilité,
    rien d'autre (tout autre champ est refusé). */
export const ContactCriseCompteSoi = z
  .object({ telephone: t(100), telephone2: t(100), disponibilite: t(200) })
  .partial()
  .strict();
export type ContactCriseCompteSoi = z.infer<typeof ContactCriseCompteSoi>;

/** Fiche lue par l'administrateur (`GET /api/admin/users/:id/contact-crise`, ETag = version) : `actif: false` et version 0
    quand le compte n'est pas contact de crise. Périmètres : identifiants seulement. */
export const ContactCriseCompteAdminOut = z.object({
  actif: z.boolean(),
  role: z.string(),
  telephone: z.string(),
  telephone2: z.string(),
  disponibilite: z.string(),
  cle: z.boolean(),
  tousPerimetres: z.boolean(),
  perimetres: z.array(z.string()),
  version: z.number().int(),
});
export type ContactCriseCompteAdminOut = z.infer<typeof ContactCriseCompteAdminOut>;

/** Fiche lue par la personne (`GET /api/account/contact-crise`, ETag = version ; 404 si elle n'est pas contact de crise).
    Les périmètres qu'elle lit sont nommés ; les autres sont seulement comptés, sans nom. */
export const ContactCriseCompteSoiOut = z.object({
  role: z.string(),
  telephone: z.string(),
  telephone2: z.string(),
  disponibilite: z.string(),
  cle: z.boolean(),
  tousPerimetres: z.boolean(),
  perimetres: z.array(z.object({ id: z.string(), nom: z.string() })),
  perimetresNonLisibles: z.number().int(),
  version: z.number().int(),
});
export type ContactCriseCompteSoiOut = z.infer<typeof ContactCriseCompteSoiOut>;

/** Contact montré dans la cellule de crise : compte de la plateforme ou contact saisi à la main. */
export interface ContactCellule {
  name: string;
  org: string;
  role: string;
  phone: string;
  email: string;
  key: boolean;
  compte: boolean;
}
/** Contacts de la cellule de crise : les contacts clés d'abord (comptes de la plateforme, puis contacts saisis à la main),
    puis les autres dans le même ordre, `max` au plus. */
export function contactsCellule(
  contacts: readonly ContactCrise[],
  comptes: readonly ContactCriseCompte[],
  max = 12,
): ContactCellule[] {
  const deComptes = comptes.map((c): ContactCellule => ({
    name: c.nom,
    org: '',
    role: c.role,
    phone: c.phone,
    email: c.courriel,
    key: c.key,
    compte: true,
  }));
  const saisis = contacts.map((c): ContactCellule => ({
    name: c.name,
    org: c.org,
    role: c.role,
    phone: c.phone,
    email: c.email,
    key: c.key,
    compte: false,
  }));
  return [
    ...deComptes.filter((c) => c.key),
    ...saisis.filter((c) => c.key),
    ...deComptes.filter((c) => !c.key),
    ...saisis.filter((c) => !c.key),
  ].slice(0, max);
}
