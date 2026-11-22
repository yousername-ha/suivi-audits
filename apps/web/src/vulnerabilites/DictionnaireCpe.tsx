/* Module Vulnérabilités (ADR 0100, lot CPE-1) : source « Dictionnaire des produits (CPE) » dans l'écran de la veille, à côté
   des autres sources : explication de la place, état (désactivée, chargement en cours n / N, à jour, en erreur), dernière
   mise à jour, fréquence des nouveautés, activation ; copie complète facultative et sa suppression. Réglages pour qui
   administre le module (affichage seulement : le serveur reste seul juge, If-Match). Composants de la charte, sous la CSP
   stricte (ADR 0006). Sans état React : rendu testable hors navigateur. */
import { Button, Group, Stack, Text, Title } from '@mantine/core';
import {
  EXPLICATION_COPIE_COMPLETE,
  EXPLICATION_LISTE_PRODUITS,
  type EtatDictionnaireCpeDto,
  FREQUENCES_DICTIONNAIRE_CPE,
  libelleFrequence,
  type ReglageDictionnaireCpe,
} from '@suivi/shared';
import { ConfirmButton, StatusChip } from '@suivi/ui';
import { fmtDate } from '../components/common';
import { ChampFrequence } from '../components/ChampFrequence';
import { etatDictionnaireCpe } from './dictionnaire-cpe';

export function DictionnaireCpeSection({
  etat,
  peutRegler,
  envoi,
  onReglage,
  onCopier,
  onSupprimerCopie,
}: {
  etat: EtatDictionnaireCpeDto;
  /** Droit d'administrer le module. */
  peutRegler: boolean;
  envoi: boolean;
  onReglage: (r: ReglageDictionnaireCpe) => void;
  onCopier: () => void;
  onSupprimerCopie: () => void;
}) {
  const e = etatDictionnaireCpe(etat);
  const nb = (x: number) => x.toLocaleString('fr-FR');
  return (
    <Stack gap="xs" role="group" aria-label="Dictionnaire des produits (CPE)">
      <Group justify="space-between">
        <Title order={2} size="h4">
          {etat.source.libelle}
        </Title>
        <StatusChip etat={e.etat}>{e.libelle}</StatusChip>
      </Group>
      <Text size="sm">{EXPLICATION_LISTE_PRODUITS}</Text>
      <Text size="xs" c="dimmed">
        {etat.source.organisme} · <span className="veille-code">{etat.source.hote}</span> · {etat.source.format} ·{' '}
        {etat.source.demande}
      </Text>
      <Text size="sm">
        {nb(etat.produits)} produit{etat.produits > 1 ? 's' : ''} dans la liste locale.{' '}
        {etat.derniereMiseAJour ? (
          <>
            À jour jusqu’au <span className="horodatage">{fmtDate(etat.derniereMiseAJour)}</span>.
          </>
        ) : (
          'Jamais chargée.'
        )}{' '}
        {etat.prochaineMiseAJour && (
          <>
            Prochaines nouveautés : <span className="horodatage">{fmtDate(etat.prochaineMiseAJour)}</span>.
          </>
        )}
      </Text>
      {etat.erreur && (
        <Text size="xs" c="red" className="veille-texte">
          {etat.erreur}
        </Text>
      )}
      {etat.activee && !etat.flux.ouvert && (
        <Text size="sm" c="dimmed">
          La veille est inactive : rien n’est chargé ni demandé à la NVD tant que son flux est fermé.
        </Text>
      )}
      {peutRegler ? (
        <Group align="flex-end">
          {etat.activee ? (
            <ConfirmButton
              variant="default"
              disabled={envoi}
              message="Désactiver la source ? Le chargement s’arrête et plus aucune version n’est demandée à la NVD ; la liste déjà chargée reste utilisable."
              onConfirm={() => onReglage({ activee: false })}
            >
              Désactiver la source
            </ConfirmButton>
          ) : (
            <Button loading={envoi} onClick={() => onReglage({ activee: true })}>
              Activer la source
            </Button>
          )}
          <ChampFrequence
            size="xs"
            label="Lecture des nouveautés"
            frequences={FREQUENCES_DICTIONNAIRE_CPE}
            valeur={etat.frequenceHeures}
            disabled={envoi}
            avertissement={null}
            onChange={(h) => onReglage({ frequenceHeures: h })}
          />
        </Group>
      ) : (
        <Text size="sm" c="dimmed">
          {etat.activee
            ? `Nouveautés : ${libelleFrequence(etat.frequenceHeures).toLowerCase()}.`
            : 'Source désactivée.'}{' '}
          Seule une personne qui administre le module la règle.
        </Text>
      )}
      <Title order={3} size="h5">
        Copie complète du dictionnaire (facultative)
      </Title>
      <Text size="sm">{EXPLICATION_COPIE_COMPLETE}</Text>
      <Text size="sm">
        {etat.copie.complete
          ? `Copie complète faite (environ ${nb(etat.copie.versions)} versions) : les versions viennent de la base locale.`
          : etat.copie.voulue
            ? 'Copie complète demandée : chargement par lots en cours ; les versions sont demandées à la NVD en attendant.'
            : 'Pas de copie complète : les versions d’un produit choisi sont demandées à la NVD.'}
        {etat.copie.completeLe && (
          <>
            {' '}
            Terminée le <span className="horodatage">{fmtDate(etat.copie.completeLe)}</span>.
          </>
        )}
      </Text>
      {peutRegler && (
        <Group>
          {etat.copie.voulue ? (
            <ConfirmButton
              variant="default"
              color="red"
              disabled={envoi}
              message="Supprimer la copie complète ? La place est libérée ; les versions seront de nouveau demandées à la NVD, produit par produit."
              onConfirm={onSupprimerCopie}
            >
              Supprimer la copie complète
            </ConfirmButton>
          ) : (
            <Button variant="default" loading={envoi} disabled={!etat.activee} onClick={onCopier}>
              Copier le dictionnaire complet
            </Button>
          )}
        </Group>
      )}
    </Stack>
  );
}
