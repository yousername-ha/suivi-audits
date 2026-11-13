/* Présentation Studio du registre réel ; aucune requête ou copie métier dans ce composant. */
import { ActionIcon, Button, Menu, Popover, Select, Tabs, TextInput, Tooltip } from '@mantine/core';
import { retenirFocusFiche } from '@suivi/ui';
import { useRef, useState, type ReactNode } from 'react';
import { ficheCliquable } from '../fiche-cliquable';
import type { Fournisseur } from './fournisseurs-types';

const icons: Record<string, ReactNode> = {
  list: <path d="M7 6h14M7 12h14M7 18h14M3 6h.01M3 12h.01M3 18h.01" />,
  detail: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M9 9v12" />
    </>
  ),
  search: (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="m15 15 6 6" />
    </>
  ),
  filter: <path d="M4 6h16M7 12h10M10 18h4" />,
  box: <path d="m12 2 10 6v10l-10 5-10-5V8zM2 8l10 5 10-5M12 13v10M7 5l10 5" />,
  cloud: <path d="M6 18a5 5 0 1 1 0-10 7 7 0 0 1 13 1 4.5 4.5 0 0 1 0 9z" />,
  shield: <path d="m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6zM7 12l3 3 7-7" />,
  key: (
    <>
      <circle cx="8" cy="8" r="5" />
      <path d="m12 12 9 9m-5-5 3-3m-6 0 3-3" />
    </>
  ),
  more: (
    <>
      <circle cx="4" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="20" cy="12" r="1" />
    </>
  ),
};
function Icon({ name }: { name: string }) {
  return (
    <svg
      className="fs-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {icons[name]}
    </svg>
  );
}
export const dateFournisseur = (value: string | null | undefined) =>
  value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.split('-').reverse().join('/') : 'Non renseigné';
