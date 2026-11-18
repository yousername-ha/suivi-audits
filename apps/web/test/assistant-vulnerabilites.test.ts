/* Assistant et module Vulnérabilités à l'écran (ADR 0100, V14, V29, V30) : machines marquées dans un texte de l'assistant
   (nom avec info-bulle, repère d'une machine non lisible laissé tel quel, repère inconnu signalé), carte et décision d'une
   proposition d'action sur une faille, corps envoyé au serveur, aide. Données entièrement fictives. */
import type { PropositionVulnerabiliteDto } from '@suivi/shared';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  CartePropositionVulnerabilite,
  corpsDecisionVulnerabilite,
  DecisionPropositionVulnerabilite,
  TexteMachines,
} from '../src/assistant/PropositionsVulnerabilites';
import { HELP_ARTICLES } from '../src/help';

const proposition = (extra: Partial<PropositionVulnerabiliteDto> = {}): PropositionVulnerabiliteDto => ({
  id: '00000000-0000-4000-8000-0000000000b1',
  conversationId: '00000000-0000-4000-8000-0000000000b2',
  faille: {
    nature: 'constat',
    id: '00000000-0000-4000-8000-0000000000b3',
    libelle: 'Contrôle n° 990001 : contrôle fictif',
  },
  titre: 'Corriger srv-fictif-01.exemple.invalid',
  titreSegments: [{ texte: 'Corriger ' }, { repere: 'M-001', machine: 'srv-fictif-01.exemple.invalid' }],
  description: 'Appliquer le correctif sur srv-fictif-01.exemple.invalid puis M-002.',
  descriptionSegments: [],
  echeance: '2099-01-31',
  machines: [
    { repere: 'M-001', nom: 'srv-fictif-01.exemple.invalid' },
    { repere: 'M-002', nom: null },
  ],
  etat: 'en_attente',
  decidedBy: '',
  decidedAt: null,
  decisionNote: '',
  actionId: null,
  createdAt: '2026-11-16T10:00:00.000Z',
  ...extra,
});

describe('texte de l’assistant : machines marquées', () => {
  it('nom avec info-bulle et repère ; repère non lisible tel quel ; repère inconnu signalé', () => {
    const html = renderToStaticMarkup(
      createElement(TexteMachines, {
        segments: [
          { texte: 'Traiter ' },
          { repere: 'M-001', machine: 'srv-fictif-01.exemple.invalid' },
          { texte: ', puis ' },
          { repere: 'M-002', etat: 'non_lisible' },
          { texte: ' et ' },
          { repere: 'M-777', etat: 'inconnu' },
        ],
      }),
    );
    expect(html).toContain(
      'class="as-machine" title="Machine (repère M-001 pour l’assistant)">srv-fictif-01.exemple.invalid',
    );
    expect(html).toContain('class="as-repere"');
    expect(html).toContain('>M-002<');
    expect(html).toContain('class="as-repere-inconnu"');
    expect(html).toContain('M-777 (repère non reconnu)');
    // Ni style ni script en ligne (CSP stricte, ADR 0006).
    expect(html).not.toMatch(/style=|<script/);
  });
});

describe('propositions d’action sur une faille', () => {
  it('carte : titre avec la machine marquée, faille, échéance, état ; remplacée ; décidée', () => {
    const html = renderToStaticMarkup(
      createElement(CartePropositionVulnerabilite, { proposition: proposition(), onExaminer: () => undefined }),
    );
    expect(html).toContain('Proposition d’action · Vulnérabilités');
    expect(html).toContain('class="as-machine"');
    expect(html).toContain('Contrôle n° 990001 : contrôle fictif');
    expect(html).toContain('31 janvier 2099');
    expect(html).toContain('À examiner');
    expect(html).toContain('Examiner la proposition');
    const retiree = renderToStaticMarkup(
      createElement(CartePropositionVulnerabilite, {
        proposition: proposition({ etat: 'retiree' }),
        onExaminer: () => undefined,
      }),
    );
    expect(retiree).toContain('Remplacée par une proposition plus récente');
    expect(retiree).not.toContain('Examiner la proposition');
    const decidee = renderToStaticMarkup(
      createElement(CartePropositionVulnerabilite, {
        proposition: proposition({ etat: 'confirmee', decidedBy: 'rssi_fictif' }),
        onExaminer: () => undefined,
      }),
    );
    expect(decidee).toContain('Décision enregistrée par rssi_fictif');
  });

  it('décision : périmètres où la personne écrit, texte avec les noms, machines concernées ; sans droit, désactivée', () => {
    const props = {
      proposition: proposition(),
      perimetres: [{ id: '00000000-0000-4000-8000-0000000000c1', nom: 'Périmètre fictif' }],
      busy: false,
      decide: () => undefined,
    };
    const html = renderToStaticMarkup(createElement(DecisionPropositionVulnerabilite, { ...props, peutDecider: true }));
    expect(html).toContain('Périmètre de l’action');
    expect(html).toContain('Périmètre fictif');
    expect(html).toContain('value="Corriger srv-fictif-01.exemple.invalid"');
    expect(html).toContain('Machines concernées');
    expect(html).toContain('>M-002<');
    expect(html).toContain('Rien n’est renvoyé à l’assistant');
    // Champs ouverts ; seule la confirmation attend le choix du périmètre.
    expect(html).not.toMatch(/<(input|select|textarea)[^>]*disabled/);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>.*Confirmer l’action/);
    const sans = renderToStaticMarkup(
      createElement(DecisionPropositionVulnerabilite, { ...props, peutDecider: false }),
    );
    expect(sans).toMatch(/<select[^>]*disabled=""/);
    expect(sans).toMatch(/<button type="button"[^>]*disabled=""[^>]*>Rejeter/);
    expect(sans).toContain('modifier les vulnérabilités');
    expect(sans).not.toMatch(/style=|<script/);
  });

  it('corps envoyé : confirmer avec le périmètre et le texte corrigé ; rejeter avec la seule note', () => {
    const v = { perimetreId: 'p', titre: ' Titre ', description: ' Texte. ', echeance: '', note: ' Note ' };
    expect(corpsDecisionVulnerabilite('confirmer', v)).toEqual({
      decision: 'confirmer',
      perimetreId: 'p',
      titre: 'Titre',
      description: 'Texte.',
      echeance: null,
      note: 'Note',
    });
    expect(corpsDecisionVulnerabilite('rejeter', v)).toEqual({ decision: 'rejeter', note: 'Note' });
  });

  it('aide : repères, propositions et actifs touchés', () => {
    const texte = JSON.stringify(HELP_ARTICLES);
    expect(texte).toContain('repère');
    expect(texte).toContain('Sommes-nous touchés');
    expect(texte).toContain('Actifs touchés');
  });
});
