/* Module Vulnérabilités (ADR 0100, lot CVE-INC) : annonces des sources facultatives de la veille, désactivées au départ.
   - Lot VEILLE-PLATEFORME (décision du RSSI du 23/11/2026) : l'activation et la fréquence de ces sources se règlent dans la
     carte « Veille des vulnérabilités » de la Plateforme (ConfigurationVeille.tsx) ; l'écran « Veille » n'en garde que les
     annonces et une ligne d'état par source.
   - Préavis de Cloudflare Radar : marque « Annonce précoce », CVE critiques et produits surveillés cités (correspondance de
     mots, « à confirmer », jamais une détection), lien vers la page de Cloudflare ; remplacé dès que la CVE est connue par
     NVD, cve.org ou un CERT. Aucune notification, aucune alerte.
   - Résumés de tldrcve : cartes construites par la plateforme, en trois blocs. « Est-ce grave ? » : verdict de tldrcve cité,
     source nommée, et faits de la plateforme (exploitation, KEV, EPSS). « Êtes-vous concerné ? » : données de la plateforme
     (présente sur le parc, exposée, produit surveillé). « Que faire ? » : résumé du flux cité, source nommée, lien vers la page
     de tldrcve. Aucun effet sur la priorité ; textes simples bornés, tels que le flux les publie.
   CSP stricte (ADR 0006) : classes de packages/ui/src/neon-veille.css, aucun style en ligne ; pagination nommée. */
import { Badge, Group, Pagination, Text, Title } from '@mantine/core';
import { type AnnonceDto, type EtatSourceAnnonceDto, type PageAnnoncesDto, type SourceAnnonce } from '@suivi/shared';
import { ErrorAlert, StatusChip } from '@suivi/ui';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { get } from '../api';
import { fmtDate } from '../components/common';
import { PucesCve } from './AvisVeille';
import {
  faitsConcerne,
  faitsGravite,
  HOTE_SOURCE,
  lienSur,
  URL_ANNONCES_SOURCES,
  urlAnnonces,
  verdictCite,
} from './cve-inconnue';
import { NOMS_PAGINATION } from './pagination';
import { GRAVITE_LIBELLES, nombrePages } from './veille';

export const CLE_ANNONCES_SOURCES = ['vulnerabilites', 'veille', 'annonces-sources'] as const;

function Lien({ href, children, nom }: { href: string | null; children: string; nom: string }) {
  if (!href) return null;
  return (
    <a className="va-lien" href={href} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">
      {children}
      <span className="sr-only"> : {nom} (nouvel onglet)</span>
    </a>
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

/** État des sources facultatives (activation, fréquence, dernière collecte) : lu par l'écran « Veille » (lignes d'état, listes
    des sources activées) et par la carte de la Plateforme (réglages). Une seule clé, une seule adresse. */
export function useSourcesAnnonces(actif = true) {
  return useQuery({
    queryKey: CLE_ANNONCES_SOURCES,
    queryFn: () => get<EtatSourceAnnonceDto[]>(URL_ANNONCES_SOURCES),
    enabled: actif,
    refetchInterval: 60_000,
  });
}

/** Section de l'écran « Veille » : annonces des sources facultatives activées (préavis, cartes de tldrcve), sans réglage :
    l'activation et la fréquence se règlent dans la carte « Veille des vulnérabilités » de la Plateforme. */
export function AnnoncesVeilleSection({
  sources,
  onOuvrirCve,
}: {
  sources: readonly EtatSourceAnnonceDto[] | undefined;
  onOuvrirCve: (cve: string) => void;
}) {
  const actives = sources?.filter((s) => s.activee) ?? [];
  if (!actives.length) return null;
  return (
    <>
      <Title order={2} size="h4">
        Annonces des sources facultatives
      </Title>
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
