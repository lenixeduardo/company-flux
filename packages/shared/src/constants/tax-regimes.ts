export enum TaxRegime {
  SIMPLES_NACIONAL = 'SIMPLES_NACIONAL',
  LUCRO_PRESUMIDO = 'LUCRO_PRESUMIDO',
  LUCRO_REAL = 'LUCRO_REAL',
  MEI = 'MEI',
}

export const TAX_REGIME_LABELS: Record<TaxRegime, string> = {
  [TaxRegime.SIMPLES_NACIONAL]: 'Simples Nacional',
  [TaxRegime.LUCRO_PRESUMIDO]: 'Lucro Presumido',
  [TaxRegime.LUCRO_REAL]: 'Lucro Real',
  [TaxRegime.MEI]: 'MEI',
};

// Simples Nacional DAS rates by revenue bracket (Anexo I - Comercio)
export const SIMPLES_NACIONAL_ANEXO_I = [
  { maxRevenue: 180000, rate: 0.04, deduction: 0 },
  { maxRevenue: 360000, rate: 0.073, deduction: 5940 },
  { maxRevenue: 720000, rate: 0.095, deduction: 13860 },
  { maxRevenue: 1800000, rate: 0.107, deduction: 22500 },
  { maxRevenue: 3600000, rate: 0.143, deduction: 87300 },
  { maxRevenue: 4800000, rate: 0.19, deduction: 378000 },
];
