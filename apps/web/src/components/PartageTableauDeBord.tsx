/* Partage de son tableau de bord (ADR 0078, lot 2b), en lecture, avec des personnes ou des groupes : seule la disposition
   est transmise ; chaque destinataire voit les dalles avec ses propres droits. Réservé au droit tableau_de_bord:modifier,
   journalisé côté serveur. La liste complète des destinataires est enregistrée d'un coup (If-Match : version du tableau). */
import { Button, Group, MultiSelect, Text } from '@mantine/core';
import type { AnnuaireTableauDeBord, DestinatairePartage, PartageOut } from '@suivi/shared';
import { ErrorAlert } from '@suivi/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, get } from '../api';
import { CLE_DISPOSITION } from './DispositionTableauDeBord';

const URL_PARTAGE = '/api/tableau-de-bord/partage';
const CLE_PARTAGE = ['tableau-de-bord', 'partage'] as const;
const SANS_PORTAIL = { withinPortal: false } as const;

const valeur = (d: DestinatairePartage) => `${d.type}:${d.id}`;
const destinataire = (v: string): DestinatairePartage => {
  const [type, id] = v.split(':') as [DestinatairePartage['type'], string];
  return { type, id };
};

function options(a: AnnuaireTableauDeBord, actuels: PartageOut['destinataires']) {
  const groupes = a.groupes.map((g) => ({
    value: `groupe:${g.id}`,
    label: `${g.nom} (${g.membres} membre${g.membres > 1 ? 's' : ''})`,
  }));
  const personnes = a.utilisateurs.map((u) => ({
    value: `utilisateur:${u.id}`,
    label: u.nom === u.identifiant ? u.nom : `${u.nom} (${u.identifiant})`,
  }));
  // Un destinataire désactivé depuis le partage reste affiché pour pouvoir être retiré.
  const connus = new Set([...groupes, ...personnes].map((o) => o.value));
  const anciens = actuels.filter((d) => !connus.has(valeur(d))).map((d) => ({ value: valeur(d), label: d.nom }));
  return [
    { group: 'Groupes', items: groupes },
    { group: 'Personnes', items: [...personnes, ...anciens] },
  ].filter((g) => g.items.length);
}

export function PartageTableauDeBord({ onFin }: { onFin: () => void }) {
  const qc = useQueryClient();
  const partage = useQuery({ queryKey: CLE_PARTAGE, queryFn: () => get<PartageOut>(URL_PARTAGE) });
  const annuaire = useQuery({
    queryKey: ['tableau-de-bord', 'annuaire'],
    queryFn: () => get<AnnuaireTableauDeBord>('/api/tableau-de-bord/annuaire'),
  });
  const [choisis, setChoisis] = useState<string[] | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const actuels = partage.data?.destinataires.map(valeur) ?? [];
  const valeurs = choisis ?? actuels;
  const modifie = choisis !== null && (choisis.length !== actuels.length || choisis.some((v) => !actuels.includes(v)));

  async function valider() {
    setPending(true);
    setError(null);
    try {
      await api('PUT', URL_PARTAGE, {
        body: { destinataires: valeurs.map(destinataire) },
        ifMatch: partage.data!.version,
      });
      await Promise.all([
        qc.invalidateQueries({ queryKey: CLE_PARTAGE }),
        qc.invalidateQueries({ queryKey: CLE_DISPOSITION }),
      ]);
      onFin();
    } catch (e) {
      setError(e);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="tdb-edition-barre" role="region" aria-label="Partager mon tableau de bord">
      <Text size="sm">
        Les personnes et les groupes choisis pourront afficher votre disposition, en lecture, et la copier comme la
        leur. Seuls l’ordre, les largeurs et les dalles masquées sont partagés : chacun voit les chiffres avec ses
        propres droits.
      </Text>
      <ErrorAlert error={partage.error ?? annuaire.error ?? error} />
      {partage.data && annuaire.data && (
        <MultiSelect
          label="Partager avec"
          placeholder={valeurs.length ? undefined : 'Rechercher une personne ou un groupe'}
          searchable
          clearable
          comboboxProps={SANS_PORTAIL}
          nothingFoundMessage="Aucune personne ni aucun groupe"
          data={options(annuaire.data, partage.data.destinataires)}
          value={valeurs}
          onChange={setChoisis}
        />
      )}
      <Group gap="xs">
        <Button disabled={!modifie || pending || !partage.data} loading={pending} onClick={() => void valider()}>
          Enregistrer le partage
        </Button>
        <Button variant="default" disabled={pending} onClick={onFin}>
          Fermer
        </Button>
      </Group>
    </div>
  );
}
