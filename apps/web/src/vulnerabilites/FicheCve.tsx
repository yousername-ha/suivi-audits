/* Module Vulnérabilités (ADR 0100, lot CVE-INC) : fiche d'une CVE ouverte depuis la veille ou la barre de recherche.
   - CVE connue (sa fiche s'ouvre : veille, contrôle de Tenable, surface externe) : la fiche illustrée habituelle (lot PC4), précédée des marques
     des sources facultatives (« Annonce précoce » de Cloudflare Radar, résumé de tldrcve) et de l'évaluation de cve.org si
     elle a été consultée.
   - CVE inconnue de la veille : rien n'est appelé sans clic, sauf la recherche des contrôles Tenable (Security Center
     configuré et flux ouvert), inscrite à l'ouverture de la fiche, sans bouton. « Consulter cve.org et NVD » inscrit la
     consultation (traitée par l'exécutant, en quelques secondes) ; l'interface interroge l'API pendant l'attente d'une
     demande réellement inscrite, deux minutes au plus (une recherche non demandée, limite atteinte ou ouverture en échec,
     ou indisponible, est dite et jamais attendue). « Voir chez Tenable » : lien seulement.
   Textes des sources en texte simple, rendus échappés par React ; références de cve.org en texte, jamais en lien (hôtes hors
   de la liste fermée) ; liens vers Tenable, cve.org, Cloudflare et tldrcve contrôlés (https sur l'hôte attendu), nouvel
   onglet sans référent. CSP stricte (ADR 0006) : classes de packages/ui/src/neon-veille.css, aucun style en ligne. */
import { Alert, Button, Group, Loader, Stack, Table, Text } from '@mantine/core';
import { type ComplementsCveDto, type FicheCveOrg, type FicheFailleDto, type OuvertureCveDto } from '@suivi/shared';
import { ErrorAlert, StatusChip } from '@suivi/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { api, ApiError, errorMessage, get } from '../api';
import { fmtDate } from '../components/common';
import {
  enAttente,
  HOTE_SOURCE,
  INTERROGATION_MAX_MS,
  INTERROGATION_MS,
  libelleConsultation,
  libelleExploit,
  libellePartie,
  libelleRisque,
  lienSur,
  lignesSsvc,
  type OuvertureTenableVue,
  phraseTenable,
  urlComplements,
  urlConsultation,
  urlOuverture,
  verdictCite,
  versionsDeclarees,
} from './cve-inconnue';
import { FicheFaille } from './FicheFaille';
import { urlFicheFaille } from './fiche-faille';

function LienExterne({ href, children, nom }: { href: string | null; children: string; nom: string }) {
  if (!href) return null;
  return (
    <a className="va-lien" href={href} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">
      {children}
      <span className="sr-only"> : {nom} (nouvel onglet)</span>
    </a>
  );
}

