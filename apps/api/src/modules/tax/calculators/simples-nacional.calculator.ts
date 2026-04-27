import Decimal from 'decimal.js';

// Resolução CGSN 140/2018 — Anexo I (Comércio)
const ANEXO_I = [
  { maxRevenue: 180000,   rate: 0.04,  deduction: 0 },
  { maxRevenue: 360000,   rate: 0.073, deduction: 5940 },
  { maxRevenue: 720000,   rate: 0.095, deduction: 13860 },
  { maxRevenue: 1800000,  rate: 0.107, deduction: 22500 },
  { maxRevenue: 3600000,  rate: 0.143, deduction: 87300 },
  { maxRevenue: 4800000,  rate: 0.19,  deduction: 378000 },
];

// Anexo III (Serviços)
const ANEXO_III = [
  { maxRevenue: 180000,   rate: 0.06,  deduction: 0 },
  { maxRevenue: 360000,   rate: 0.112, deduction: 9360 },
  { maxRevenue: 720000,   rate: 0.135, deduction: 17640 },
  { maxRevenue: 1800000,  rate: 0.16,  deduction: 35640 },
  { maxRevenue: 3600000,  rate: 0.21,  deduction: 125640 },
  { maxRevenue: 4800000,  rate: 0.33,  deduction: 648000 },
];

export type SimplesAnexo = 'I' | 'III';

export interface SimplesCalculationResult {
  brutoAnual: number;
  aliquotaNominal: number;
  aliquotaEfetiva: number;
  valorDAS: number;
  faixaAnexo: number;
  regime: 'SIMPLES_NACIONAL';
}

export function calculateSimplesDAS(
  receitaBrutaMensal: number,
  receitaBrutaAnual12m: number,
  anexo: SimplesAnexo = 'I',
): SimplesCalculationResult {
  const table = anexo === 'I' ? ANEXO_I : ANEXO_III;
  const rbt12 = new Decimal(receitaBrutaAnual12m);

  // Find applicable bracket
  let faixa = table.length - 1;
  for (let i = 0; i < table.length; i++) {
    if (rbt12.lte(table[i].maxRevenue)) { faixa = i; break; }
  }

  const { rate, deduction } = table[faixa];
  const aliquotaNominal = new Decimal(rate);
  const deducaoFaixa = new Decimal(deduction);

  // Alíquota efetiva = ((RBT12 × Aliq) − PD) / RBT12
  const aliquotaEfetiva = rbt12.gt(0)
    ? rbt12.mul(aliquotaNominal).minus(deducaoFaixa).div(rbt12)
    : new Decimal(0);

  const valorDAS = new Decimal(receitaBrutaMensal).mul(aliquotaEfetiva).toDecimalPlaces(2);

  return {
    brutoAnual: rbt12.toNumber(),
    aliquotaNominal: aliquotaNominal.mul(100).toDecimalPlaces(4).toNumber(),
    aliquotaEfetiva: aliquotaEfetiva.mul(100).toDecimalPlaces(4).toNumber(),
    valorDAS: valorDAS.toNumber(),
    faixaAnexo: faixa + 1,
    regime: 'SIMPLES_NACIONAL',
  };
}
