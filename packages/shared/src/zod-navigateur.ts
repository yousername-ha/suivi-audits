/* Zod dans le navigateur, sans compilation à la volée (ADR 0006, addendum du 24/11/2026). Pour accélérer l'analyse des
   objets, zod teste d'abord `new Function("")` à la création de chaque schéma d'objet. Sous la CSP de l'interface
   (script-src 'self', sans 'unsafe-eval'), ce test échoue sans gêne visible, mais il est relevé comme violation de la CSP
   appliquée et, en observation, de Trusted Types (« This document requires 'TrustedScript' assignment »), à chaque page.
   Le réglage `jitless` évite ce test ; il ne change rien au résultat des analyses, et le navigateur n'avait de toute façon
   pas le droit de compiler. L'API (Node, sans `document`) garde la compilation à la volée.
   Ce module est importé en premier par chaque point d'entrée du paquet : il s'exécute avant la création des schémas. */
import { config } from 'zod';

// Paquet compilé sans les types du DOM : le document est lu sur l'objet global.
if ('document' in globalThis) config({ jitless: true });