/** Marques des sources facultatives et évaluation de cve.org (sans état React). */
export function MarquesCve({ c }: { c: ComplementsCveDto }) {
  const preavis = c.annonces.filter((a) => a.source === 'cloudflare-radar');
  const resumes = c.annonces.filter((a) => a.source === 'tldrcve');
  const ssvc = lignesSsvc(c.consultation.cveOrg?.ssvc ?? null);
  if (!preavis.length && !resumes.length && !ssvc.length) return null;
  return (
    <section className="va-section vn-marques" aria-label="Marques des sources facultatives">
      <ul className="va-marques" aria-label="Marques">
        {preavis.length > 0 && (
          <li>
            <StatusChip etat="attention">Annonce précoce (Cloudflare Radar, à confirmer)</StatusChip>
          </li>
        )}
        {resumes.length > 0 && (
          <li>
            <StatusChip etat="info">Résumé tldrcve disponible</StatusChip>
          </li>
        )}
      </ul>
      {preavis.map((a, i) => (
        <Text size="sm" key={`p${i}`}>
          Annonce précoce : {a.titre}{' '}
          <LienExterne href={lienSur(a.lien, HOTE_SOURCE['cloudflare-radar'])} nom={c.cve}>
            Voir chez Cloudflare
          </LienExterne>
        </Text>
      ))}
      {resumes.map((a, i) => (
        <Text size="sm" key={`r${i}`}>
          {verdictCite(a) ?? 'tldrcve ne donne pas de verdict.'}{' '}
          <LienExterne href={lienSur(a.lien, HOTE_SOURCE.tldrcve)} nom={c.cve}>
            Lire chez tldrcve
          </LienExterne>
        </Text>
      ))}
      {ssvc.length > 0 && (
        <div>
          <p className="va-etiquette">Évaluation SSVC de la CISA (cve.org)</p>
          <ul className="vn-lignes">
            {ssvc.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/** Ce que cve.org a rendu (liste blanche), en texte simple. */
export function FicheCveOrgVue({ f }: { f: FicheCveOrg }) {
  const ssvc = lignesSsvc(f.ssvc);
  return (
    <section className="va-section" aria-label="Enregistrement de cve.org">
      <p className="va-etiquette">Enregistrement de cve.org{f.etat === 'rejetee' ? ' (rejeté)' : ''}</p>
      {f.titre && <h3 className="va-titre">{f.titre}</h3>}
      {f.description && (
        <Text size="sm" lang="en">
          {f.description}
        </Text>
      )}
      <dl className="va-mentions">
        {f.cna && (
          <div>
            <dt>Autorité de numérotation (CNA) :</dt>
            <dd>{f.cna}</dd>
          </div>
        )}
        {f.publieLe && (
          <div>
            <dt>Publiée le :</dt>
            <dd className="horodatage">{fmtDate(f.publieLe)}</dd>
          </div>
        )}
        {f.majLe && (
          <div>
            <dt>Mise à jour le :</dt>
            <dd className="horodatage">{fmtDate(f.majLe)}</dd>
          </div>
        )}
        {f.kevAjoutLe && (
          <div>
            <dt>Catalogue KEV de la CISA :</dt>
            <dd>ajoutée le {f.kevAjoutLe}</dd>
          </div>
        )}
      </dl>
      {ssvc.length > 0 ? (
        <div>
          <p className="va-etiquette">Évaluation SSVC de la CISA</p>
          <ul className="vn-lignes">
            {ssvc.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>
      ) : (
        <Text size="sm" c="dimmed">
          Aucune évaluation SSVC de la CISA dans l’enregistrement.
        </Text>
      )}
      {f.produits.length > 0 && (
        <div>
          <p className="va-etiquette">Produits touchés déclarés</p>
          <ul className="vn-lignes">
            {f.produits.map((p, i) => (
              <li key={i}>
                {[p.editeur, p.produit].filter(Boolean).join(' ')} : {versionsDeclarees(p)}
              </li>
            ))}
          </ul>
        </div>
      )}
      {f.references.length > 0 && (
        <div>
          <p className="va-etiquette">Références (adresses en texte, à vérifier avant de les ouvrir)</p>
          <ul className="vn-lignes vn-references">
            {f.references.map((r, i) => (
              <li key={`${i}-${r.url}`}>
                {r.nom ? `${r.nom} : ` : ''}
                <span className="veille-code">{r.url}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/** Contrôles Tenable qui citent la CVE : numéro, nom, famille, exploit disponible. Jamais de machine. `ouverture` : ce que
    l'ouverture de la fiche a fait de la recherche (limite atteinte, échec), dit quand rien n'est inscrit. */
export function ControlesTenableVue({
  c,
  ouverture = null,
}: {
  c: ComplementsCveDto;
  ouverture?: OuvertureTenableVue;
}) {
  const t = c.tenable;
  return (
    <section className="va-section" aria-label="Tenable Security Center">
      <p className="va-etiquette">Tenable Security Center</p>
      <Text size="sm" role="status">
        {phraseTenable(t, ouverture)}
      </Text>
      {t.etat === 'recu' && t.controles.length > 0 && (
        <Table striped withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Numéro</Table.Th>
              <Table.Th>Nom</Table.Th>
              <Table.Th>Famille</Table.Th>
              <Table.Th>Exploit disponible</Table.Th>
              <Table.Th>Risque (Tenable)</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {t.controles.map((x) => (
              <Table.Tr key={x.id}>
                <Table.Td className="veille-code">{x.id}</Table.Td>
                <Table.Td>{x.nom}</Table.Td>
                <Table.Td>{x.famille ?? '—'}</Table.Td>
                <Table.Td>{libelleExploit(x.exploitDisponible)}</Table.Td>
                <Table.Td>{libelleRisque(x.risque)}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </section>
  );
}

/** Fiche d'une CVE inconnue de la veille (sans état React). */
export function FicheCveInconnueVue({
  c,
  envoi,
  erreur,
  ouverture = null,
  onConsulter,
}: {
  c: ComplementsCveDto;
  envoi: boolean;
  erreur: string | null;
  ouverture?: OuvertureTenableVue;
  onConsulter: () => void;
}) {
  const k = c.consultation;
  return (
    <article className="va-fiche vn-fiche" aria-label={`CVE inconnue de la veille : ${c.cve}`}>
      <Alert color="orange" title={`${c.cve} : CVE inconnue de la veille`}>
        Ni la veille ni aucune détection ne la citent. La plateforme ne consulte un service extérieur que sur votre clic
        (cve.org et NVD, par l’exécutant du serveur : seul l’identifiant de la CVE sort).
      </Alert>
      <MarquesCve c={c} />
      <section className="va-section" aria-label="Consultation de cve.org et NVD">
        <p className="va-etiquette">cve.org et NVD</p>
        <Text size="sm" role="status">
          {libelleConsultation(k)}
          {k.obtenuLe && (
            <>
              {' '}
              Dernière réponse le <span className="horodatage">{fmtDate(k.obtenuLe)}</span>.
            </>
          )}
        </Text>
        {k.etat === 'recu' && (
          <Text size="sm">
            {libellePartie('cve.org', k.cveOrgEtat)} ; {libellePartie('NVD', k.nvdEtat)}.
          </Text>
        )}
        {erreur && <Alert color="red">{erreur}</Alert>}
        <Group>
          <Button onClick={onConsulter} loading={envoi} disabled={!k.possible}>
            Consulter cve.org et NVD
          </Button>
          {!k.possible && k.motif && k.etat !== 'en_attente' && (
            <Text size="sm" c="dimmed">
              {k.motif}
            </Text>
          )}
        </Group>
        {k.cveOrg && <FicheCveOrgVue f={k.cveOrg} />}
      </section>
      <ControlesTenableVue c={c} ouverture={ouverture} />
      <div className="va-actions">
        <LienExterne href={lienSur(c.lienTenable, 'www.tenable.com')} nom={c.cve}>
          Voir chez Tenable
        </LienExterne>
        <LienExterne href={lienSur(c.lienCveOrg, 'www.cve.org')} nom={c.cve}>
          Fiche sur cve.org
        </LienExterne>
      </div>
    </article>
  );
}

/** Fiche d'une CVE : la fiche habituelle si elle s'ouvre, sinon (404 : ni la veille, ni un contrôle, ni la surface externe ne
    la citent) la fiche d'une CVE inconnue de la veille. Même clé et même adresse que FicheFaille : une seule lecture. */
export function FicheCve({ cve }: { cve: string }) {
  const fiche = useQuery({
    queryKey: ['vulnerabilites', 'fiche-faille', 'cve', cve],
    queryFn: () => get<FicheFailleDto>(urlFicheFaille('cve', cve)),
  });
  const inconnue = fiche.error instanceof ApiError && fiche.error.status === 404;
  if (fiche.data) return <FicheCveConnue cve={cve} />;
  if (inconnue) return <FicheCveSansVeille cve={cve} />;
  if (fiche.error) return <ErrorAlert error={fiche.error} />;
  return (
    <Group>
      <Loader size="sm" />
      <Text size="sm">Chargement de la fiche…</Text>
    </Group>
  );
}

/** CVE connue : marques des sources facultatives (si la lecture des compléments réussit), puis la fiche habituelle. */
function FicheCveConnue({ cve }: { cve: string }) {
  const q = useQuery({
    queryKey: ['vulnerabilites', 'cve-complements', cve],
    queryFn: () => get<ComplementsCveDto>(urlComplements(cve)),
    retry: false,
  });
  return (
    <Stack>
      {q.data && <MarquesCve c={q.data} />}
      <FicheFaille nature="cve" id={cve} />
    </Stack>
  );
}

/** CVE inconnue de la veille : consultation sur clic, contrôles Tenable à l'ouverture. */
function FicheCveSansVeille({ cve }: { cve: string }) {
  const qc = useQueryClient();
  const debut = useRef(Date.now());
  const ouverte = useRef<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [ouverture, setOuverture] = useState<OuvertureTenableVue>(null);
  const cle = ['vulnerabilites', 'cve-complements', cve];
  const q = useQuery({
    queryKey: cle,
    queryFn: () => get<ComplementsCveDto>(urlComplements(cve)),
    refetchInterval: (r) =>
      enAttente(r.state.data) && Date.now() - debut.current < INTERROGATION_MAX_MS ? INTERROGATION_MS : false,
  });
  // Réponse reçue et la CVE devenue connue (NVD l'a rangée) : la fiche habituelle remplace celle-ci.
  const connue = !!q.data?.connue;
  useEffect(() => {
    if (connue) void qc.invalidateQueries({ queryKey: ['vulnerabilites', 'fiche-faille', 'cve', cve] });
  }, [connue, cve, qc]);
  // Ouverture de la fiche d'une CVE inconnue : notée une fois (veille active de l'exécutant, contrôles Tenable sans clic).
  useEffect(() => {
    if (!q.data || q.data.connue || ouverte.current === cve) return;
    ouverte.current = cve;
    debut.current = Date.now();
    // Ce que l'ouverture a fait de la recherche Security Center est gardé et dit (limite atteinte, échec) : l'écran n'attend
    // que pour une recherche réellement inscrite (état `en_attente` des compléments).
    api<OuvertureCveDto>('POST', urlOuverture(cve))
      .then((r) => {
        setOuverture(r.tenable);
        return qc.invalidateQueries({ queryKey: ['vulnerabilites', 'cve-complements', cve] });
      })
      .catch(() => setOuverture('echec'));
  }, [q.data, cve, qc]);
  const consulter = async () => {
    setEnvoi(true);
    setErreur(null);
    try {
      await api('POST', urlConsultation(cve));
      debut.current = Date.now();
    } catch (e) {
      setErreur(errorMessage(e));
    } finally {
      await qc.invalidateQueries({ queryKey: ['vulnerabilites', 'cve-complements', cve] });
      // La CVE devenue connue de la veille (réponse de NVD rangée) : sa fiche habituelle se relit.
      await qc.invalidateQueries({ queryKey: ['vulnerabilites', 'fiche-faille', 'cve', cve] });
      setEnvoi(false);
    }
  };
  if (q.error) return <ErrorAlert error={q.error} />;
  if (!q.data)
    return (
      <Group>
        <Loader size="sm" />
        <Text size="sm">Chargement de la fiche…</Text>
      </Group>
    );
  return (
    <FicheCveInconnueVue
      c={q.data}
      envoi={envoi}
      erreur={erreur}
      ouverture={ouverture}
      onConsulter={() => void consulter()}
    />
  );
}
