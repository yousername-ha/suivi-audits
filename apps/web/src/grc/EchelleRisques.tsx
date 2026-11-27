/* Échelle des risques de la méthode d'appréciation du périmètre (décision 2 du RSSI, 27/11/2026) : niveaux, couleurs et
   libellés viennent de la méthode publiée et choisie pour le périmètre, jamais d'une échelle codée en dur. Les couleurs
   sont des données : la CSP interdit les styles en ligne, elles passent donc par des attributs SVG (fill). */
import type { RiskMethod } from '@suivi/shared';
import { libelleAcceptabilite } from '@suivi/shared';
import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { get } from '../api';
import { legendeMethode, segmentsRepartition, type NiveauMethode } from './gestion-risques';
import type { MethodVersion } from './Risks';

/** Méthode d'appréciation du périmètre : la version choisie pour le périmètre ; à défaut de choix, la seule méthode publiée
    du périmètre (dernière version). Plusieurs méthodes publiées sans choix, ou aucune : null (rien n'est deviné). */
export function useMethodePerimetre(smsi: string): { methode: RiskMethod | null; chargement: boolean } {
  const perimetres = useQuery({
    queryKey: ['grc', 'smsis'],
    queryFn: () =>
      get<{ id: string; riskMethodId: string | null; riskMethodVersion: number | null }[]>('/api/grc/smsis'),
  });
  const choix = perimetres.data?.find((s) => s.id === smsi);
  const versions = useQuery({
    queryKey: ['grc', smsi, 'method-version', choix?.riskMethodId],
    queryFn: () => get<MethodVersion[]>(`/api/grc/${smsi}/methods/${choix!.riskMethodId}/history`),
    enabled: !!choix?.riskMethodId,
  });
  const publiees = useQuery({
    queryKey: ['grc', smsi, 'methods'],
    queryFn: () => get<MethodVersion[]>(`/api/grc/${smsi}/methods`),
    enabled: !!perimetres.data && !choix?.riskMethodId,
  });
  const methode = choix?.riskMethodId
    ? (versions.data?.find((m) => m.version === choix.riskMethodVersion)?.definition ?? null)
    : publiees.data?.length === 1
      ? publiees.data[0]!.definition
      : null;
  return {
    methode,
    chargement: perimetres.isPending || (choix?.riskMethodId ? versions.isPending : publiees.isPending),
  };
}

/** Pastille de couleur d'un niveau (disque SVG rempli de la couleur publiée). */
export function Pastille({ couleur, className = 'ris-pastille' }: { couleur: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 10 10" aria-hidden="true" focusable="false">
      <circle cx="5" cy="5" r="5" fill={couleur} />
    </svg>
  );
}

/** Niveau de risque en gélule : pastille de la couleur de la méthode, libellé ; teinte de la gélule selon
    l'acceptabilité du niveau. Libellé absent de la méthode : gélule neutre, libellé tel qu'enregistré. */
export function NiveauRisque({
  libelle,
  niveau,
  vide = '—',
  children,
}: {
  libelle: string | null;
  niveau: NiveauMethode | null;
  vide?: string;
  children?: ReactNode;
}) {
  if (!libelle) return <span className="ris-niveau ris-niveau--vide">{vide}</span>;
  return (
    <span className="ris-niveau" data-acceptabilite={niveau?.acceptability ?? 'inconnue'}>
      {niveau && <Pastille couleur={niveau.color} />}
      <span className="ris-niveau__libelle">{libelle}</span>
      {children}
    </span>
  );
}

/** Barre de répartition (segments de la couleur de chaque niveau), décorative : les nombres sont écrits à côté. */
export function BarreRepartition({
  parts,
  className = 'ris-barre',
}: {
  parts: readonly { id: string; color: string; nombre: number }[];
  className?: string;
}) {
  const segments = segmentsRepartition(parts);
  return (
    <svg className={className} viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <rect className="ris-barre__fond" width="100" height="10" rx="2" />
      {segments.map((s) => (
        <rect key={s.id} x={s.x} width={Math.max(s.largeur - 0.6, 0.4)} height="10" rx="2" fill={s.color} />
      ))}
    </svg>
  );
}

/** Légende de l'échelle de la méthode : formule, niveaux avec couleur et plage de score, seuil d'acceptation. */
export function LegendeEchelle({ methode, compacte }: { methode: RiskMethod; compacte?: boolean }) {
  const l = legendeMethode(methode);
  return (
    <div className="ris-legende" data-compacte={compacte ? 'oui' : undefined}>
      <p className="ris-legende__formule">{l.formule}</p>
      <ul className="ris-legende__niveaux" aria-label="Niveaux de risque de la méthode">
        {l.niveaux.map((n) => (
          <li key={n.id}>
            <Pastille couleur={n.color} />
            <span className="ris-legende__libelle">{n.label}</span>
            {n.plage && <span className="ris-legende__plage chiffres">{n.plage}</span>}
          </li>
        ))}
      </ul>
      <p className="ris-legende__seuil">
        {l.acceptabilite.map((g) => `${libelleAcceptabilite(g.acceptabilite)} : ${g.niveaux.join(', ')}`).join(' · ')}
      </p>
    </div>
  );
}

/** Tuile chiffrée en tête d'écran (verre liquide dans le style « Verre »). */
export function TuileChiffre({
  titre,
  valeur,
  sur,
  detail,
  ton,
  illustration,
}: {
  titre: string;
  valeur: ReactNode;
  /** Total auquel la valeur se rapporte (« / 24 »). */
  sur?: number;
  detail?: ReactNode;
  ton?: 'alerte' | 'danger' | 'seuil' | 'avance' | 'succes';
  illustration?: ReactNode;
}) {
  return (
    <section className="ris-tuile" data-ton={ton}>
      <div className="ris-tuile__corps">
        <h2 className="ris-tuile__titre">{titre}</h2>
        <p className="ris-tuile__valeur chiffres">
          <span className="ris-tuile__nombre">{valeur}</span>
          {sur !== undefined && <span className="ris-tuile__sur"> / {sur}</span>}
        </p>
        {detail && <p className="ris-tuile__detail">{detail}</p>}
      </div>
      {illustration}
    </section>
  );
}
