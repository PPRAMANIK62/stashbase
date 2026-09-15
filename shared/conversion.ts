export type ConversionProgress =
  | { phase: 'queued'; lane: 'light' | 'heavy'; tasksAhead: number }
  | { phase: 'yielded'; lane: 'light' | 'heavy'; tasksAhead: number }
  | { phase: 'extracting'; currentPage?: number }
  | { phase: 'indexing' };
