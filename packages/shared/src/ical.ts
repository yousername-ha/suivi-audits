/* Lecture d'un calendrier iCalendar (RFC 5545) pour en tirer des jours exclus d'une série de tâches récurrentes.
   Le texte est fourni par la personne (collé ou lu depuis un fichier .ics) : le serveur ne va jamais chercher une adresse
   distante. Seules les dates comptent ; l'heure et le fuseau d'un événement sont ignorés (jour calendaire tel qu'écrit).
   Un fichier qui contient une erreur n'est jamais appliqué, même en partie. */
import { z } from 'zod';
import { validDate } from './grc.js';
import { developper, lireRegle } from './ical-repetition.js';

export const ICAL_MAX_OCTETS = 262144;
export const ICAL_MAX_JOURS = 1000;

/** Un événement ne peut pas couvrir plus d'un an : au-delà, le fichier est considéré comme erroné. */
const ICAL_MAX_DUREE = 366;

export interface IcalLigne {
  ligne: number;
  message: string;
}
export interface IcalLecture {
  /** Jours exclus tirés du fichier, triés, sans doublon. */
  jours: string[];
  /** Événements volontairement laissés de côté (annulés, avec règle de répétition) : informatifs, jamais bloquants. */
  ignores: IcalLigne[];
  /** Erreurs bloquantes : tant qu'il en reste, rien n'est appliqué. */
  erreurs: IcalLigne[];
}

export const CalendrierBody = z
  .object({
    ics: z.string().min(1).max(ICAL_MAX_OCTETS),
    /** Aperçu seul : décrit ce qui serait ajouté, sans rien écrire. */
    apercu: z.boolean().default(true),
  })
  .strict();
export type CalendrierBody = z.infer<typeof CalendrierBody>;
export interface ApercuCalendrier extends IcalLecture {
  /** Jours du fichier absents de la série, ajoutés par l'import. */
  nouveaux: string[];
  /** Jours du fichier déjà exclus dans la série : un second import ne crée aucun doublon. */
  dejaPresents: string[];
  /** Nombre de jours exclus de la série après l'import. */
  total: number;
  applique: boolean;
}

const ajouterJours = (day: string, n: number) =>
  new Date(Date.parse(day + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const jourPrecedent = (day: string) => new Date(Date.parse(day + 'T12:00:00Z') - 86400000).toISOString().slice(0, 10);

/** Dépliage RFC 5545 : une ligne qui commence par une espace ou une tabulation continue la précédente. */
function lignes(texte: string): { n: number; texte: string }[] {
  const out: { n: number; texte: string }[] = [];
  texte.split(/\r\n|\n|\r/).forEach((brut, i) => {
    if (/^[ \t]/.test(brut) && out.length) out[out.length - 1]!.texte += brut.slice(1);
    else out.push({ n: i + 1, texte: brut });
  });
  return out.filter((l) => l.texte.trim() !== '');
}
/** `AAAAMMJJ` ou `AAAAMMJJTHHMMSS[Z]` vers `AAAA-MM-JJ` ; nul si le format est inconnu ou la date impossible. */
function dateIcs(valeur: string): { jour: string; avecHeure: boolean; minuit: boolean } | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z?)?$/.exec(valeur.trim());
  if (!m) return null;
  const jour = `${m[1]}-${m[2]}-${m[3]}`;
  if (!validDate(jour)) return null;
  return { jour, avecHeure: m[4] !== undefined, minuit: m[4] === '00' && m[5] === '00' && m[6] === '00' };
}