export function PuceFournisseur({ children, tone = 'neutral' }: { children: ReactNode; tone?: string }) {
  return (
    <span className="fs-chip" data-tone={tone}>
      {children}
    </span>
  );
}
function Controle({ f }: { f: Fournisseur }) {
  const c = f.controlSummary;
  return (
    <>
      {c.enRetard > 0 && <PuceFournisseur tone="bad">{c.enRetard} en retard</PuceFournisseur>}
      {c.nonConformes > 0 && <PuceFournisseur tone="bad">{c.nonConformes} non conforme</PuceFournisseur>}
      {c.aRealiser > 0 && <PuceFournisseur tone="warn">{c.aRealiser} à réaliser</PuceFournisseur>}
      {!c.enRetard && !c.nonConformes && !c.aRealiser && (
        <PuceFournisseur tone={c.total ? 'good' : 'neutral'}>{c.total ? 'À jour' : 'Aucun contrôle'}</PuceFournisseur>
      )}
      <small>{c.prochain ? `Échéance ${dateFournisseur(c.prochain)}` : 'Échéance non renseignée'}</small>
    </>
  );
}
function Evaluation({ f }: { f: Fournisseur }) {
  const e = f.current;
  return e ? (
    <>
      <span className="fs-visually-hidden">
        {e.meets} répond · {e.notMeets} ne répond pas · {e.notAssessed} non évalué
      </span>
      <span className="fs-score" aria-hidden="true">
        <span data-tone="good">✓ {e.meets}</span>
        <span data-tone="bad">× {e.notMeets}</span>
        <span>— {e.notAssessed}</span>
      </span>
      <small aria-hidden="true">Répond · Ne répond pas · Non évalué</small>
      <small>{dateFournisseur(e.evaluatedAt)}</small>
      {e.nextReviewAt && <small className="fs-context">Réévaluation {dateFournisseur(e.nextReviewAt)}</small>}
      {f.toReview && <PuceFournisseur tone="bad">À réévaluer</PuceFournisseur>}
    </>
  ) : (
    <PuceFournisseur>Non évalué</PuceFournisseur>
  );
}
export type ChampFournisseur = 'sso' | 'mfa' | 'critical' | 'hds';
interface Props {
  tous: Fournisseur[];
  affiches: Fournisseur[];
  loading: boolean;
  available: boolean;
  modifier: boolean;
  recherche: string;
  filtre: string;
  type: string;
  situations: { value: string; label: string }[];
  mfa: { oui: number; saas: number; pct: number };
  sso: { oui: number; saas: number; pct: number };
  onRecherche: (value: string) => void;
  onFiltre: (value: string) => void;
  onType: (value: string) => void;
  onCreate: () => void;
  onRead: (f: Fournisseur) => void;
  onEdit: (f: Fournisseur) => void;
  onEvaluate: (f: Fournisseur) => void;
  onHistory: (f: Fournisseur) => void;
  onScopes: (f: Fournisseur) => void;
  cellule: (f: Fournisseur, champ: ChampFournisseur) => ReactNode;
}
export function FournisseursStudio(p: Props) {
  const [density, setDensity] = useState<'compact' | 'detail'>('compact'),
    [search, setSearch] = useState(false),
    [filters, setFilters] = useState(false);
  const filterRef = useRef<HTMLButtonElement>(null);
  const active = Number(p.filtre !== 'all') + Number(p.type !== 'all'),
    criteria = active > 0 || !!p.recherche.trim();
  const reset = () => {
    p.onRecherche('');
    p.onFiltre('all');
    p.onType('all');
    setSearch(false);
    setFilters(false);
    requestAnimationFrame(() => filterRef.current?.focus({ preventScroll: true }));
  };
  const stats = [
    { label: 'Répertoire', value: p.tous.length, sub: 'fournisseurs dans l’organisation', icon: 'box', tone: 'cyan' },
    { label: 'Services SaaS', value: p.mfa.saas, sub: 'services déclarés', icon: 'cloud', tone: 'blue' },
    {
      label: 'MFA confirmée',
      value: p.mfa.saas ? `${p.mfa.pct} %` : '—',
      sub: `${p.mfa.oui} / ${p.mfa.saas} services SaaS`,
      icon: 'shield',
      tone: 'green',
    },
    {
      label: 'SSO confirmé',
      value: p.sso.saas ? `${p.sso.pct} %` : '—',
      sub: `${p.sso.oui} / ${p.sso.saas} services SaaS`,
      icon: 'key',
      tone: 'blue',
    },
  ];
  return (
    <section className="fournisseurs-studio" aria-label="Fournisseurs et applications">
      <div className="fs-summary" aria-label="Indicateurs des fournisseurs">
        {stats.map((s) => (
          <div className="fs-stat" data-tone={s.tone} key={s.label}>
            <small>{s.label}</small>
            <strong>{p.available ? s.value : '—'}</strong>
            <span>{p.available ? s.sub : p.loading ? 'Chargement…' : 'Données indisponibles'}</span>
            <Icon name={s.icon} />
          </div>
        ))}
      </div>
      <div className="fs-workspace">
        <div className="fs-toolbar">
          <div className="fs-toolbar-start">
            <div className="fs-views" role="group" aria-label="Densité du registre">
              {(['compact', 'detail'] as const).map((d) => (
                <Tooltip label={d === 'compact' ? 'Vue compacte' : 'Vue détaillée'} key={d}>
                  <button
                    type="button"
                    className="fs-tool"
                    aria-label={d === 'compact' ? 'Vue compacte' : 'Vue détaillée'}
                    aria-pressed={density === d}
                    onClick={() => setDensity(d)}
                  >
                    <Icon name={d === 'compact' ? 'list' : 'detail'} />
                  </button>
                </Tooltip>
              ))}
            </div>
            <strong>{density === 'compact' ? 'Registre compact' : 'Registre détaillé'}</strong>
            <span className="fs-note">Évaluations communes à tous les périmètres</span>
          </div>
          <div className="fs-toolbar-end">
            <Popover opened={search} onChange={setSearch} position="bottom-end" trapFocus returnFocus>
              <Popover.Target>
                <button
                  type="button"
                  className="fs-tool"
                  aria-label="Rechercher un fournisseur"
                  aria-expanded={search}
                  onClick={() => setSearch((v) => !v)}
                >
                  <Icon name="search" />
                </button>
              </Popover.Target>
              <Popover.Dropdown>
                <TextInput
                  label="Rechercher un fournisseur"
                  placeholder="Nom du fournisseur…"
                  value={p.recherche}
                  onChange={(e) => p.onRecherche(e.currentTarget.value)}
                  data-autofocus
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      e.stopPropagation();
                      setSearch(false);
                    }
                  }}
                />
              </Popover.Dropdown>
            </Popover>
            <Popover opened={filters} onChange={setFilters} position="bottom-end" trapFocus returnFocus>
              <Popover.Target>
                <button
                  type="button"
                  className="fs-tool"
                  ref={filterRef}
                  aria-label={active ? `Filtres fournisseurs (${active} actifs)` : 'Filtres fournisseurs'}
                  aria-expanded={filters}
                  onClick={() => setFilters((v) => !v)}
                >
                  <Icon name="filter" />
                  {active > 0 && <b>{active}</b>}
                </button>
              </Popover.Target>
              <Popover.Dropdown>
                <div className="fs-filters">
                  <Select
                    label="Situation"
                    data={p.situations}
                    value={p.filtre}
                    allowDeselect={false}
                    onChange={(v) => p.onFiltre(v ?? 'all')}
                  />
                  <Select
                    label="Type"
                    data={[
                      { value: 'all', label: 'Tous les types' },
                      { value: 'saas', label: 'Services SaaS' },
                      { value: 'autre', label: 'Hors SaaS' },
                    ]}
                    value={p.type}
                    allowDeselect={false}
                    onChange={(v) => p.onType(v ?? 'all')}
                  />
                  <Button variant="subtle" disabled={!criteria} onClick={reset}>
                    Réinitialiser
                  </Button>
                </div>
              </Popover.Dropdown>
            </Popover>
            {p.modifier && <Button onClick={p.onCreate}>Ajouter un fournisseur</Button>}
          </div>
        </div>
        <p className="fs-caption">
          Les critères sont définis par l’organisation. Aucun seuil ni score global n’est ajouté.
          {p.available && <> · {p.tous.filter((f) => f.mfa !== 'Oui').length} sans MFA confirmée</>}
        </p>
        {criteria && (
          <div className="fs-criteria">
            <span>
              {[
                p.recherche.trim() && `Recherche : ${p.recherche.trim()}`,
                p.filtre !== 'all' && p.situations.find((x) => x.value === p.filtre)?.label,
                p.type !== 'all' && (p.type === 'saas' ? 'Services SaaS' : 'Hors SaaS'),
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
            <Button variant="subtle" size="xs" onClick={reset}>
              Tout effacer
            </Button>
          </div>
        )}
        <div
          className="fs-scroll"
          tabIndex={0}
          role="region"
          aria-label="Lignes des fournisseurs"
          aria-busy={p.loading}
        >
          <table className="fs-table" data-density={density}>
            <caption className="fs-visually-hidden">Fournisseurs : accès, suivi et évaluations</caption>
            <thead>
              <tr>
                <th scope="col">Fournisseur / application</th>
                <th scope="col">Accès</th>
                <th scope="col">Criticité / HDS déclaré</th>
                <th scope="col">Certificats</th>
                <th scope="col">Contrôles périodiques</th>
                <th scope="col">Évaluation courante</th>
                <th scope="col">
                  <span className="fs-visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {p.affiches.map((f) => (
                <tr
                  key={f.id}
                  className="fs-row"
                  data-supplier={f.id}
                  data-attention={
                    !!(
                      f.toReview ||
                      f.controlSummary.enRetard ||
                      f.controlSummary.nonConformes ||
                      f.controlSummary.aRealiser ||
                      ['bad', 'mid'].includes(f.certificateState[1])
                    )
                  }
                  {...ficheCliquable(() => p.onRead(f), `Afficher ${f.name}`)}
                >
                  <td>
                    <div className="fs-identity">
                      <span className="fs-glyph">
                        <Icon name={f.saas ? 'cloud' : 'box'} />
                      </span>
                      <div>
                        <strong>{f.name}</strong>
                        <small>
                          {f.id} · {f.saas ? 'Service SaaS' : 'Hors SaaS'}
                          {f.rattachement && ` · ${f.rattachement}`}
                        </small>
                        <small className="fs-context">{f.notes || 'Aucune note renseignée'}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="fs-cell">
                      <span className="fs-pair">
                        <span>SSO</span>
                        {p.cellule(f, 'sso')}
                      </span>
                      <span className="fs-pair">
                        <span>MFA</span>
                        {p.cellule(f, 'mfa')}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className="fs-cell">
                      <span className="fs-pair">
                        <span>Crit.</span>
                        {p.cellule(f, 'critical')}
                      </span>
                      <span className="fs-pair">
                        <span>HDS</span>
                        {p.cellule(f, 'hds')}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className="fs-cell">
                      <PuceFournisseur
                        tone={{ ok: 'good', mid: 'warn', bad: 'bad', '': 'neutral' }[f.certificateState[1]]}
                      >
                        {f.certificateState[0] || 'Non renseigné'}
                      </PuceFournisseur>
                      <small>
                        {f.certs.length} certificat{f.certs.length > 1 ? 's' : ''}
                      </small>
                    </div>
                  </td>
                  <td>
                    <div className="fs-cell">
                      <Controle f={f} />
                    </div>
                  </td>
                  <td>
                    <div className="fs-cell">
                      <Evaluation f={f} />
                      <small className="fs-context">
                        {f.scopes.length} périmètre{f.scopes.length > 1 ? 's' : ''} rattaché
                        {f.scopes.length > 1 ? 's' : ''}
                      </small>
                    </div>
                  </td>
                  <td>
                    <Menu position="bottom-end">
                      <Menu.Target>
                        <ActionIcon
                          variant="default"
                          aria-label={`Actions de ${f.name}`}
                          onClick={(e) => {
                            const row = e.currentTarget.closest<HTMLElement>('[data-fiche-ouvrable]');
                            if (row) retenirFocusFiche(row);
                          }}
                        >
                          <Icon name="more" />
                        </ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Item onClick={() => p.onRead(f)}>Afficher</Menu.Item>
                        {p.modifier && <Menu.Item onClick={() => p.onEdit(f)}>Modifier la fiche</Menu.Item>}
                        {p.modifier && <Menu.Item onClick={() => p.onEvaluate(f)}>Évaluer</Menu.Item>}
                        <Menu.Item onClick={() => p.onHistory(f)}>Historique des évaluations</Menu.Item>
                        <Menu.Item onClick={() => p.onScopes(f)}>Périmètres de rattachement</Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!p.affiches.length && (
            <p className="fs-empty">
              {p.loading
                ? 'Chargement des fournisseurs…'
                : !p.available
                  ? 'Les fournisseurs ne sont pas disponibles.'
                  : p.tous.length
                    ? 'Aucun fournisseur ne correspond aux filtres.'
                    : 'Aucun fournisseur dans le registre.'}
            </p>
          )}
        </div>
        <footer className="fs-footer" aria-live="polite">
          {p.available
            ? `${p.affiches.length} fournisseurs affichés sur ${p.tous.length}`
            : p.loading
              ? 'Chargement…'
              : 'Données indisponibles'}
        </footer>
      </div>
    </section>
  );
}

