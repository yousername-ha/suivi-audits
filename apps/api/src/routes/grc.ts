import { objetsRoutes } from './grc/objets.js';
import { perimetresRoutes } from './grc/perimetres.js';
import { referentielsRoutes } from './grc/referentiels.js';
import { fournisseursRoutes } from './grc/fournisseurs.js';
import { risquesRoutes } from './grc/risques.js';

export const grcRoutes = [
  ...objetsRoutes,
  ...perimetresRoutes,
  ...referentielsRoutes,
  ...fournisseursRoutes,
  ...risquesRoutes,
];
