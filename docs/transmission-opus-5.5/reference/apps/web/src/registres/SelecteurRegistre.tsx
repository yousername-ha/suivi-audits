/* Registre d'un élément (actions, écarts, séries) : à la création on choisit le registre d'accueil parmi ceux que l'on gère
   pour ce périmètre (sinon le registre par défaut le reçoit) ; sur une fiche existante on le lit, avec les périmètres qu'il
   porte et dont l'élément hérite. Le déplacement entre registres garde sa commande propre. Aucun sélecteur de périmètre
   indépendant : l'élément n'a pas de périmètre à lui. */
import { Anchor, Select, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { REGISTRE_LABELS, registreKindOf, type GrcKind, type GrcObject, type RegistreDto } from '@suivi/shared';
import { get } from '../api';

const AUTOMATIQUE = '__defaut__';

export function SelecteurRegistre({
  smsi,
  kind,
  data,
  object,
  value,
  onChange,
  disabled,
}: {
  smsi: string;
  kind: GrcKind;
  data: Record<string, unknown>;
  object: GrcObject | null;
  /** Registre choisi à la création ; null : registre par défaut du périmètre. */
  value: string | null;
  onChange: (registreId: string | null) => void;
  disabled?: boolean;
}) {
  const famille = registreKindOf(kind, data);
  const existant = !!object && !object.id.startsWith('legacy:') && !!object.registreId;
  const liste = useQuery({
    queryKey: ['registres', 'selecteur', famille],
    queryFn: () => get<{ items: RegistreDto[] }>(`/api/registres?kind=${famille}`),
    enabled: !!famille,
  });
  if (!famille || (object && object.id.startsWith('legacy:'))) return null;
  const registres = liste.data?.items ?? [];
  if (existant) {
    const r = registres.find((x) => x.id === object!.registreId);
    return (
      <Text size="sm" data-testid="registre-de-l-element">
        {REGISTRE_LABELS[famille]} :{' '}
        {r ? (
          <Anchor component={Link} to={`/registres/${r.id}`}>
            {r.name}
          </Anchor>
        ) : (
          'registre non accessible'
        )}
        {r && r.perimetres.length > 0 && <> · périmètres hérités : {r.perimetres.map((p) => p.name).join(', ')}</>}
        {r && r.autresPerimetres > 0 && <> (+ {r.autresPerimetres} autre(s))</>}
      </Text>
    );
  }
  const choix = registres.filter((r) => r.referenceId === smsi && !r.archived && r.peut.gerer);
  return (
    <Select
      label={`${REGISTRE_LABELS[famille]} d’accueil`}
      description="Le registre porte les périmètres dont la fiche hérite ; à défaut, le registre par défaut du périmètre la reçoit. Un nouveau registre se crée depuis la page Registres."
      allowDeselect={false}
      data={[
        { value: AUTOMATIQUE, label: 'Registre par défaut du périmètre' },
        ...choix.map((r) => ({ value: r.id, label: r.name })),
      ]}
      value={value ?? AUTOMATIQUE}
      onChange={(v) => onChange(!v || v === AUTOMATIQUE ? null : v)}
      disabled={disabled}
    />
  );
}
