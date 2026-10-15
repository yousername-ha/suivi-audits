/* Cycle d'audit (réglages de l'outil de suivi) : prochain audit, dates, années du cycle et leurs libellés. Une année
   se commence mais ne se retire pas (l'historique de couverture est conservé). */
import { Button, Group, Modal, Select, Stack, TextInput } from '@mantine/core';
import { useState } from 'react';
import { ErrorAlert } from '../components/common';
import { libelleAnnee, useActionAudit, type DonneesAudit } from './commun';

export function CycleAudit({
  d,
  ouvert,
  modifiable,
  onClose,
}: {
  d: DonneesAudit;
  ouvert: boolean;
  modifiable: boolean;
  onClose: () => void;
}) {
  const agir = useActionAudit();
  const [prochain, setProchain] = useState(String(d.nextYear));
  const [dates, setDates] = useState({
    nextDate: d.nextDate,
    internalDate: d.internalDate,
    closeDeadline: d.closeDeadline,
  });
  const [annees, setAnnees] = useState(d.years);
  const [libelles, setLibelles] = useState<Record<string, string>>(
    Object.fromEntries(d.years.map((y) => [String(y), libelleAnnee(d, y)])),
  );
  const [erreur, setErreur] = useState<unknown>(null);
  const suivante = (annees.length ? Math.max(...annees) : new Date().getFullYear() - 1) + 1;
  const enregistrer = async () => {
    try {
      setErreur(null);
      await agir('PATCH', '/cycle', {
        years: annees,
        nextYear: Number(prochain),
        ...dates,
        yearLabels: Object.fromEntries(Object.entries(libelles).filter(([k]) => annees.includes(Number(k)))),
      });
      onClose();
    } catch (e) {
      setErreur(e);
    }
  };
  return (
    <Modal opened={ouvert} onClose={onClose} title="Cycle d’audit" lockScroll={false}>
      <Stack>
        <ErrorAlert error={erreur} />
        <Select
          label="Prochain audit AFNOR"
          allowDeselect={false}
          disabled={!modifiable}
          data={annees.map((y) => ({
            value: String(y),
            label: libelles[String(y)] ? `${y}, ${libelles[String(y)]}` : String(y),
          }))}
          value={prochain}
          onChange={(v) => v && setProchain(v)}
        />
        <TextInput
          label="Date de l’audit AFNOR"
          type="date"
          disabled={!modifiable}
          value={dates.nextDate}
          onChange={(e) => setDates({ ...dates, nextDate: e.currentTarget.value })}
        />
        <TextInput
          label="Date de l’audit interne"
          type="date"
          disabled={!modifiable}
          value={dates.internalDate}
          onChange={(e) => setDates({ ...dates, internalDate: e.currentTarget.value })}
        />
        <TextInput
          label="Échéance de clôture des écarts"
          type="date"
          disabled={!modifiable}
          value={dates.closeDeadline}
          onChange={(e) => setDates({ ...dates, closeDeadline: e.currentTarget.value })}
        />
        {annees.map((y) => (
          <TextInput
            key={y}
            label={`Libellé de ${y}`}
            disabled={!modifiable}
            value={libelles[String(y)] ?? ''}
            onChange={(e) => setLibelles({ ...libelles, [String(y)]: e.currentTarget.value })}
          />
        ))}
        {modifiable && (
          <Button variant="default" onClick={() => setAnnees([...annees, suivante])}>
            Ajouter {suivante}
          </Button>
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Fermer
          </Button>
          {modifiable && <Button onClick={() => void enregistrer()}>Enregistrer</Button>}
        </Group>
      </Stack>
    </Modal>
  );
}
