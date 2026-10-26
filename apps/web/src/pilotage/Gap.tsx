/* Applications à intégrer au périmètre (reprise de « Applications à intégrer » de l'outil de suivi) : analyse d'écart
   par application avant son intégration au périmètre certifié ISO 27001 / HDS. Liste de contrôle issue des exigences de
   l'ISO/IEC 27001:2022 et du référentiel HDS ; les exigences HDS ne s'affichent que si l'application traite des DSCP.
   Données lues et écrites dans l'état historique (clé `appGaps`), sous verrou. */
import { Alert, Anchor, Badge, Button, Card, Group, Modal, Stack, Text } from '@mantine/core';
import { useState } from 'react';
import {
  NIVEAU_ETAT_GAP,
  QUALIFICATIONS_GAP,
  QUESTIONS_GAP,
  SECTIONS_GAP,
  STATUTS_GAP,
  ETATS_GAP,
  etatPointGap,
  pointsGap,
  questionnaireGap,
  questionnaireGapIa,
  questionsIaVisibles,
  statsGap,
  type AppGap,
  type EtatGap,
  type ReponsesGap,
} from '@suivi/shared';
import { ConfirmButton, DataTable, StatusChip, type Etat } from '@suivi/ui';
import { Table } from '@mantine/core';
import { ErrorAlert } from '../components/common';
import { ChampChoix, ChampTexte, ChampZone, useModule } from '../historique/champs';
import { useCan } from '../session';

interface Donnees {
  version: number;
  apps: AppGap[];
  fournisseurs: { id: string; name: string }[];
  exigences: { id: string; code: string; titre: string }[];
  exclues: string[];
  ecarts: Record<string, string>;
}
const ETAT: Record<'ok' | 'mid' | 'bad' | 'na', Etat> = { ok: 'succes', mid: 'attention', bad: 'erreur', na: 'neutre' };
const jour = (d: string) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? d.split('-').reverse().join('/') : '–');

