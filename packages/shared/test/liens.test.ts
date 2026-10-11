/* Catalogue des relations (lot U4, ADR 0028) : cohérent avec le schéma d'API, sens explicite, « Lié à » ouvert. */
import { describe, expect, it } from 'vitest';
import {
  GRC_KINDS,
  libelleRelation,
  LinkBody,
  relationAutorisee,
  relationsPossibles,
  TYPES_RELATION,
} from '../src/index.js';

describe('catalogue des relations', () => {
  it('mêmes types que le schéma des liens de l’API', () => {
    expect([...LinkBody.shape.type.options].sort()).toEqual([...TYPES_RELATION].sort());
  });
  it('« Lié à » relie toute paire de types', () => {
    for (const s of GRC_KINDS) for (const c of GRC_KINDS) expect(relationAutorisee('related_to', s, c)).toBe(true);
  });
  it('relations typées dans leur sens métier seulement', () => {
    expect(relationAutorisee('supports', 'support_asset', 'business_asset')).toBe(true);
    expect(relationAutorisee('supports', 'business_asset', 'support_asset')).toBe(false);
    expect(relationAutorisee('treats', 'treatment', 'risk')).toBe(true);
    expect(relationAutorisee('treats', 'risk', 'treatment')).toBe(false);
    expect(relationAutorisee('demonstrates', 'evidence', 'requirement')).toBe(true);
    expect(relationAutorisee('impacts', 'risk', 'supplier')).toBe(true);
    expect(relationAutorisee('inconnue', 'risk', 'risk')).toBe(false);
  });
  it('les liens créés par le serveur pour un traitement de risque restent dans le catalogue', () => {
    expect(relationAutorisee('implements', 'action', 'risk')).toBe(true);
    expect(relationAutorisee('treats', 'action', 'nonconformity')).toBe(true);
  });
  it('relations proposées et libellés selon le sens de lecture', () => {
    expect(relationsPossibles('evidence', 'measure')[0]).toBe('related_to');
    expect(relationsPossibles('evidence', 'measure')).toContain('demonstrates');
    expect(libelleRelation('treats', true)).toBe('Traite');
    expect(libelleRelation('treats', false)).toBe('Est traité par');
  });
});
