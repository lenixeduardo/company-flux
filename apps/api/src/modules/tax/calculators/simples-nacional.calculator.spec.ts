import {
  calculateSimplesDAS,
  SimplesAnexo,
  SimplesCalculationResult,
} from './simples-nacional.calculator';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeExpectedEffectiveRate(rbt12: number, rate: number, deduction: number): number {
  // aliquotaEfetiva = ((RBT12 * Aliq) - PD) / RBT12, expressed as percentage
  return ((rbt12 * rate - deduction) / rbt12) * 100;
}

// ---------------------------------------------------------------------------
// Anexo I — Comércio
// ---------------------------------------------------------------------------

describe('calculateSimplesDAS — Anexo I (Comércio)', () => {
  const anexo: SimplesAnexo = 'I';

  describe('Bracket 1: RBT12 up to R$ 180.000', () => {
    const rbt12 = 120000;
    const monthly = 10000;

    it('returns faixaAnexo = 1', () => {
      const result = calculateSimplesDAS(monthly, rbt12, anexo);
      expect(result.faixaAnexo).toBe(1);
    });

    it('returns nominal rate of 4%', () => {
      const result = calculateSimplesDAS(monthly, rbt12, anexo);
      expect(result.aliquotaNominal).toBeCloseTo(4, 2);
    });

    it('effective rate equals nominal when deduction is 0', () => {
      const result = calculateSimplesDAS(monthly, rbt12, anexo);
      // deduction = 0 in bracket 1 => effective = nominal
      expect(result.aliquotaEfetiva).toBeCloseTo(4, 2);
    });

    it('valorDAS uses effective rate on monthly revenue', () => {
      const result = calculateSimplesDAS(monthly, rbt12, anexo);
      // 10000 * 0.04 = 400
      expect(result.valorDAS).toBeCloseTo(400, 2);
    });

    it('brutoAnual equals rbt12', () => {
      const result = calculateSimplesDAS(monthly, rbt12, anexo);
      expect(result.brutoAnual).toBe(rbt12);
    });

    it('regime is SIMPLES_NACIONAL', () => {
      const result = calculateSimplesDAS(monthly, rbt12, anexo);
      expect(result.regime).toBe('SIMPLES_NACIONAL');
    });
  });

  describe('Bracket 2 (mid-range): RBT12 R$ 300.000', () => {
    const rbt12 = 300000;
    const monthly = 25000;
    // rate=0.073, deduction=5940
    const expectedEffective = computeExpectedEffectiveRate(rbt12, 0.073, 5940);

    it('returns faixaAnexo = 2', () => {
      const result = calculateSimplesDAS(monthly, rbt12, anexo);
      expect(result.faixaAnexo).toBe(2);
    });

    it('effective rate formula is ((RBT12 * Aliq) - PD) / RBT12', () => {
      const result = calculateSimplesDAS(monthly, rbt12, anexo);
      expect(result.aliquotaEfetiva).toBeCloseTo(expectedEffective, 2);
    });

    it('valorDAS reflects effective rate applied to monthly revenue', () => {
      const result = calculateSimplesDAS(monthly, rbt12, anexo);
      const expected = monthly * (expectedEffective / 100);
      expect(result.valorDAS).toBeCloseTo(expected, 2);
    });
  });

  describe('Bracket 4 (mid-high): RBT12 R$ 1.200.000', () => {
    const rbt12 = 1200000;
    const monthly = 100000;
    // rate=0.107, deduction=22500
    const expectedEffective = computeExpectedEffectiveRate(rbt12, 0.107, 22500);

    it('returns faixaAnexo = 4', () => {
      const result = calculateSimplesDAS(monthly, rbt12, anexo);
      expect(result.faixaAnexo).toBe(4);
    });

    it('effective rate matches formula', () => {
      const result = calculateSimplesDAS(monthly, rbt12, anexo);
      expect(result.aliquotaEfetiva).toBeCloseTo(expectedEffective, 2);
    });
  });

  describe('Bracket 6 (last): RBT12 R$ 4.800.000', () => {
    const rbt12 = 4800000;
    const monthly = 400000;
    // rate=0.19, deduction=378000
    const expectedEffective = computeExpectedEffectiveRate(rbt12, 0.19, 378000);

    it('returns faixaAnexo = 6', () => {
      const result = calculateSimplesDAS(monthly, rbt12, anexo);
      expect(result.faixaAnexo).toBe(6);
    });

    it('nominal rate is 19%', () => {
      const result = calculateSimplesDAS(monthly, rbt12, anexo);
      expect(result.aliquotaNominal).toBeCloseTo(19, 2);
    });

    it('effective rate matches formula', () => {
      const result = calculateSimplesDAS(monthly, rbt12, anexo);
      expect(result.aliquotaEfetiva).toBeCloseTo(expectedEffective, 2);
    });
  });

  describe('RBT12 exceeds max bracket (> R$ 4.800.000)', () => {
    const rbt12 = 5000000;
    const monthly = 420000;
    // Still falls into last bracket (index 5 = faixa 6)
    const expectedEffective = computeExpectedEffectiveRate(rbt12, 0.19, 378000);

    it('returns faixaAnexo = 6 (last bracket clamped)', () => {
      const result = calculateSimplesDAS(monthly, rbt12, anexo);
      expect(result.faixaAnexo).toBe(6);
    });

    it('effective rate is computed with last-bracket values', () => {
      const result = calculateSimplesDAS(monthly, rbt12, anexo);
      expect(result.aliquotaEfetiva).toBeCloseTo(expectedEffective, 2);
    });
  });

  describe('RBT12 = 0 fallback', () => {
    it('returns aliquotaEfetiva = 0 (no division by zero)', () => {
      const result = calculateSimplesDAS(10000, 0, anexo);
      expect(result.aliquotaEfetiva).toBeCloseTo(0, 2);
    });

    it('returns faixaAnexo = 1 (first bracket)', () => {
      const result = calculateSimplesDAS(10000, 0, anexo);
      expect(result.faixaAnexo).toBe(1);
    });

    it('valorDAS = 0 when effective rate is 0', () => {
      const result = calculateSimplesDAS(10000, 0, anexo);
      expect(result.valorDAS).toBeCloseTo(0, 2);
    });
  });
});