export function GapApplications() {
  const can = useCan(),
    modifiable = can('conformite', 'modifier'),
    { d, agir, erreur } = useModule<Donnees>('gap', '/api/gap'),
    [fiche, setFiche] = useState<string | null>(null),
    [guide, setGuide] = useState<false | 'application' | 'ia'>(false);
  const exclues = new Set(d?.exclues ?? []);
  const ouverte = d?.apps.find((a) => a.id === fiche) ?? null;
  const actives = d?.apps.filter((a) => !['Intégrée', 'Écartée'].includes(a.status)) ?? [];
  return (
    <Stack>
      <ErrorAlert error={erreur} />
      <Group justify="space-between" align="flex-end">
        <div>
          <Text fw={600}>Applications à intégrer au périmètre</Text>
          <Text size="sm" c="dimmed">
            Analyse d’écart par application avant son intégration au périmètre certifié ISO 27001 / HDS. Points de
            contrôle issus des exigences de l’ISO/IEC 27001:2022 et du référentiel HDS ; les exigences HDS ne
            s’affichent que si l’application traite des DSCP.
          </Text>
        </div>
        {modifiable && (
          <Group>
            <Button
              variant="default"
              onClick={async () => {
                const a = await agir<AppGap>('POST', '/api/gap');
                if (a) setFiche(a.id);
              }}
            >
              Ajouter sans questionnaire
            </Button>
            <Button variant="default" onClick={() => setGuide('ia')}>
              Nouveau GAP IA
            </Button>
            <Button onClick={() => setGuide('application')}>Nouveau GAP guidé</Button>
          </Group>
        )}
      </Group>
      {d && !d.apps.length && (
        <Text size="sm">
          Aucune application. Lancez un nouveau GAP guidé : quelques questions sur l’outil ou le service suffisent pour
          générer la liste de contrôle ISO 27001 / HDS et le plan d’action.
        </Text>
      )}
      {d && d.apps.length > 0 && (
        <>
          <Group>
            {[
              [d.apps.length, `application${d.apps.length > 1 ? 's' : ''} suivie${d.apps.length > 1 ? 's' : ''}`],
              [actives.length, 'à étudier ou en cours'],
              [d.apps.filter((a) => a.status === 'Intégrée').length, 'intégrée(s)'],
              [
                `${actives.length ? Math.round(actives.reduce((m, a) => m + statsGap(a, exclues).pct, 0) / actives.length) : 0} %`,
                'avancement moyen',
              ],
            ].map(([n, l]) => (
              <Card key={String(l)} withBorder padding="xs">
                <Text fw={700} size="lg">
                  {n}
                </Text>
                <Text size="xs" c="dimmed">
                  {l}
                </Text>
              </Card>
            ))}
          </Group>
          <DataTable label="Applications à intégrer">
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Application</Table.Th>
                  <Table.Th>DSCP</Table.Th>
                  <Table.Th>Statut</Table.Th>
                  <Table.Th>Avancement</Table.Th>
                  <Table.Th>Points ouverts</Table.Th>
                  <Table.Th className="col-p2">Échéance</Table.Th>
                  <Table.Th className="col-p3">Responsable</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {d.apps.map((a) => {
                  const s = statsGap(a, exclues);
                  const sp = d.fournisseurs.find((f) => f.id === a.supplier);
                  return (
                    <Table.Tr key={a.id}>
                      <Table.Td>
                        <Anchor component="button" type="button" fw={600} onClick={() => setFiche(a.id)}>
                          {a.name || a.id}
                        </Anchor>
                        {a.modele === 'ia' && (
                          <Badge size="xs" variant="light" ml="xs">
                            GAP IA
                          </Badge>
                        )}
                        <Text size="xs" c="dimmed">
                          {[sp && sp.name !== a.name ? sp.name : '', a.desc].filter(Boolean).join(' — ').slice(0, 90)}
                        </Text>
                      </Table.Td>
                      <Table.Td>{a.dscp}</Table.Td>
                      <Table.Td>
                        <StatusChip
                          etat={a.status === 'Intégrée' ? 'succes' : a.status === 'En cours' ? 'attention' : 'neutre'}
                        >
                          {a.status}
                        </StatusChip>
                      </Table.Td>
                      <Table.Td>
                        <b>{s.pct} %</b>
                        <Text size="xs" c="dimmed">
                          {s.c.Conforme}/{s.applicables} conformes
                          {s.c['À évaluer'] ? `, ${s.c['À évaluer']} à évaluer` : ''}
                        </Text>
                      </Table.Td>
                      <Table.Td>{s.ouverts ? <StatusChip etat="erreur">{s.ouverts}</StatusChip> : '–'}</Table.Td>
                      <Table.Td className="col-p2">{jour(a.target)}</Table.Td>
                      <Table.Td className="col-p3">{a.owner || '–'}</Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </DataTable>
        </>
      )}
      <Modal
        opened={!!ouverte}
        onClose={() => setFiche(null)}
        size="xl"
        lockScroll={false}
        title={ouverte ? `${ouverte.id} — ${ouverte.name}` : ''}
      >
        {ouverte && d && (
          <FicheApplication app={ouverte} d={d} modifiable={modifiable} agir={agir} onSupprime={() => setFiche(null)} />
        )}
      </Modal>
      {guide && d && (
        <Modal
          opened
          onClose={() => setGuide(false)}
          size="xl"
          lockScroll={false}
          title={guide === 'ia' ? 'Nouveau GAP IA' : 'Nouveau GAP guidé'}
        >
          <GuideGap
            modele={guide}
            d={d}
            agir={agir}
            onDone={(id) => {
              setGuide(false);
              setFiche(id);
            }}
          />
        </Modal>
      )}
    </Stack>
  );
}

type Agir = <R>(methode: string, chemin: string, corps?: unknown) => Promise<R | undefined>;

function FicheApplication({
  app,
  d,
  modifiable,
  agir,
  onSupprime,
}: {
  app: AppGap;
  d: Donnees;
  modifiable: boolean;
  agir: Agir;
  onSupprime: () => void;
}) {
  const exclues = new Set(d.exclues);
  const s = statsGap(app, exclues);
  const points = pointsGap(app);
  const maj = (champ: Record<string, unknown>) => void agir('PATCH', `/api/gap/${app.id}`, champ);
  const majPoint = (id: string, champ: Record<string, unknown>) =>
    void agir('PATCH', `/api/gap/${app.id}/points/${id}`, champ);
  const [nouveau, setNouveau] = useState('');
  const [refs, setRefs] = useState('');
  const ecartPlan = app.planFd ? d.ecarts[app.planFd] : undefined;
  return (
    <Stack>
      <Group>
        <StatusChip etat={s.pct >= 100 ? 'succes' : 'neutre'}>{s.pct} %</StatusChip>
        <Text size="sm" c="dimmed">
          {s.c.Conforme} conforme(s), {s.c.Partiel} partiel(s), {s.c['Non conforme']} non conforme(s),{' '}
          {s.c['À évaluer']} à évaluer, {s.c['Non applicable']} non applicable(s).
          {app.dscp === 'Non' ? ' Exigences HDS masquées (pas de DSCP).' : ''}
        </Text>
      </Group>
      <div className="grille-formulaire">
        <div className="grille-formulaire__champs">
          <ChampTexte
            label="Application"
            value={app.name}
            requis
            disabled={!modifiable}
            onCommit={(v) => maj({ name: v })}
          />
          <ChampChoix
            label="Fournisseur"
            effacable
            value={app.supplier}
            disabled={!modifiable}
            options={d.fournisseurs.map((f) => ({ value: f.id, label: f.name }))}
            onCommit={(v) => maj({ supplier: v })}
          />
          <ChampChoix
            label="Données de santé (DSCP)"
            value={app.dscp}
            disabled={!modifiable}
            options={QUALIFICATIONS_GAP}
            onCommit={(v) => maj({ dscp: v })}
          />
          <ChampChoix
            label="Service en nuage"
            value={app.cloud}
            disabled={!modifiable}
            options={QUALIFICATIONS_GAP}
            onCommit={(v) => maj({ cloud: v })}
          />
          <ChampChoix
            label="Statut"
            value={app.status}
            disabled={!modifiable}
            options={STATUTS_GAP}
            onCommit={(v) => maj({ status: v })}
          />
          <ChampTexte
            label="Responsable"
            value={app.owner}
            disabled={!modifiable}
            onCommit={(v) => maj({ owner: v })}
          />
          <ChampTexte
            label="Échéance cible"
            type="date"
            value={app.target}
            disabled={!modifiable}
            onCommit={(v) => maj({ target: v })}
          />
        </div>
      </div>
      <ChampZone
        label="Description et activités concernées"
        value={app.desc}
        disabled={!modifiable}
        onCommit={(v) => maj({ desc: v })}
      />
      {app.profile && (
        <details>
          <summary>Réponses au questionnaire{app.profileAt ? ` (${jour(app.profileAt.slice(0, 10))})` : ''}</summary>
          <ul className="audit-motifs">
            {QUESTIONS_GAP.filter(
              (q) => app.profile![q.k] && (!Array.isArray(app.profile![q.k]) || (app.profile![q.k] as string[]).length),
            ).map((q) => (
              <li key={q.k}>
                <b>{q.l}</b> : {([] as string[]).concat(app.profile![q.k] as string | string[]).join(', ')}
              </li>
            ))}
          </ul>
        </details>
      )}
      {ecartPlan !== undefined && (
        <Text size="sm">
          Plan d’action {app.planFd} ({ecartPlan.toLowerCase()}) dans « Écarts et actions ».
        </Text>
      )}
      {SECTIONS_GAP.map(([cle, libelle]) => {
        const ls = points.filter((l) => l.sec === cle);
        if (!ls.length) return null;
        return (
          <section key={cle} aria-label={libelle}>
            <Text fw={600}>{libelle}</Text>
            <Stack gap="sm" component="ul" className="audit-liste">
              {ls.map((l) => {
                const v = app.lines[l.id] ?? {};
                const etat = etatPointGap(app, l, exclues) as EtatGap;
                const code = (r: string) => d.exigences.find((e) => e.id === r)?.code;
                return (
                  <Card key={l.id} component="li" withBorder padding="sm">
                    <Stack gap="xs">
                      <Group justify="space-between" align="flex-start" wrap="nowrap">
                        <div>
                          <Group gap="xs">
                            {l.refs.map((r) => (
                              <span
                                key={r}
                                className="audit-tuile audit-niv-faible"
                                title={d.exigences.find((e) => e.id === r)?.titre}
                              >
                                {code(r) ?? r}
                              </span>
                            ))}
                          </Group>
                          <Text size="sm">
                            {l.t}
                            {l.custom ? ' (ajouté)' : ''}
                          </Text>
                        </div>
                        <ChampChoix
                          ariaLabel={`État du point ${l.id}`}
                          value={etat}
                          disabled={!modifiable}
                          options={ETATS_GAP}
                          onCommit={(x) => majPoint(l.id, { st: x })}
                        />
                      </Group>
                      <div className="grille-formulaire">
                        <div className="grille-formulaire__champs">
                          <ChampTexte
                            ariaLabel={`Constat du point ${l.id}`}
                            placeholder="Constat ou commentaire"
                            value={v.comment ?? ''}
                            disabled={!modifiable}
                            onCommit={(x) => majPoint(l.id, { comment: x })}
                          />
                          <ChampTexte
                            ariaLabel={`Pilote du point ${l.id}`}
                            placeholder="Pilote"
                            value={v.owner ?? ''}
                            disabled={!modifiable}
                            onCommit={(x) => majPoint(l.id, { owner: x })}
                          />
                          <ChampTexte
                            ariaLabel={`Échéance du point ${l.id}`}
                            type="date"
                            value={v.due ?? ''}
                            disabled={!modifiable}
                            onCommit={(x) => majPoint(l.id, { due: x })}
                          />
                        </div>
                      </div>
                      <Group gap="xs">
                        <StatusChip etat={ETAT[NIVEAU_ETAT_GAP[etat]]}>{etat}</StatusChip>
                        {v.fd ? (
                          <Text size="xs">
                            Action {v.fd}
                            {d.ecarts[v.fd] ? ` (${d.ecarts[v.fd]!.toLowerCase()})` : ''}
                          </Text>
                        ) : (
                          modifiable &&
                          ['Partiel', 'Non conforme'].includes(etat) && (
                            <Button
                              size="compact-sm"
                              variant="subtle"
                              onClick={() => void agir('POST', `/api/gap/${app.id}/points/${l.id}/action`)}
                            >
                              Créer l’action dans le registre des écarts
                            </Button>
                          )
                        )}
                        {modifiable && l.custom && (
                          <Button
                            size="compact-sm"
                            variant="subtle"
                            onClick={() => void agir('DELETE', `/api/gap/${app.id}/points/${l.id}`)}
                          >
                            Retirer
                          </Button>
                        )}
                      </Group>
                    </Stack>
                  </Card>
                );
              })}
            </Stack>
          </section>
        );
      })}
      {modifiable && (
        <section aria-label="Ajouter un point de contrôle">
          <Text fw={600}>Ajouter un point de contrôle</Text>
          <Group align="flex-end">
            <ChampTexte label="Point de contrôle" value={nouveau} onCommit={setNouveau} />
            <ChampTexte label="Références (ex. A.8.24 ; EXI 15)" value={refs} onCommit={setRefs} />
            <Button
              variant="default"
              disabled={!nouveau.trim()}
              onClick={async () => {
                const r = await agir('POST', `/api/gap/${app.id}/points`, { t: nouveau, refs });
                if (r) {
                  setNouveau('');
                  setRefs('');
                }
              }}
            >
              Ajouter
            </Button>
          </Group>
        </section>
      )}
      {modifiable && (
        <Group justify="flex-end">
          <ConfirmButton
            message={`Supprimer « ${app.name} » et son analyse d’écart ?`}
            onConfirm={async () => {
              await agir('DELETE', `/api/gap/${app.id}`);
              onSupprime();
            }}
            variant="light"
          >
            Supprimer l’application
          </ConfirmButton>
        </Group>
      )}
    </Stack>
  );
}

/* ------------------------------------------------------------------------------------------ questionnaire guidé */
function GuideGap({
  d,
  agir,
  onDone,
  modele,
}: {
  d: Donnees;
  agir: Agir;
  onDone: (id: string) => void;
  modele: 'application' | 'ia';
}) {
  const ia = modele === 'ia';
  const [v, setV] = useState({ name: '', supplier: '', supplierNew: '', owner: '', target: '', desc: '' });
  const [reponses, setReponses] = useState<ReponsesGap>({});
  const [mkPlan, setMkPlan] = useState(true);
  const [info, setInfo] = useState('');
  const questions = ia ? questionsIaVisibles(reponses) : QUESTIONS_GAP;
  const repondues = questions.filter((q) =>
    q.multi ? ((reponses[q.k] as string[] | undefined) ?? []).length : reponses[q.k],
  ).length;
  const apercu = repondues ? (ia ? questionnaireGapIa(reponses) : questionnaireGap(reponses)) : null;
  const total = apercu
    ? pointsGap({ dscp: apercu.dscp, cloud: apercu.cloud, custom: apercu.custom, modele: ia ? 'ia' : 'application' })
        .length
    : 0;
  const preEcarts = apercu ? Object.values(apercu.st).filter((x) => x === 'Non conforme').length : 0;
  const choisir = (k: string, o: string, multi?: boolean) => {
    if (multi) {
      const exclusifs = ['Aucune', 'Aucun', 'Inconnu'];
      let l = (reponses[k] as string[] | undefined) ?? [];
      if (l.includes(o)) l = l.filter((x) => x !== o);
      else if (exclusifs.includes(o)) l = [o];
      else l = [...l.filter((x) => !exclusifs.includes(x)), o];
      setReponses({ ...reponses, [k]: l });
    } else setReponses({ ...reponses, [k]: reponses[k] === o ? undefined : o });
  };
  const generer = async () => {
    const corps = {
      ...v,
      modele,
      // Seules les réponses aux questions affichées sont envoyées (un cas d'usage décoché n'en laisse pas).
      answers: Object.fromEntries(
        Object.entries(reponses).filter(([k, x]) => x !== undefined && questions.some((q) => q.k === k)),
      ),
      mkPlan,
    };
    const r = await agir<{ app: AppGap; plan: string | null; fournisseur: string | null }>(
      'POST',
      '/api/gap/guide',
      corps,
    );
    if (r) {
      setInfo(
        [`GAP ${r.app.id} créé`, r.plan && `plan d’action ${r.plan}`, r.fournisseur && `fournisseur ${r.fournisseur}`]
          .filter(Boolean)
          .join(', ') + '.',
      );
      onDone(r.app.id);
    }
  };
  return (
    <Stack>
      <Text size="sm" c="dimmed">
        {ia
          ? 'Répondez par des faits que l’on peut constater (compte utilisé, contrat, filtrage, relecture) pour chacune des situations d’IA qui concernent le GCS : les points ISO 27001 / HDS à contrôler sont générés, ceux que les réponses permettent de trancher sont pré-évalués et le plan d’action est créé. Une question sans réponse ou « Inconnu » laisse le point « à évaluer » : rien n’est supposé.'
          : 'Décrivez l’outil ou le service à intégrer au périmètre ISO 27001 / HDS : la liste des points à contrôler ou à mettre en place est générée, les points que les réponses permettent de trancher sont pré-évalués, et le plan d’action est créé. Les questions sans réponse laissent les points concernés « à évaluer ».'}
      </Text>
      {info && <Alert color="green">{info}</Alert>}
      <div className="grille-formulaire">
        <div className="grille-formulaire__champs">
          <ChampTexte
            label={ia ? 'Intitulé du GAP' : 'Outil ou service'}
            placeholder={ia ? 'ex. Usage de l’IA au GCS' : 'ex. Plateforme de téléexpertise'}
            value={v.name}
            onCommit={(x) => setV({ ...v, name: x })}
          />
          {!ia && (
            <ChampChoix
              label="Fournisseur"
              effacable
              placeholder="Nouveau ou aucun"
              value={v.supplier}
              options={d.fournisseurs.map((f) => ({ value: f.id, label: f.name }))}
              onCommit={(x) => setV({ ...v, supplier: x })}
            />
          )}
          {!ia && !v.supplier && (
            <ChampTexte
              label="Nouveau fournisseur (facultatif)"
              value={v.supplierNew}
              onCommit={(x) => setV({ ...v, supplierNew: x })}
            />
          )}
          <ChampTexte label="Responsable" value={v.owner} onCommit={(x) => setV({ ...v, owner: x })} />
          <ChampTexte
            label="Échéance d’intégration"
            type="date"
            value={v.target}
            onCommit={(x) => setV({ ...v, target: x })}
          />
        </div>
      </div>
      <ChampZone label="Description et activités concernées" value={v.desc} onCommit={(x) => setV({ ...v, desc: x })} />
      <ol className="audit-liste">
        {questions.map((q) => (
          <li key={q.k}>
            <Text size="sm" fw={600}>
              {q.l}
              {q.multi ? ' (plusieurs choix)' : ''}
            </Text>
            <Group gap="xs" role="group" aria-label={q.l}>
              {q.o.map((o) => {
                const actif = q.multi
                  ? ((reponses[q.k] as string[] | undefined) ?? []).includes(o)
                  : reponses[q.k] === o;
                return (
                  <Button
                    key={o}
                    size="compact-sm"
                    variant={actif ? 'filled' : 'default'}
                    aria-pressed={actif}
                    onClick={() => choisir(q.k, o, q.multi)}
                  >
                    {o}
                  </Button>
                );
              })}
            </Group>
          </li>
        ))}
      </ol>
      <Group>
        <Card withBorder padding="xs">
          <Text fw={700}>
            {repondues}/{questions.length}
          </Text>
          <Text size="xs" c="dimmed">
            réponses
          </Text>
        </Card>
        <Card withBorder padding="xs">
          <Text fw={700}>{total}</Text>
          <Text size="xs" c="dimmed">
            points de contrôle
          </Text>
        </Card>
        <Card withBorder padding="xs">
          <Text fw={700}>{preEcarts}</Text>
          <Text size="xs" c="dimmed">
            écarts déjà identifiés
          </Text>
        </Card>
      </Group>
      <label>
        <input type="checkbox" checked={mkPlan} onChange={(e) => setMkPlan(e.currentTarget.checked)} /> Créer le plan
        d’action dans « Écarts et actions »
      </label>
      <Group justify="flex-end">
        <Button
          disabled={!v.name.trim()}
          title={v.name.trim() ? undefined : 'Indiquez le nom de l’outil ou du service'}
          onClick={() => void generer()}
        >
          Générer le GAP
        </Button>
      </Group>
    </Stack>
  );
}
