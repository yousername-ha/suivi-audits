import type { BusinessObject } from './types';

export const sampleProcesses: BusinessObject[] = [
  {
    id: 'PR01',
    code: 'PR01',
    type: 'process',
    category: 'realisation',
    name: "Processus de réalisation 01"
  },
  {
    id: 'PR02',
    code: 'PR02',
    type: 'process',
    category: 'realisation',
    name: 'Processus de réalisation 02'
  },
  {
    id: 'PR03',
    code: 'PR03',
    type: 'process',
    category: 'realisation',
    name: 'Processus de réalisation 03'
  },
  {
    id: 'PR04',
    code: 'PR04',
    type: 'process',
    category: 'realisation',
    name: 'Processus de réalisation 04'
  },
  {
    id: 'PR05',
    code: 'PR05',
    type: 'process',
    category: 'realisation',
    name: "Processus de réalisation 05",
    metadata: { page: 16 }
  },
  {
    id: 'PS01',
    code: 'PS01',
    type: 'process',
    category: 'support',
    name: 'Processus de support 01'
  },
  {
    id: 'PS01.1',
    code: 'PS01.1',
    type: 'subprocess',
    category: 'support',
    name: 'Processus de support 01.1',
    metadata: { parentCode: 'PS01' }
  },
  {
    id: 'PS01.2',
    code: 'PS01.2',
    type: 'subprocess',
    category: 'support',
    name: 'Processus de support 01.2',
    metadata: { parentCode: 'PS01' }
  },
  {
    id: 'PS02',
    code: 'PS02',
    type: 'process',
    category: 'support',
    name: 'Processus de support 02'
  }
];
