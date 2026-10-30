/* Préparation d'une revue de direction (ISO 9001:2015, 9.3.2) : faits chiffrés tirés des données de la plateforme, repris
   dans une nouvelle fiche de revue. Rien n'est interprété : la direction apprécie, conclut et décide (9.3.3).
   Les entrées sont regroupées en trois temps de lecture et affichées d'emblée, chiffres mis en évidence. */
import { Badge, Button, Card, Text, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { cleEntree, type EntreeRevue } from '@suivi/shared';
import { StatusChip } from '@suivi/ui';
import { get } from '../api';
import { ErrorAlert } from '../components/common';
import { useCan } from '../session';

const SOCLE = '00000000-0000-4000-8000-000000000001';

/** Trois temps de lecture, dans l'ordre de 9.3.2 (a et b, puis c, puis d à f). */
const TEMPS: readonly { titre: string; resume: string; ids: readonly string[] }[] = [
  {
    titre: 'Suites et contexte',
    resume: 'Ce qui a été décidé la dernière fois, et ce qui a changé autour de l’organisation.',
    ids: ['a', 'b'],
  },
  {
    titre: 'Performance et efficacité',
    resume: 'Clients, objectifs, processus, écarts, mesures, audits et prestataires.',
    ids: ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7'],
  },
  {
    titre: 'Ressources, risques et amélioration',
    resume: 'Les moyens, les risques et opportunités, et les pistes de progrès.',
    ids: ['d', 'e', 'f'],
  },
];

/** Dates et nombres d'un fait (hors identifiants comme IND-001) : mis en évidence sans rien recalculer. */
const CHIFFRE = /(?<![\p{L}\d-])(\d{2}\/\d{2}\/\d{4}|\d+(?:[.,]\d+)?(?:\/\d+)?(?:\s?%)?)(?![\p{L}\d-])/u;
function Fait({ texte }: { texte: string }) {
  return (
    <li>
      {texte.split(CHIFFRE).map((morceau, i) =>
        i % 2 ? (
          <strong key={i} className="revue-chiffre chiffres">
            {morceau}
          </strong>
        ) : (
          morceau
        ),
      )}
    </li>
  );
}

function CarteEntree({ entree }: { entree: EntreeRevue }) {
  return (
    <Card
      withBorder
      component="article"
      className="revue-entree"
      data-etat={entree.aSaisir ? 'a-saisir' : 'faits'}
      aria-label={entree.titre}
    >
      <div className="revue-entree__tete">
        <Badge variant="light" size="sm" className="revue-entree__article">
          {entree.article}
        </Badge>
        {entree.aSaisir && <StatusChip etat="attention">À apprécier par la direction</StatusChip>}
      </div>
      <Text fw={600} className="revue-entree__titre">
        {entree.titre}
      </Text>
      {entree.faits.length > 0 && (
        <ul className="revue-faits">
          {entree.faits.map((f) => (
            <Fait key={f} texte={f} />
          ))}
        </ul>
      )}
    </Card>
  );
}

export function PreparationRevue({
  smsi,
  onCreer,
}: {
  smsi: string;
  onCreer: (initial: Record<string, unknown>) => void;
}) {
  const can = useCan();
  const q = useQuery({
    queryKey: ['grc', smsi, 'revue-entrees'],
    queryFn: () =>
      get<{ precedente: { id: string; date: string } | null; entrees: EntreeRevue[] }>(
        `/api/grc/${smsi}/pilotage/revue/entrees`,
      ),
    enabled: smsi === SOCLE,
    retry: false,
  });
  if (smsi !== SOCLE) return null;
  const entrees = q.data?.entrees ?? [];
  const precedente = q.data?.precedente;
  const aApprecier = entrees.filter((e) => e.aSaisir).length;
  const creer = () =>
    onCreer(
      Object.fromEntries(entrees.filter((e) => e.faits.length).map((e) => [cleEntree(e.id), e.faits.join('\n')])),
    );
  return (
    <section className="revue-preparation" aria-label="Entrées de la revue de direction">
      <Card withBorder className="revue-synthese">
        <div className="revue-synthese__texte">
          <Title order={2} className="revue-synthese__titre">
            Préparer la prochaine revue
          </Title>
          <Text size="sm" c="dimmed">
            Les entrées (ISO 9001:2015, 9.3.2) sont des faits tirés de vos données, sans interprétation : une donnée
            absente est signalée telle quelle. La direction apprécie, conclut et décide ; les sorties (9.3.3) se
            saisissent dans la fiche de revue.
          </Text>
        </div>
        {q.data && (
          <dl className="revue-reperes">
            <div>
              <dt>Dernière revue</dt>
              <dd className="chiffres">{precedente ? precedente.date.split('-').reverse().join('/') : 'Aucune'}</dd>
            </div>
            <div>
              <dt>Entrées préparées</dt>
              <dd className="chiffres">{entrees.length}</dd>
            </div>
            <div data-attention={aApprecier ? 'oui' : undefined}>
              <dt>À apprécier</dt>
              <dd className="chiffres">{aApprecier}</dd>
            </div>
          </dl>
        )}
        {can('pilotage', 'modifier') && entrees.length > 0 && (
          <Button onClick={creer} className="revue-synthese__action">
            Préparer une revue avec ces entrées
          </Button>
        )}
      </Card>
      <ErrorAlert error={q.error} />
      {entrees.length > 0 &&
        TEMPS.map((t, n) => {
          const cartes = entrees.filter((e) => t.ids.includes(e.id));
          if (!cartes.length) return null;
          return (
            <section key={t.titre} className="revue-temps" aria-labelledby={`revue-temps-${n}`}>
              <div className="revue-temps__tete">
                <span className="revue-temps__numero chiffres" aria-hidden="true">
                  {n + 1}
                </span>
                <div>
                  <Title order={3} id={`revue-temps-${n}`} className="revue-temps__titre">
                    {t.titre}
                  </Title>
                  <Text size="sm" c="dimmed">
                    {t.resume}
                  </Text>
                </div>
              </div>
              <div className="revue-entrees">
                {cartes.map((e) => (
                  <CarteEntree key={e.id} entree={e} />
                ))}
              </div>
            </section>
          );
        })}
    </section>
  );
}