/** Vue d’audit : valeurs seules, actions renvoyant vers les formulaires et l’historique existants. */
export function LectureFournisseur({
  f,
  modifier,
  onEdit,
  onEvaluate,
  onHistory,
  onScopes,
  onClose,
}: {
  f: Fournisseur;
  modifier: boolean;
  onEdit: () => void;
  onEvaluate: () => void;
  onHistory: () => void;
  onScopes: () => void;
  onClose: () => void;
}) {
  const [certPage, setCertPage] = useState(0),
    [controlPage, setControlPage] = useState(0);
  const certIndex = Math.min(certPage, Math.max(0, f.certs.length - 1)),
    controlIndex = Math.min(controlPage, Math.max(0, f.controls.length - 1));
  const cert = f.certs[certIndex],
    control = f.controls[controlIndex];
  const field = (label: string, value: ReactNode) => (
    <div key={label}>
      <dt>{label}</dt>
      <dd>{value || 'Non renseigné'}</dd>
    </div>
  );
  const pagination = (label: string, index: number, total: number, set: (n: number) => void) =>
    total > 1 ? (
      <div className="fs-record-nav" aria-label={label}>
        <Button size="xs" variant="default" disabled={!index} onClick={() => set(index - 1)}>
          Précédent
        </Button>
        <span aria-live="polite">
          {index + 1} / {total}
        </span>
        <Button size="xs" variant="default" disabled={index >= total - 1} onClick={() => set(index + 1)}>
          Suivant
        </Button>
      </div>
    ) : null;
  return (
    <div className="fournisseurs-studio fs-read">
      <div className="fs-read-sub">
        {f.id} · {f.saas ? 'Service SaaS' : 'Hors SaaS'}
        {f.rattachement && ` · ${f.rattachement}`}
      </div>
      <Tabs defaultValue="info">
        <Tabs.List aria-label="Informations du fournisseur">
          <Tabs.Tab value="info">Informations</Tabs.Tab>
          <Tabs.Tab value="certs">Certificats ({f.certs.length})</Tabs.Tab>
          <Tabs.Tab value="controls">Contrôles ({f.controls.length})</Tabs.Tab>
          <Tabs.Tab value="evaluation">Évaluation</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="info">
          <div className="fs-detail-body">
            <section>
              <h3>Identité et accès</h3>
              <dl>
                {field('Contact', f.contact)}
                {field('Rattachement', f.rattachement)}
                {field('SSO', f.sso)}
                {field('MFA', f.mfa)}
                {field('Critique', f.critical)}
                {field('Hébergeur HDS déclaré', f.hds)}
              </dl>
            </section>
            <section>
              <h3>Notes et périmètres</h3>
              <div className="fs-notes" tabIndex={0} role="region" aria-label="Notes du fournisseur">
                <p>{f.notes || 'Aucune note renseignée.'}</p>
              </div>
              <p>
                {f.scopes.length
                  ? `${f.scopes.length} périmètre${f.scopes.length > 1 ? 's' : ''} rattaché${f.scopes.length > 1 ? 's' : ''}.`
                  : 'Aucun périmètre rattaché.'}
              </p>
              <Button variant="subtle" onClick={onScopes}>
                Voir les périmètres
              </Button>
            </section>
          </div>
        </Tabs.Panel>
        <Tabs.Panel value="certs">
          <div className="fs-detail-body">
            <section className="fs-wide">
              <h3>Certificats</h3>
              {cert ? (
                <article>
                  <strong>{cert.type}</strong>
                  <dl>
                    {field('Validité', dateFournisseur(cert.validUntil))}
                    {field('Reçu le', dateFournisseur(cert.received))}
                    {field('Périmètre du certificat', cert.scope)}
                    {field('Emplacement', cert.location)}
                  </dl>
                </article>
              ) : (
                <p>Aucun certificat renseigné.</p>
              )}
              {pagination('Parcourir les certificats', certIndex, f.certs.length, setCertPage)}
            </section>
          </div>
        </Tabs.Panel>
        <Tabs.Panel value="controls">
          <div className="fs-detail-body">
            <section className="fs-wide">
              <h3>Contrôles périodiques</h3>
              {control ? (
                <article>
                  <strong>{control.t}</strong>
                  <dl>
                    {field('Fréquence', `${control.freq ?? 12} mois`)}
                    {field('Dernier contrôle', dateFournisseur(control.last))}
                    {field('Résultat', control.result)}
                    {field('Référence', control.ref)}
                    {field('Commentaire', control.comment)}
                  </dl>
                </article>
              ) : (
                <p>Aucun contrôle renseigné.</p>
              )}
              {pagination('Parcourir les contrôles', controlIndex, f.controls.length, setControlPage)}
            </section>
          </div>
        </Tabs.Panel>
        <Tabs.Panel value="evaluation">
          <div className="fs-detail-body">
            <section className="fs-wide">
              <h3>Évaluation courante</h3>
              {f.current ? (
                <>
                  <div className="fs-evaluation">
                    <PuceFournisseur tone="good">{f.current.meets} répond</PuceFournisseur>
                    <PuceFournisseur tone={f.current.notMeets ? 'bad' : 'neutral'}>
                      {f.current.notMeets} ne répond pas
                    </PuceFournisseur>
                    <PuceFournisseur>{f.current.notAssessed} non évalué</PuceFournisseur>
                  </div>
                  <dl>
                    {field('Date', dateFournisseur(f.current.evaluatedAt))}
                    {field('Évaluateur', f.current.evaluator)}
                    {field('Réévaluation', dateFournisseur(f.current.nextReviewAt))}
                    {field('À réévaluer', f.toReview ? 'Oui' : 'Non')}
                  </dl>
                </>
              ) : (
                <p>Aucune évaluation enregistrée.</p>
              )}
            </section>
          </div>
        </Tabs.Panel>
      </Tabs>
      <div className="fs-read-actions">
        <Button variant="default" onClick={onHistory}>
          Historique
        </Button>
        {modifier && (
          <Button variant="default" onClick={onEvaluate}>
            Évaluer
          </Button>
        )}
        {modifier && <Button onClick={onEdit}>Modifier la fiche</Button>}
        <Button variant="default" onClick={onClose}>
          Fermer
        </Button>
      </div>
    </div>
  );
}
