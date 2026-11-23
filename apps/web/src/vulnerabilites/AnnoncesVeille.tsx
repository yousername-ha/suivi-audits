/* Module Vulnérabilités (ADR 0100, lot CVE-INC) : sources facultatives de la veille, désactivées au départ.
   - Tableau des deux sources (activation et fréquence pour qui administre le module, texte sinon ; avertissement des
     fréquences élevées, comme pour un connecteur sous 24 heures).
   - Préavis de Cloudflare Radar : marque « Annonce précoce », CVE critiques et produits surveillés cités (correspondance de
     mots, « à confirmer », jamais une détection), lien vers la page de Cloudflare ; remplacé dès que la CVE est connue par
     NVD, cve.org ou un CERT. Aucune notification, aucune alerte.
   - Résumés de tldrcve : cartes construites par la plateforme, en trois blocs. « Est-ce grave ? » : verdict de tldrcve cité,
     source nommée, et faits de la plateforme (exploitation, KEV, EPSS). « Êtes-vous concerné ? » : données de la plateforme
     (présente sur le parc, exposée, produit surveillé). « Que faire ? » : résumé du flux cité, source nommée, lien vers la page
     de tldrcve. Aucun effet sur la priorité ; textes simples bornés, tels que le flux les publie.
   CSP stricte (ADR 0006) : classes de packages/ui/src/neon-veille.css, aucun style en ligne ; pagination nommée. */
import { Badge, Group, Pagination, Stack, Switch, Table, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  type AnnonceDto,
  avertissementAnnonces,
  type EtatSourceAnnonceDto,
  libelleFrequenceMinutes,
  type PageAnnoncesDto,
  type SourceAnnonce,
} from '@suivi/shared';
import { ErrorAlert, StatusChip } from '@suivi/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, errorMessage, get } from '../api';
import { ChampFrequence } from '../components/ChampFrequence';
import { fmtDate } from '../components/common';
import { PucesCve } from './AvisVeille';
import {
  faitsConcerne,
  faitsGravite,
  HOTE_SOURCE,
  lienSur,
  URL_ANNONCES_SOURCES,
  urlAnnonces,
  urlSourceAnnonce,
  verdictCite,
} from './cve-inconnue';
import { NOMS_PAGINATION } from './pagination';
import { GRAVITE_LIBELLES, nombrePages } from './veille';

const CLE_ANNONCES_SOURCES = ['vulnerabilites', 'veille', 'annonces-sources'] as const;

function Lien({ href, children, nom }: { href: string | null; children: string; nom: string }) {
  if (!href) return null;
  return (
    <a className="va-lien" href={href} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">
      {children}
      <span className="sr-only"> : {nom} (nouvel onglet)</span>
    </a>
  );
}

/** Tableau des sources facultatives (sans état React). */
export function SourcesFacultatives({
  sources,
  fluxOuvert,
  peutRegler,
  enCours,
  onReglage,
}: {
  sources: EtatSourceAnnonceDto[];
  fluxOuvert: boolean;
  peutRegler: boolean;
  enCours: SourceAnnonce | null;
  onReglage: (s: EtatSourceAnnonceDto, r: { activee?: boolean; frequenceMinutes?: number }) => void;
}) {
  return (
    <Table striped withTableBorder aria-label="Sources facultatives de la veille">
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Source</Table.Th>
          <Table.Th>Activée</Table.Th>
          <Table.Th>Fréquence</Table.Th>
          <Table.Th>Dernière collecte réussie</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {sources.map((s) => {
          const avertissement = avertissementAnnonces(s.source, s.frequenceMinutes);
          return (
            <Table.Tr key={s.source}>
              <Table.Td>
                <Text size="sm" fw={600}>
                  {s.libelle}
                </Text>
                <Text size="xs" c="dimmed">
                  {s.organisme} · <span className="veille-code">{s.hote}</span>
                </Text>
                {s.erreur && (
                  <Text size="xs" c="red">
                    Erreur : {s.erreur}
                  </Text>
                )}
              </Table.Td>
              <Table.Td>
                {peutRegler ? (
                  <Switch
                    aria-label={`Activer la source ${s.libelle}`}
                    checked={s.activee}
                    disabled={enCours === s.source}
                    onChange={(e) => onReglage(s, { activee: e.currentTarget.checked })}
                  />
                ) : (
                  <Text size="sm">{s.activee ? 'Oui' : 'Non (désactivée)'}</Text>
                )}
              </Table.Td>
              <Table.Td>
                <Stack gap="2xs">
                  {peutRegler ? (
                    <ChampFrequence
                      size="xs"
                      ariaLabel={`Fréquence de la source ${s.libelle}`}
                      frequences={s.frequences}
                      valeur={s.frequenceMinutes}
                      libelle={libelleFrequenceMinutes}
                      disabled={enCours === s.source}
                      avertissement={avertissement}
                      onChange={(m) => onReglage(s, { frequenceMinutes: m })}
                    />
                  ) : (
                    <Text size="sm">{libelleFrequenceMinutes(s.frequenceMinutes)}</Text>
                  )}
                  <Text size="xs" c="dimmed">
                    Prochaine collecte :{' '}
                    {s.prochaineCollecte ? (
                      <span className="horodatage">{fmtDate(s.prochaineCollecte)}</span>
                    ) : !fluxOuvert ? (
                      'aucune (veille inactive)'
                    ) : (
                      'aucune (source désactivée)'
                    )}
                  </Text>
                </Stack>
              </Table.Td>
              <Table.Td>
                {s.derniereReussite ? (
                  <span className="horodatage">{fmtDate(s.derniereReussite)}</span>
                ) : (
                  <Text size="sm" c="dimmed">
                    Jamais
                  </Text>
                )}
              </Table.Td>
            </Table.Tr>
          );
        })}
      </Table.Tbody>
    </Table>
  );
}