// ---------------------------------------------------------------------------
// Anexo III — Serviços
// ---------------------------------------------------------------------------

describe('calculateSimplesDAS — Anexo III (Serviços)', () => {
  const anexo: SimplesAnexo = 'III';

  describe('Bracket 1: RBT12 up to R$ 180.000', () => {
    const rbt12 = 150000;
    const monthly = 12500;

    it('returns faixaAnexo = 1', () => {
      const result = calculateSimplesDAS(monthly, rbt12, anexo);
      expect(result.faixaAnexo).toBe(1);
    });

    it('nominal rate is 6%', () => {
      const result = calculateSimplesDAS(monthly, rbt12, anexo);
      expect(result.aliquotaNominal).toBeCloseTo(6, 2);
    });

    it('effective rate equals 6% (deduction=0 in bracket 1)', () => {
      const result = calculateSimplesDAS(monthly, rbt12, anexo);
      expect(result.aliquotaEfetiva).toBeCloseTo(6, 2);
    });

    it('valorDAS = monthly * 0.06', () => {
      const result = calculateSimplesDAS(monthly, rbt12, anexo);
      expect(result.valorDAS).toBeCloseTo(monthly * 0.06, 2);
    });
  });

  describe('Bracket 3 (mid-range): RBT12 R$ 600.000', () => {
    const rbt12 = 600000;
    const monthly = 50000;
    // rate=0.135, deduction=17640
    const expectedEffective = computeExpectedEffectiveRate(rbt12, 0.135, 17640);

    it('returns faixaAnexo = 3', () => {
      const result = calculateSimplesDAS(monthly, rbt12, anexo);
      expect(result.faixaAnexo).toBe(3);
    });

    it('effective rate matches formula', () => {
      const result = calculateSimplesDAS(monthly, rbt12, anexo);
      expect(result.aliquotaEfetiva).toBeCloseTo(expectedEffective, 2);
    });

    it('valorDAS reflects effective rate', () => {
      const result = calculateSimplesDAS(monthly, rbt12, anexo);
      const expected = monthly * (expectedEffective / 100);
      expect(result.valorDAS).toBeCloseTo(expected, 2);
    });
  });

  describe('Bracket 6 (last): RBT12 R$ 4.800.000', () => {
    const rbt12 = 4800000;
    const monthly = 400000;
    // rate=0.33, deduction=648000
    const expectedEffective = computeExpectedEffectiveRate(rbt12, 0.33, 648000);

    it('returns faixaAnexo = 6', () => {
      const result = calculateSimplesDAS(monthly, rbt12, anexo);
      expect(result.faixaAnexo).toBe(6);
    });

    it('nominal rate is 33%', () => {
      const result = calculateSimplesDAS(monthly, rbt12, anexo);
      expect(result.aliquotaNominal).toBeCloseTo(33, 2);
    });

    it('effective rate matches formula', () => {
      const result = calculateSimplesDAS(monthly, rbt12, anexo);
      expect(result.aliquotaEfetiva).toBeCloseTo(expectedEffective, 2);
    });
  });

  describe('Default anexo is I when not specified', () => {
    it('uses Anexo I rate (4%) when no anexo passed', () => {
      const result = calculateSimplesDAS(10000, 100000);
      expect(result.aliquotaNominal).toBeCloseTo(4, 2);
    });
  });

  describe('Return shape', () => {
    it('result contains all expected fields', () => {
      const result = calculateSimplesDAS(10000, 100000, 'III');
      const fields: Array<keyof SimplesCalculationResult> = [
        'brutoAnual',
        'aliquotaNominal',
        'aliquotaEfetiva',
        'valorDAS',
        'faixaAnexo',
        'regime',
      ];
      for (const field of fields) {
        expect(result).toHaveProperty(field);
      }
    });
  });
});