/** Les règles de répétition sont développées de un an avant `aujourdhui` jusqu'à cinq ans après. */
export const ICAL_HORIZON_ANS = 5;
export function lireIcs(texte: string, aujourdhui: string = new Date().toISOString().slice(0, 10)): IcalLecture {
  const jours = new Set<string>();
  const ignores: IcalLigne[] = [];
  const erreurs: IcalLigne[] = [];
  const l = lignes(texte);
  if (!l.length || l[0]!.texte.trim().toUpperCase() !== 'BEGIN:VCALENDAR')
    return {
      jours: [],
      ignores,
      erreurs: [{ ligne: l[0]?.n ?? 1, message: 'Fichier iCalendar invalide : BEGIN:VCALENDAR attendu.' }],
    };
  if (l[l.length - 1]!.texte.trim().toUpperCase() !== 'END:VCALENDAR')
    erreurs.push({
      ligne: l[l.length - 1]!.n,
      message: 'Fichier iCalendar tronqué : END:VCALENDAR attendu en dernière ligne.',
    });
  let evenement: { debut: number; props: Map<string, string> } | null = null;
  for (const { n, texte: ligne } of l) {
    const nom = ligne.trim().toUpperCase();
    if (nom === 'BEGIN:VEVENT') {
      if (evenement) erreurs.push({ ligne: n, message: 'VEVENT imbriqué.' });
      evenement = { debut: n, props: new Map() };
      continue;
    }
    if (nom === 'END:VEVENT') {
      if (!evenement) {
        erreurs.push({ ligne: n, message: 'END:VEVENT sans BEGIN:VEVENT.' });
        continue;
      }
      const e = evenement;
      evenement = null;
      const statut = (e.props.get('STATUS') ?? '').toUpperCase();
      if (statut === 'CANCELLED') {
        ignores.push({ ligne: e.debut, message: 'Événement annulé, ignoré.' });
        continue;
      }
      const debutBrut = e.props.get('DTSTART');
      if (!debutBrut) {
        erreurs.push({ ligne: e.debut, message: 'Événement sans DTSTART.' });
        continue;
      }
      const debut = dateIcs(debutBrut);
      if (!debut) {
        erreurs.push({ ligne: e.debut, message: `DTSTART illisible : « ${debutBrut.slice(0, 40)} ».` });
        continue;
      }
      let fin = debut.jour;
      const finBrut = e.props.get('DTEND');
      if (finBrut) {
        const f = dateIcs(finBrut);
        if (!f) {
          erreurs.push({ ligne: e.debut, message: `DTEND illisible : « ${finBrut.slice(0, 40)} ».` });
          continue;
        }
        // DTEND est exclusive pour un jour entier et pour un événement qui finit à minuit pile : le dernier jour couvert
        // est alors la veille.
        const dernier = !f.avecHeure || f.minuit ? jourPrecedent(f.jour) : f.jour;
        fin = dernier < debut.jour ? debut.jour : dernier;
      }
      const duree = (Date.parse(fin + 'T12:00:00Z') - Date.parse(debut.jour + 'T12:00:00Z')) / 86400000 + 1;
      if (duree > ICAL_MAX_DUREE) {
        erreurs.push({ ligne: e.debut, message: `Événement de plus de ${ICAL_MAX_DUREE} jours.` });
        continue;
      }
      const ajouter = (premier: string) => {
        for (let k = 0; k < duree; k++) jours.add(ajouterJours(premier, k));
      };
      const brutRegle = e.props.get('RRULE');
      if (!brutRegle) {
        ajouter(debut.jour);
        continue;
      }
      const lue = lireRegle(brutRegle);
      if ('refus' in lue) {
        ignores.push({
          ligne: e.debut,
          message: `Règle de répétition (RRULE) non prise en charge (${lue.refus}) : ajoutez les dates réelles au calendrier.`,
        });
        continue;
      }
      const horizon = aujourdhui;
      const jusqu = `${Number(horizon.slice(0, 4)) + ICAL_HORIZON_ANS}${horizon.slice(4)}`;
      const exclus = new Set(
        (e.props.get('EXDATE') ?? '')
          .split(',')
          .map((v) => dateIcs(v)?.jour)
          .filter((v): v is string => !!v),
      );
      const dev = developper(lue.regle, debut.jour, ajouterJours(aujourdhui, -366), jusqu);
      for (const premier of dev.jours) if (!exclus.has(premier)) ajouter(premier);
      if (dev.tronque)
        ignores.push({
          ligne: e.debut,
          message: `Règle de répétition sans fin développée jusqu'au ${jusqu} (${ICAL_HORIZON_ANS} ans après aujourd'hui).`,
        });
      continue;
    }
    if (evenement) {
      const i = ligne.indexOf(':');
      if (i < 0) continue;
      const cle = ligne.slice(0, i).split(';')[0]!.trim().toUpperCase();
      // Pour DTSTART/DTEND, un paramètre `VALUE=DATE` ou `TZID=` précède les deux-points : seule la valeur compte.
      // EXDATE peut figurer plusieurs fois : les valeurs s'ajoutent ; pour les autres propriétés, la première l'emporte.
      if (cle === 'EXDATE')
        evenement.props.set(cle, [evenement.props.get(cle), ligne.slice(i + 1)].filter(Boolean).join(','));
      else if (!evenement.props.has(cle)) evenement.props.set(cle, ligne.slice(i + 1));
    }
  }
  if (evenement) erreurs.push({ ligne: evenement.debut, message: 'VEVENT non terminé (END:VEVENT manquant).' });
  if (jours.size > ICAL_MAX_JOURS)
    erreurs.push({
      ligne: 1,
      message: `Plus de ${ICAL_MAX_JOURS} jours dans le fichier : réduisez la période couverte.`,
    });
  return { jours: [...jours].sort(), ignores, erreurs };
}