/** Préavis de Cloudflare Radar (sans état React). */
export function ListePreavis({
  annonces,
  onOuvrirCve,
}: {
  annonces: AnnonceDto[];
  onOuvrirCve?: (cve: string) => void;
}) {
  if (!annonces.length)
    return (
      <Text size="sm" c="dimmed">
        Aucune annonce précoce en cours : les CVE annoncées sont déjà connues par NVD, cve.org ou un CERT, ou aucune
        n’est critique ni ne cite un produit surveillé.
      </Text>
    );
  return (
    <ul className="va-liste" aria-label="Annonces précoces (Cloudflare Radar)">
      {annonces.map((a) => (
        <li key={a.id} className="va-item vn-preavis">
          <div className="va-tete">
            <StatusChip etat="attention">Annonce précoce</StatusChip>
            <span className="va-id">{a.cves.join(', ')}</span>
            {a.gravite && (
              <Badge variant="light" color={a.gravite === 'CRITICAL' ? 'red' : 'gray'}>
                Gravité annoncée : {GRAVITE_LIBELLES[a.gravite].toLowerCase()}
                {a.score !== null ? ` (${String(a.score).replace('.', ',')})` : ''}
              </Badge>
            )}
            {a.publieLe && (
              <span className="va-date">
                Annoncée le <span className="horodatage">{fmtDate(a.publieLe)}</span>
              </span>
            )}
          </div>
          <h3 className="va-titre" lang="en">
            {a.titre}
          </h3>
          {a.resume && (
            <p className="va-resume" lang="en">
              {a.resume}
            </p>
          )}
          {a.produitsCites.length > 0 && (
            <p className="va-produit">
              Produit surveillé cité (à confirmer, ce n’est pas une détection) : {a.produitsCites.join(', ')}
            </p>
          )}
          {a.kevAnnonce && <p className="va-produit">Cloudflare la dit inscrite au catalogue KEV.</p>}
          <PucesCve cves={a.cves} onOuvrir={onOuvrirCve} />
          <div className="va-actions">
            <Lien href={lienSur(a.lien, HOTE_SOURCE['cloudflare-radar'])} nom={a.cves.join(', ')}>
              Voir chez Cloudflare
            </Lien>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Carte d'un résumé de tldrcve, en trois blocs construits par la plateforme (sans état React). */
export function CarteTldrcve({ a, onOuvrirCve }: { a: AnnonceDto; onOuvrirCve?: (cve: string) => void }) {
  const verdict = verdictCite(a);
  return (
    <li className="va-item vn-carte">
      <div className="va-tete">
        <span className="va-id">{a.nature === 'mise_a_jour' ? 'Mise à jour' : 'Nouvelle CVE'}</span>
        {a.publieLe && (
          <span className="va-date">
            Publiée le <span className="horodatage">{fmtDate(a.publieLe)}</span>
          </span>
        )}
      </div>
      <h3 className="va-titre" lang="en">
        {a.titre}
      </h3>
      <PucesCve cves={a.cves} onOuvrir={onOuvrirCve} />
      <div className="vn-blocs">
        <section className="vn-bloc" aria-label="Est-ce grave ?">
          <p className="va-etiquette">Est-ce grave ?</p>
          <Text size="sm">{verdict ?? 'tldrcve ne donne pas de verdict pour cette publication.'}</Text>
          <ul className="vn-lignes" aria-label="Faits de la plateforme">
            {a.faits.map((f, i) => (
              <li key={`${i}-${f.cve}`}>
                <span className="veille-code">{f.cve}</span> : {faitsGravite(f).join(' ; ')}
              </li>
            ))}
          </ul>
        </section>
        <section className="vn-bloc" aria-label="Êtes-vous concerné ?">
          <p className="va-etiquette">Êtes-vous concerné ?</p>
          <ul className="vn-lignes">
            {a.faits.map((f, i) => (
              <li key={`${i}-${f.cve}`}>
                <span className="veille-code">{f.cve}</span> : {faitsConcerne(f).join(' ; ')}
              </li>
            ))}
          </ul>
          <Text size="xs" c="dimmed">
            Selon la plateforme, les mêmes pour tous ; la fiche de chaque CVE dit ce que vous pouvez lire.
          </Text>
        </section>
        <section className="vn-bloc" aria-label="Que faire ?">
          <p className="va-etiquette">Que faire ?</p>
          {a.resume ? (
            <Text size="sm" lang="en">
              Résumé de tldrcve : « {a.resume} »
            </Text>
          ) : (
            <Text size="sm" c="dimmed">
              tldrcve ne publie pas de résumé pour cette publication.
            </Text>
          )}
          <Lien href={lienSur(a.lien, HOTE_SOURCE.tldrcve)} nom={a.cves.join(', ')}>
            Lire la page de tldrcve
          </Lien>
        </section>
      </div>
    </li>
  );
}

export function ListeTldrcve({
  annonces,
  onOuvrirCve,
}: {
  annonces: AnnonceDto[];
  onOuvrirCve?: (cve: string) => void;
}) {
  if (!annonces.length)
    return (
      <Text size="sm" c="dimmed">
        Aucun résumé de tldrcve.
      </Text>
    );
  return (
    <ul className="va-liste" aria-label="Résumés de tldrcve">
      {annonces.map((a) => (
        <CarteTldrcve key={a.id} a={a} onOuvrirCve={onOuvrirCve} />
      ))}
    </ul>
  );
}

function PageAnnonces({
  source,
  titre,
  onOuvrirCve,
}: {
  source: SourceAnnonce;
  titre: string;
  onOuvrirCve: (cve: string) => void;
}) {
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: ['vulnerabilites', 'veille', 'annonces', source, page],
    queryFn: () => get<PageAnnoncesDto>(urlAnnonces(source, page)),
  });
  const pages = q.data ? nombrePages(q.data.total, q.data.parPage) : 0;
  return (
    <>
      <Title order={3} size="h5">
        {titre}
      </Title>
      <ErrorAlert error={q.error} />
      {q.data &&
        (source === 'cloudflare-radar' ? (
          <ListePreavis annonces={q.data.elements} onOuvrirCve={onOuvrirCve} />
        ) : (
          <ListeTldrcve annonces={q.data.elements} onOuvrirCve={onOuvrirCve} />
        ))}
      {pages > 1 && (
        <Group justify="flex-end">
          <Pagination
            {...NOMS_PAGINATION}
            total={pages}
            value={page}
            onChange={setPage}
            aria-label={`Pages : ${titre}`}
          />
        </Group>
      )}
    </>
  );
}

/** Section de l'écran « Veille » : sources facultatives et leurs annonces. */
export function AnnoncesVeilleSection({
  fluxOuvert,
  peutRegler,
  onOuvrirCve,
}: {
  fluxOuvert: boolean;
  peutRegler: boolean;
  onOuvrirCve: (cve: string) => void;
}) {
  const qc = useQueryClient();
  const [enCours, setEnCours] = useState<SourceAnnonce | null>(null);
  const sources = useQuery({
    queryKey: CLE_ANNONCES_SOURCES,
    queryFn: () => get<EtatSourceAnnonceDto[]>(URL_ANNONCES_SOURCES),
    refetchInterval: 60_000,
  });
  const regler = async (s: EtatSourceAnnonceDto, r: { activee?: boolean; frequenceMinutes?: number }) => {
    setEnCours(s.source);
    try {
      await api('PATCH', urlSourceAnnonce(s.source), { body: r, ifMatch: s.version });
      notifications.show({ color: 'teal', message: `${s.libelle} : réglage enregistré.` });
    } catch (e) {
      notifications.show({ color: 'red', message: errorMessage(e) });
    } finally {
      await qc.invalidateQueries({ queryKey: CLE_ANNONCES_SOURCES });
      setEnCours(null);
    }
  };
  const actives = sources.data?.filter((s) => s.activee) ?? [];
  return (
    <>
      <Title order={2} size="h4">
        Sources facultatives
      </Title>
      <Text size="sm" c="dimmed">
        Désactivées au départ. Les préavis de Cloudflare Radar annoncent des CVE avant leur publication par NVD ou un
        CERT : seules les CVE critiques et celles qui citent un produit surveillé sont gardées, sans notification ni
        alerte. Les résumés de tldrcve sont présentés tels que le flux les publie, à côté des faits de la plateforme,
        sans effet sur la priorité.
      </Text>
      <ErrorAlert error={sources.error} />
      {sources.data && (
        <SourcesFacultatives
          sources={sources.data}
          fluxOuvert={fluxOuvert}
          peutRegler={peutRegler}
          enCours={enCours}
          onReglage={(s, r) => void regler(s, r)}
        />
      )}
      {actives.some((s) => s.source === 'cloudflare-radar') && (
        <PageAnnonces
          source="cloudflare-radar"
          titre="Annonces précoces (Cloudflare Radar)"
          onOuvrirCve={onOuvrirCve}
        />
      )}
      {actives.some((s) => s.source === 'tldrcve') && (
        <PageAnnonces source="tldrcve" titre="Résumés de tldrcve" onOuvrirCve={onOuvrirCve} />
      )}
    </>
  );
}
