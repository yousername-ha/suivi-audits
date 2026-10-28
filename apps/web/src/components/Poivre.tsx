/* Poivre des mots de passe (ADR 0072) : saisie (générer ou saisir, engagement de sauvegarde au coffre-fort) et panneau
   d'administration (définir sur une installation existante, changer avec l'ancien poivre et un code de double authentification).
   Le poivre n'est gardé qu'en mémoire du composant : jamais dans l'adresse, le stockage du navigateur ni une requête de lecture. */
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Code,
  CopyButton,
  Group,
  PasswordInput,
  Radio,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { formaterPoivreGenere, genererPoivre, type PoivreAEnregistrer, type PoivreEtat } from '@suivi/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { api, get } from '../api';
import { bilanPoivre } from '../poivre';
import { ErrorAlert } from './common';

export const CLE_POIVRE = ['admin', 'poivre'] as const;

/** État du poivre, lu seulement par qui peut administrer. */
export function useEtatPoivre(actif: boolean) {
  return useQuery({ queryKey: CLE_POIVRE, queryFn: () => get<PoivreEtat>('/api/admin/poivre'), enabled: actif });
}

interface SaisieProps {
  /** Textes que le poivre ne doit pas contenir (le serveur ajoute l'organisation et tous les identifiants). */
  interdits?: string[];
  /** Poivre actuel : le nouveau doit être différent. */
  ancien?: string;
  /** Appelé à chaque changement : le corps à envoyer, ou null tant que tout n'est pas satisfait. */
  onChange: (p: PoivreAEnregistrer | null) => void;
}

export function SaisiePoivre({ interdits, ancien, onChange }: SaisieProps) {
  const [mode, setMode] = useState<'genere' | 'saisi'>('genere');
  const [brut, setBrut] = useState(() => genererPoivre());
  const [saisie, setSaisie] = useState('');
  const [coffre, setCoffre] = useState(false);
  const [fin, setFin] = useState('');
  const valeur = mode === 'genere' ? formaterPoivreGenere(brut) : saisie;
  const bilan = useMemo(
    () => bilanPoivre({ mode, valeur, coffre, fin }, { interdits, ancien }),
    [mode, valeur, coffre, fin, interdits, ancien],
  );
  const pret = bilan.pret;
  useEffect(() => onChange(pret), [pret, onChange]);

  return (
    <Stack gap="sm">
      <Radio.Group
        label="Poivre"
        value={mode}
        onChange={(v) => {
          setMode(v as 'genere' | 'saisi');
          setFin('');
        }}
      >
        <Stack gap="xs" mt="xs">
          <Radio value="genere" label="Générer un poivre (recommandé)" />
          <Radio value="saisi" label="Saisir le mien" />
        </Stack>
      </Radio.Group>
      {mode === 'genere' ? (
        <Stack gap="xs">
          <Code block fz="md" aria-label="Poivre généré" data-testid="poivre-genere">
            {valeur}
          </Code>
          <Group gap="xs">
            <CopyButton value={valeur}>
              {({ copied, copy }) => (
                <Button variant="default" size="xs" onClick={copy}>
                  {copied ? 'Copié' : 'Copier'}
                </Button>
              )}
            </CopyButton>
            <Button
              variant="default"
              size="xs"
              onClick={() => {
                setBrut(genererPoivre());
                setFin('');
              }}
            >
              Générer un autre poivre
            </Button>
          </Group>
        </Stack>
      ) : (
        <Stack gap="xs">
          <PasswordInput
            label="Votre poivre"
            description="32 à 256 caractères, ou une phrase d’au moins 6 mots. Il ne sera plus jamais affiché."
            autoComplete="off"
            value={saisie}
            onChange={(e) => {
              setSaisie(e.currentTarget.value);
              setFin('');
            }}
          />
          {saisie !== '' && (
            <Stack gap="xs" aria-live="polite">
              <Text size="sm" c={bilan.problemes.length ? 'red' : 'green'}>
                Entropie estimée : {bilan.entropie} bits (128 au minimum).
              </Text>
              {bilan.problemes.map((p) => (
                <Text key={p} size="sm" c="red">
                  {p}
                </Text>
              ))}
            </Stack>
          )}
        </Stack>
      )}
      <Alert color="orange" title="À conserver au coffre-fort" role="note">
        Ce poivre protège toutes les empreintes de mots de passe. Il est demandé pour le changer, et il permet de
        reprendre l’activité si la clé maîtresse est perdue. Enregistrez-le maintenant dans le coffre-fort de
        l’organisation : il ne pourra pas être relu.
      </Alert>
      <Checkbox
        label="J’ai enregistré ce poivre dans le coffre-fort de l’organisation"
        checked={coffre}
        onChange={(e) => setCoffre(e.currentTarget.checked)}
      />
      <TextInput
        label="Les 8 derniers caractères du poivre"
        description="Recopiez-les depuis le coffre-fort pour prouver l’enregistrement."
        autoComplete="off"
        spellCheck={false}
        maxLength={40}
        value={fin}
        onChange={(e) => setFin(e.currentTarget.value)}
        error={fin !== '' && !bilan.finOk ? 'Ne correspond pas à la fin du poivre.' : undefined}
      />
    </Stack>
  );
}

