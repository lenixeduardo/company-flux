import Decimal from 'decimal.js';

export interface LucroPresumidoResult {
  baseCalculo: number;
  irpj: number;       // 15% on presumed profit (32% of revenue for services, 8% for commerce)
  irpjAdicional: number; // 10% on base above R$60k/quarter
  csll: number;       // 9% on presumed profit
  pis: number;        // 0.65% cumulative
  cofins: number;     // 3% cumulative
  iss: number;        // varies by municipality, use 5% as default
  total: number;
  regime: 'LUCRO_PRESUMIDO';
}

export type AtividadeLP = 'COMERCIO' | 'SERVICOS' | 'MISTO';

const PERCENTUAIS_PRESUNCAO: Record<AtividadeLP, { irpj: number; csll: number }> = {
  COMERCIO:  { irpj: 0.08, csll: 0.12 },
  SERVICOS:  { irpj: 0.32, csll: 0.32 },
  MISTO:     { irpj: 0.16, csll: 0.20 },
};

export function calculateLucroPresumido(
  receitaBrutaMensal: number,
  atividade: AtividadeLP = 'SERVICOS',
): LucroPresumidoResult {
  const rb = new Decimal(receitaBrutaMensal);
  const p = PERCENTUAIS_PRESUNCAO[atividade];

  const baseIRPJ = rb.mul(p.irpj);
  const baseCSLL = rb.mul(p.csll);

  const irpj = baseIRPJ.mul(0.15).toDecimalPlaces(2);
  // Additional 10% on monthly base exceeding R$20k (R$60k/quarter ÷ 3)
  const irpjAdicional = baseIRPJ.gt(20000)
    ? baseIRPJ.minus(20000).mul(0.10).toDecimalPlaces(2)
    : new Decimal(0);
  const csll = baseCSLL.mul(0.09).toDecimalPlaces(2);
  const pis = rb.mul(0.0065).toDecimalPlaces(2);
  const cofins = rb.mul(0.03).toDecimalPlaces(2);
  const iss = atividade !== 'COMERCIO' ? rb.mul(0.05).toDecimalPlaces(2) : new Decimal(0);

  const total = irpj.plus(irpjAdicional).plus(csll).plus(pis).plus(cofins).plus(iss);

  return {
    baseCalculo: baseIRPJ.toNumber(),
    irpj: irpj.toNumber(),
    irpjAdicional: irpjAdicional.toNumber(),
    csll: csll.toNumber(),
    pis: pis.toNumber(),
    cofins: cofins.toNumber(),
    iss: iss.toNumber(),
    total: total.toDecimalPlaces(2).toNumber(),
    regime: 'LUCRO_PRESUMIDO',
  };
}
