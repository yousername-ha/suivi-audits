/* Fiche détaillée (CARTO-10) : objet, cadre, objet indisponible ou non accessible, relation, informations de la carte.
   Les informations proviennent de la plateforme ; les liens ouvrent l'outil de suivi tant que le module n'est pas
   repris dans la nouvelle interface. */
import { ActionIcon, Anchor, Badge, Button, Group, Select, Stack, Text, Title } from '@mantine/core';
import {
  GRAPHIC_RELATION_TYPES,
  RELATIONS,
  TYPE_LABELS,
  familyOf,
  isFrame,
  type CartoObject,
  type DerivedRelation,
  type MapEdge,
  type MapLayout,
  type MapObject,
  type ObjectLookup,
  type RelationType,
  type SyncInfo,
} from '@suivi/shared/carto';
import type { ReactNode } from 'react';
import { Icone, iconOf, teinteOf } from './rendu';

const dateFr = (d?: string) => {
  if (!d) return '';
  const x = new Date(d.length === 10 ? d + 'T00:00:00' : d);
  return isNaN(x.getTime()) ? d : x.toLocaleDateString('fr-FR');
};
const dateHeure = (d?: string) => {
  if (!d) return '';
  const x = new Date(d);
  return isNaN(x.getTime())
    ? d
    : `${x.toLocaleDateString('fr-FR')} à ${x.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
};

function Ligne({ l, children }: { l: string; children: ReactNode }) {
  if (children === '' || children == null) return null;
  return (
    <div className="carte-ligne">
      <Text size="sm" c="dimmed">
        {l}
      </Text>
      <div>{children}</div>
    </div>
  );
}
function Section({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <Stack gap="2xs" className="carte-section">
      <Title order={4} size="h6">
        {titre}
      </Title>
      {children}
    </Stack>
  );
}
const Etiquette = ({ children, color }: { children: ReactNode; color?: string }) => (
  <Badge variant="light" color={color ?? 'blue'} radius="sm" className="carte-etiquette">
    {children}
  </Badge>
);
function Lien({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <Anchor component="button" type="button" size="sm" onClick={onClick} className="carte-lien">
      {children}
    </Anchor>
  );
}
const IconeTitre = ({ o }: { o: MapObject | undefined }) => (
  <svg viewBox="0 0 24 24" className={`carte-ic-titre ct-${teinteOf(o)}`} aria-hidden="true">
    <Icone k={iconOf(o)} x={0} y={0} s={24} cls="c-accent-s" />
  </svg>
);
const STATUT_COULEUR: Record<string, string> = { ok: 'green', ko: 'red', na: 'gray', undef: 'orange' };
const STATUT_LIBELLE: Record<string, string> = {
  ok: 'Atteint',
  ko: 'Non atteint',
  na: 'Non mesuré',
  undef: 'Cible à définir',
};

export interface InspecteurProps {
  sel: { k: 'n'; ref: string } | { k: 'e'; key: string } | null;
  info: boolean;
  layout: MapLayout;
  lookup: ObjectLookup;
  relations: DerivedRelation[];
  sync: SyncInfo;
  inaccessible: (ref: string) => boolean;
  canEdit: boolean;
  edit: boolean;
  carte: { updated_at?: string; updated_by?: string; versions?: number } | null;
  onClose: () => void;
  onGoto: (ref: string) => void;
  onRemove: (ref: string) => void;
  onDefaultSize: (ref: string) => void;
  onIssueKind: (ref: string, kind: 'ext' | 'int' | null) => void;
  onHide: (key: string) => void;
  onDeleteEdge: (id: string) => void;
  onValidate: (id: string) => void;
  onEdgeType: (id: string, type: RelationType) => void;
  onVersions: () => void;
}

export function Inspecteur(p: InspecteurProps) {
  const fermer = (
    <ActionIcon variant="subtle" aria-label="Fermer la fiche" onClick={p.onClose} className="carte-fermer">
      ×
    </ActionIcon>
  );
  if (p.info) return <Infos {...p} fermer={fermer} />;
  if (!p.sel) return null;
  if (p.sel.k === 'e') return <FicheRelation {...p} cle={p.sel.key} fermer={fermer} />;
  const ref = p.sel.ref;
  const n = p.layout.nodes[ref];
  const o = p.lookup(ref);
  if (!n)
    return (
      <Stack className="carte-fiche">
        {fermer}
        <Text size="sm">Objet retiré de la carte.</Text>
      </Stack>
    );
  if (!o) {
    const na = p.inaccessible(ref);
    return (
      <Stack className="carte-fiche" gap="sm">
        <Group justify="space-between" wrap="nowrap" align="flex-start">
          <Group gap="sm" wrap="nowrap">
            <IconeTitre o={undefined} />
            <div>
              <Title order={3} size="h5">
                {n.label || ref}
              </Title>
              <Text size="sm" c="dimmed">
                {na ? 'Objet non accessible' : 'Objet indisponible'}
              </Text>
            </div>
          </Group>
          {fermer}
        </Group>
        <Text size="sm">
          {na
            ? 'Vos droits ne permettent pas de consulter le module d’origine de cet objet. Sa position est conservée.'
            : 'Cet objet n’existe plus dans la plateforme. Sa position est conservée tant que vous ne le retirez pas.'}
        </Text>
        {p.canEdit && !na && (
          <Button color="red" variant="light" onClick={() => p.onRemove(ref)}>
            Retirer de la carte
          </Button>
        )}
      </Stack>
    );
  }
  const rel: (DerivedRelation | (MapEdge & { key: string; der?: undefined }))[] = [
    ...p.relations.filter((e) => e.s === ref || e.t === ref),
    ...p.layout.edges.filter((e) => e.s === ref || e.t === ref).map((e) => ({ ...e, key: 'm:' + e.id })),
  ];
  const c = isFrame(o) ? null : (o as CartoObject);
  const d = c?.details ?? {};
  const T = TYPE_LABELS[o.type];
  const sous =
    o.type === 'process'
      ? familyOf(c?.family).l
      : o.type === 'subprocess'
        ? 'Sous-processus — ' + familyOf(c?.family).l.toLowerCase()
        : c?.sub && !/issue/.test(o.type)
          ? c.sub
          : T;
  const scope =
    c?.scope === 'in'
      ? ['Dans le périmètre', 'green']
      : c?.scope === 'out'
        ? ['Hors périmètre', 'gray']
        : c?.scope === 'unk'
          ? [c.scopeLabel || 'Périmètre à confirmer', 'orange']
          : null;
  const legacy = (
    <Button component="a" href="/legacy/" variant="default" size="xs">
      Ouvrir dans l’outil de suivi
    </Button>
  );
  return (
    <Stack className="carte-fiche" gap="sm">
      <Group justify="space-between" wrap="nowrap" align="flex-start">
        <Group gap="sm" wrap="nowrap" className="carte-fiche-titre">
          <IconeTitre o={o} />
          <div>
            <Title order={3} size="h5">
              {o.name} {c?.code && <Etiquette>{c.code}</Etiquette>}
            </Title>
            <Text size="sm" c="dimmed">
              {sous}
            </Text>
          </div>
        </Group>
        {fermer}
      </Group>
      <Stack gap="2xs">
        <Ligne l="Type">
          <Etiquette>{o.type === 'process' ? familyOf(c?.family).l : T}</Etiquette>
        </Ligne>
        {scope && (
          <Ligne l="Périmètre">
            <Etiquette color={scope[1]}>{scope[0]}</Etiquette>
          </Ligne>
        )}
        {c?.owner && <Ligne l="Responsable">{c.owner}</Ligne>}
        {c && (
          <Ligne l="Référentiels">
            <Group gap="2xs">
              {c.std.map((s) => (
                <Etiquette key={s} color={s === 'HDS' ? 'violet' : 'blue'}>
                  {s}
                </Etiquette>
              ))}
            </Group>
          </Ligne>
        )}
        {(o.type === 'process' || o.type === 'subprocess') && c && (
          <>
            {c.parent && (
              <Ligne l="Processus parent">
                <Lien onClick={() => p.onGoto(c.parent!)}>{c.parent.split(':')[1]}</Lien>
              </Ligne>
            )}
            {!!d.children?.length && (
              <Ligne l="Sous-processus">
                <Group gap="2xs">
                  {d.children.map((k) => (
                    <Lien key={k.code} onClick={() => p.onGoto('process:' + k.code)}>
                      {k.code} {k.name}
                    </Lien>
                  ))}
                </Group>
              </Ligne>
            )}
          </>
        )}
        {o.type === 'stakeholder' && (
          <>
            <Ligne l="Nature">
              <Etiquette color={d.nature === 'Interne' ? 'blue' : 'violet'}>{d.nature}</Etiquette>
            </Ligne>
            <Ligne l="Catégorie">{d.category}</Ligne>
            <Ligne l="Prise en compte">
              <Etiquette color={/oui/i.test(d.addressed ?? '') ? 'green' : 'orange'}>
                {d.addressed || 'Non renseigné'}
              </Etiquette>
            </Ligne>
            <Ligne l="Revue">{dateFr(d.reviewed)}</Ligne>
          </>
        )}
        {o.type === 'supplier' && c && (
          <Ligne l="Caractéristiques">
            <Group gap="2xs">
              {c.saas && <Etiquette>SaaS</Etiquette>}
              {c.hds && <Etiquette color="violet">Hébergeur HDS</Etiquette>}
              {c.crit && <Etiquette color="red">Critique</Etiquette>}
              {d.sso && <Etiquette color={/oui/i.test(d.sso) ? 'green' : 'orange'}>SSO : {d.sso}</Etiquette>}
              {d.mfa && <Etiquette color={/oui/i.test(d.mfa) ? 'green' : 'orange'}>MFA : {d.mfa}</Etiquette>}
            </Group>
          </Ligne>
        )}
        {o.type === 'supplier' && !!d.certs?.length && (
          <Ligne l="Certifications">
            <Group gap="2xs">
              {d.certs.map((x) => (
                <Etiquette key={x} color="green">
                  {x}
                </Etiquette>
              ))}
            </Group>
          </Ligne>
        )}
        {o.type === 'application' && c && (
          <>
            <Ligne l="Statut">
              <Etiquette color={d.status === 'Intégrée' ? 'green' : 'orange'}>{d.status}</Etiquette>
            </Ligne>
            {d.supplier && (
              <Ligne l="Fournisseur">
                {c.supRef ? <Lien onClick={() => p.onGoto(c.supRef!)}>{d.supplier}</Lien> : d.supplier}
              </Ligne>
            )}
            <Ligne l="Données de santé">{d.healthData}</Ligne>
            <Ligne l="Hébergement">{d.hosting}</Ligne>
          </>
        )}
        {(o.type === 'external_issue' || o.type === 'internal_issue') && c && (
          <Ligne l="Nature">
            {p.canEdit ? (
              <Select
                size="xs"
                aria-label="Nature de l’enjeu"
                allowDeselect={false}
                value={o.type === 'external_issue' ? 'ext' : 'int'}
                data={[
                  { value: 'ext', label: 'Enjeu externe' },
                  { value: 'int', label: 'Enjeu interne' },
                ]}
                onChange={(v) => v && p.onIssueKind(o.ref, v === c.auto ? null : (v as 'ext' | 'int'))}
              />
            ) : (
              <Etiquette color="orange">{o.type === 'external_issue' ? 'Externe' : 'Interne'}</Etiquette>
            )}
          </Ligne>
        )}
        {o.type === 'scope' && (
          <>
            <Ligne l="Processus inclus">
              {d.processes?.length ? (
                <Group gap="2xs">
                  {d.processes.map((x) => (
                    <Lien key={x} onClick={() => p.onGoto('process:' + x)}>
                      {x}
                    </Lien>
                  ))}
                </Group>
              ) : (
                <Etiquette color="orange">À préciser</Etiquette>
              )}
            </Ligne>
            {d.hdsCount !== undefined && (
              <Ligne l="Activités HDS">{d.hdsCount ? `${d.hdsCount} activité(s)` : '—'}</Ligne>
            )}
            {!!d.exclCount && <Ligne l="Exclusions">{d.exclCount} exclusion(s) justifiée(s)</Ligne>}
            {d.validatedOn && (
              <Ligne l="Validé le">
                {dateFr(d.validatedOn)}
                {d.validatedBy ? ` par ${d.validatedBy}` : ''}
              </Ligne>
            )}
          </>
        )}
      </Stack>
      {o.type === 'scope' && d.statement && (
        <Section titre="Déclaration">
          <Text size="sm">{d.statement}</Text>
        </Section>
      )}
      {o.type === 'isms' && !!d.counts?.length && (
        <Section titre="Chiffres">
          {d.counts.map((x) => (
            <Group key={x.label} justify="space-between">
              <Text size="sm">{x.label}</Text>
              <Text size="sm" fw={700} className="chiffres">
                {x.value}
              </Text>
            </Group>
          ))}
        </Section>
      )}
      {(o.type === 'process' || o.type === 'subprocess') && (
        <>
          <Section titre="Objectifs liés">
            {d.objectives?.length ? (
              <Group gap="2xs">
                {d.objectives.map((x) => (
                  <Etiquette key={x.id}>{x.id}</Etiquette>
                ))}
              </Group>
            ) : (
              <Text size="sm" c="dimmed">
                Aucun objectif rattaché à ce processus.
              </Text>
            )}
          </Section>
          {!!d.indicators?.length && (
            <Section titre="Indicateurs (KPI)">
              {d.indicators.slice(0, 8).map((i) => (
                <Group key={i.id} gap="xs" wrap="nowrap">
                  <Etiquette color={STATUT_COULEUR[i.st]}>{i.id}</Etiquette>
                  <Text size="sm" truncate title={`${i.name} — ${STATUT_LIBELLE[i.st]}`}>
                    {i.name}
                  </Text>
                </Group>
              ))}
              {d.indicators.length > 8 && (
                <Text size="sm" c="dimmed">
                  … et {d.indicators.length - 8} autre(s)
                </Text>
              )}
            </Section>
          )}
          <Section titre="SWOT">
            <Text size="sm" c={d.swot ? undefined : 'dimmed'}>
              {d.swot
                ? `Dernière analyse du ${dateFr(d.swot.date)} : ${d.swot.S} force(s), ${d.swot.W} faiblesse(s), ${d.swot.O} opportunité(s), ${d.swot.T} menace(s).`
                : 'Aucun SWOT pour ce processus.'}
            </Text>
          </Section>
        </>
      )}
      {o.type === 'stakeholder' && d.needs && (
        <Section titre="Besoins et attentes">
          <Text size="sm">{d.needs}</Text>
        </Section>
      )}
      {o.type === 'stakeholder' && !!d.requirements?.length && (
        <Section titre="Exigences pertinentes">
          <Group gap="2xs">
            {d.requirements.map((x) => (
              <Etiquette key={x}>{x}</Etiquette>
            ))}
          </Group>
        </Section>
      )}
      {o.type === 'supplier' && !!d.apps?.length && (
        <Section titre="Applications liées">
          <Group gap="2xs">
            {d.apps.map((a) => (
              <Lien key={a.id} onClick={() => p.onGoto('app:' + a.id)}>
                {a.name}
              </Lien>
            ))}
          </Group>
        </Section>
      )}
      {(o.type === 'external_issue' || o.type === 'internal_issue') && c && (
        <>
          {c.sub && (
            <Section titre="Description">
              <Text size="sm">{c.sub}</Text>
            </Section>
          )}
          <Section titre="Origine dans la plateforme">
            {(c.src ?? []).map((s, i) => (
              <Text key={i} size="sm">
                {s.l}
              </Text>
            ))}
          </Section>
          {!!c.procs?.length && (
            <Section titre="Processus concernés">
              <Group gap="2xs">
                {c.procs.map((x) => (
                  <Lien key={x} onClick={() => p.onGoto('process:' + x)}>
                    {x}
                  </Lien>
                ))}
              </Group>
            </Section>
          )}
        </>
      )}
      {isFrame(o) && (
        <Section titre="Cadre de la carte">
          <Text size="sm">
            Élément de présentation propre à cette carte : il regroupe visuellement les objets et n’existe pas dans les
            données de la plateforme.
          </Text>
        </Section>
      )}
      {!!rel.length && (!isFrame(o) || o.type === 'lane') && (
        <Section titre={`Relations (${rel.length})`}>
          {rel.slice(0, 14).map((e) => {
            const autre = e.s === ref ? e.t : e.s;
            const oo = p.lookup(autre);
            return (
              <Group key={e.key} gap="xs" wrap="nowrap">
                <Text size="xs" c="dimmed" className="carte-rel-type">
                  {(RELATIONS[e.type] ?? RELATIONS.related_to).l} {e.s === ref ? '→' : '←'}
                </Text>
                <Lien onClick={() => p.onGoto(autre)}>{oo ? ((oo as CartoObject).code ?? oo.name) : autre}</Lien>
                {'gen' in e && e.gen && <Etiquette color="orange">à valider</Etiquette>}
              </Group>
            );
          })}
          {rel.length > 14 && (
            <Text size="sm" c="dimmed">
              … et {rel.length - 14} autre(s)
            </Text>
          )}
        </Section>
      )}
      {!isFrame(o) && o.type !== 'isms' && <Group>{legacy}</Group>}
      {p.canEdit && (
        <Group gap="xs">
          {p.edit && (
            <Button variant="default" size="xs" onClick={() => p.onDefaultSize(ref)}>
              Taille par défaut
            </Button>
          )}
          <Button
            color="red"
            variant="light"
            size="xs"
            onClick={() => p.onRemove(ref)}
            title="L’objet reste dans la plateforme"
          >
            Retirer de la carte
          </Button>
        </Group>
      )}
      <Text size="xs" c="dimmed">
        Double-cliquez sur un objet pour ouvrir sa fiche.{' '}
        {!isFrame(o) &&
          'Les informations proviennent de la plateforme : un renommage y est repris ici sans déplacer l’objet.'}
      </Text>
    </Stack>
  );
}

function FicheRelation(p: InspecteurProps & { cle: string; fermer: ReactNode }) {
  const manuelle = p.cle.startsWith('m:') ? p.layout.edges.find((x) => 'm:' + x.id === p.cle) : undefined;
  const derivee = manuelle ? undefined : p.relations.find((x) => x.key === p.cle);
  const e = manuelle ?? derivee;
  if (!e)
    return (
      <Stack className="carte-fiche">
        {p.fermer}
        <Text size="sm">Relation introuvable.</Text>
      </Stack>
    );
  const T = RELATIONS[e.type] ?? RELATIONS.related_to;
  const nom = (r: string) => {
    const o = p.lookup(r);
    return o ? ((o as CartoObject).code ? (o as CartoObject).code + ' — ' : '') + o.name : r;
  };
  const nature = derivee
    ? 'Relation issue des données de la plateforme'
    : manuelle?.gen
      ? 'Proposition générée automatiquement, à valider'
      : 'Relation graphique propre à cette carte';
  return (
    <Stack className="carte-fiche" gap="sm">
      <Group justify="space-between">
        <Title order={3} size="h5">
          Relation
        </Title>
        {p.fermer}
      </Group>
      <Ligne l="Type">
        {derivee || !p.canEdit || !p.edit ? (
          <Etiquette>{T.l}</Etiquette>
        ) : (
          <Select
            size="xs"
            aria-label="Type de relation"
            allowDeselect={false}
            value={e.type}
            data={GRAPHIC_RELATION_TYPES.map((k) => ({ value: k, label: RELATIONS[k].l }))}
            onChange={(v) => v && manuelle && p.onEdgeType(manuelle.id, v as RelationType)}
          />
        )}
      </Ligne>
      <Ligne l="Origine">
        <Lien onClick={() => p.onGoto(e.s)}>{nom(e.s)}</Lien>
      </Ligne>
      <Ligne l="Destination">
        <Lien onClick={() => p.onGoto(e.t)}>{nom(e.t)}</Lien>
      </Ligne>
      <Ligne l="Nature">
        <Etiquette color={derivee ? 'green' : manuelle?.gen ? 'orange' : 'gray'}>{nature}</Etiquette>
      </Ligne>
      <Text size="sm" c="dimmed">
        {derivee
          ? 'Pour la modifier, ouvrez l’objet source dans la plateforme (périmètre, objectifs, SWOT, fournisseur…).'
          : 'Cette relation n’est enregistrée que dans la présentation de la carte : elle n’ajoute aucune donnée métier.'}
      </Text>
      {p.canEdit && (
        <Group gap="xs">
          {derivee ? (
            <Button variant="default" size="xs" onClick={() => p.onHide(derivee.key)}>
              Masquer sur cette carte
            </Button>
          ) : (
            <>
              {manuelle?.gen && (
                <Button size="xs" onClick={() => p.onValidate(manuelle.id)}>
                  Valider la proposition
                </Button>
              )}
              <Button color="red" variant="light" size="xs" onClick={() => manuelle && p.onDeleteEdge(manuelle.id)}>
                Supprimer la relation
              </Button>
            </>
          )}
        </Group>
      )}
    </Stack>
  );
}

function Infos(p: InspecteurProps & { fermer: ReactNode }) {
  const gen = p.layout.edges.filter((e) => e.gen).length;
  const a = p.sync.miss.length,
    n = p.sync.news.length;
  return (
    <Stack className="carte-fiche" gap="sm">
      <Group justify="space-between">
        <Title order={3} size="h5">
          Informations sur la carte
        </Title>
        {p.fermer}
      </Group>
      <Ligne l="Objets">{Object.keys(p.layout.nodes).length}</Ligne>
      <Ligne l="Relations graphiques">
        {p.layout.edges.length}
        {gen ? ` dont ${gen} à valider` : ''}
      </Ligne>
      <Ligne l="Enregistrée">
        {p.carte?.updated_at ? `${dateHeure(p.carte.updated_at)} par ${p.carte.updated_by}` : 'Jamais'}
      </Ligne>
      <Ligne l="Synchronisation">
        <Etiquette color={a || n ? 'orange' : 'green'}>
          {a || n ? `${a} indisponible(s), ${n} nouveau(x)` : 'À jour'}
        </Etiquette>
      </Ligne>
      <Ligne l="Versions">{p.carte?.versions ?? 0}</Ligne>
      <Group>
        <Button variant="default" size="xs" onClick={p.onVersions} disabled={!p.carte}>
          Versions de la carte
        </Button>
      </Group>
      <Section titre="Données et présentation">
        <Text size="sm">
          La carte ne stocke que la présentation (positions, tailles, relations graphiques et masquages). Les noms,
          codes, responsables et l’appartenance au périmètre sont relus dans la plateforme à chaque affichage.
        </Text>
      </Section>
    </Stack>
  );
}
