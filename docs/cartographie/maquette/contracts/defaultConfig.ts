export const defaultMapBuilderConfig = {
  defaultView: 'context',
  views: {
    context: {
      label: 'Vue contexte',
      layout: 'context-layered'
    },
    process: {
      label: 'Vue processus',
      layout: 'process-horizontal'
    }
  },
  generation: {
    defaultRelationshipDepth: 1,
    maxRelationshipDepth: 3,
    warningNodeThreshold: 80,
    hardNodeLimit: 400,
    preserveManualPositions: true
  }
} as const;