/** Panneau de l'administration : définir (installation existante) ou changer le poivre. */
export function PoivrePanel() {
  const qc = useQueryClient();
  const q = useEtatPoivre(true);
  const etat = q.data;
  const [poivre, setPoivre] = useState<PoivreAEnregistrer | null>(null);
  const [ancien, setAncien] = useState('');
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [fait, setFait] = useState(false);
  // Le nouveau saisie se réinitialise après chaque réussite : on change la clé du composant.
  const [cle, setCle] = useState(0);
  const interdits = useMemo(() => [] as string[], []);

  if (!etat) return <ErrorAlert error={q.error} />;
  const defini = etat.defini;
  const pret = !!poivre && /^\d{6}$/.test(code) && (!defini || ancien !== '');

  async function envoyer() {
    if (!poivre) return;
    setPending(true);
    setError(null);
    setFait(false);
    try {
      const url = defini ? '/api/admin/poivre/changer' : '/api/admin/poivre/definir';
      const body = defini ? { poivre, ancienPoivre: ancien, code } : { poivre, code };
      qc.setQueryData(CLE_POIVRE, await api<PoivreEtat>('POST', url, { body }));
      setFait(true);
      setPoivre(null);
      setAncien('');
      setCle((n) => n + 1);
    } catch (e) {
      setError(e);
    } finally {
      // Un code est à usage unique : toujours en saisir un nouveau.
      setCode('');
      setPending(false);
    }
  }

  return (
    <Card withBorder padding="md" aria-labelledby="poivre-titre">
      <Stack gap="sm">
        <Group justify="space-between">
          <Title order={3} id="poivre-titre">
            Poivre des mots de passe
          </Title>
          <Badge color={defini ? 'green' : 'red'} variant="light">
            {defini ? 'Défini' : 'Non défini'}
          </Badge>
        </Group>
        <Text size="sm">
          Le poivre est un secret, gardé au coffre-fort de l’organisation, qui chiffre les empreintes de mots de passe :
          une copie de la base ne suffit pas à tenter de les retrouver.{' '}
          {defini
            ? `Clé ${etat.idCle}, définie le ${etat.definiLe ? new Date(etat.definiLe).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }) : '—'} ; ${etat.empreintesPoivrees} empreinte(s) sur ${etat.comptes} protégée(s).`
            : 'Il n’est pas encore défini : les mots de passe restent protégés par le seul hachage. Définissez-le maintenant.'}
        </Text>
        <ErrorAlert error={error} />
        {fait && (
          <Alert color="green" role="status">
            {defini ? 'Poivre enregistré.' : 'Poivre défini.'} Toutes les empreintes sont protégées ; les mots de passe
            des comptes n’ont pas changé et les sessions ouvertes restent actives.
          </Alert>
        )}
        {defini && (
          <PasswordInput
            label="Ancien poivre"
            description="Le poivre actuel, tel que conservé au coffre-fort."
            autoComplete="off"
            value={ancien}
            onChange={(e) => setAncien(e.currentTarget.value)}
          />
        )}
        <SaisiePoivre key={cle} interdits={interdits} ancien={defini ? ancien : undefined} onChange={setPoivre} />
        <TextInput
          label="Code de double authentification"
          value={code}
          inputMode="numeric"
          autoComplete="one-time-code"
          onChange={(e) => setCode(e.currentTarget.value.replace(/\D/g, '').slice(0, 6))}
        />
        <Group>
          <Button disabled={!pret || pending} loading={pending} onClick={() => void envoyer()}>
            {defini ? 'Changer le poivre' : 'Définir le poivre'}
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}
