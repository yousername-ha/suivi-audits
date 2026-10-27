/* Écarts du suivi : le module Audit, le tableau de bord et les exports lisent `findings` au format historique ; il n'y a plus
   de stockage propre, ces lignes sont la projection des écarts natifs (non-conformités) du périmètre commun. Lecture seule :
   une écriture venant d'un import de l'ancien outil est ignorée. Les écarts d'un registre restreint ne sont pas projetés,
   cet état n'étant pas filtré par personne. */
import type { Json } from '@suivi/shared/legacy';
import { surConnexion, type Client } from '../db/db.js';
import { DEFAULT_SMSI } from '../grc/core.js';
import type { ModuleMapper } from '../legacy/store.js';

const TYPES_PAR_CLASSIFICATION: Record<string, string> = { majeure: 'NC maj', mineure: 'NC min', point_sensible: 'PS' };
const STATUTS: Record<string, string> = { closed: 'Clos', progress: 'En cours', effectiveness: 'En cours' };
const REF_MESURE = 'legacy:items:';

interface Ligne {
  id: string;
  legacy_id: string | null;
  name: string;
  data: Record<string, unknown>;
  created_at: Date;
}
const texte = (v: unknown) => (typeof v === 'string' ? v : '');

export function ecartNatifVersFinding(o: Ligne): Json {
  const d = o.data;
  const classification = texte(d.classification);
  const type =
    TYPES_PAR_CLASSIFICATION[classification] ??
    (d.findingType === 'opportunity' ? 'PP' : d.findingType === 'observation' ? 'Remarque' : 'NC min');
  const source = d.source === 'AFNOR' ? 'AFNOR' : 'Interne';
  const refs = Array.isArray(d.refs) ? d.refs.filter((r): r is string => typeof r === 'string') : [];
  const f: Record<string, Json> = {
    id: o.legacy_id ?? o.id,
    source,
    year: o.created_at.getUTCFullYear(),
    type,
    findingType: texte(d.findingType) || 'nonconformity',
    status: STATUTS[texte(d.status)] ?? 'Ouvert',
    text: o.name,
    desc: texte(d.description),
    items: refs.filter((r) => r.startsWith(REF_MESURE)).map((r) => r.slice(REF_MESURE.length)),
    createdAt: o.created_at.toISOString(),
  };
  if (texte(d.cause)) f.cause = texte(d.cause);
  if (texte(d.dueAt)) f.due = texte(d.dueAt);
  return f;
}

export const ecartsNatifsMapper: ModuleMapper = {
  key: 'findings',
  async read(c: Client) {
    const r = (await surConnexion(c)
      .selectFrom('grc_objects as o')
      .leftJoin('registres as g', 'g.id', 'o.registre_id')
      .select(['o.id', 'o.legacy_id', 'o.name', 'o.data', 'o.created_at'])
      .where('o.kind', '=', 'nonconformity')
      .where('o.archived', '=', false)
      .where((eb) => eb.or([eb('g.id', 'is', null), eb('g.restricted', '=', false)]))
      .where((eb) =>
        eb.or([
          eb('o.smsi_id', '=', DEFAULT_SMSI),
          eb(
            'o.registre_id',
            'in',
            eb.selectFrom('registre_perimetres').select('registre_id').where('smsi_id', '=', DEFAULT_SMSI),
          ),
        ]),
      )
      .orderBy('o.created_at')
      .orderBy('o.id')
      .execute()) as unknown as Ligne[];
    return r.map(ecartNatifVersFinding);
  },
  async write() {
    /* Projection : rien à enregistrer. */
  },
};
