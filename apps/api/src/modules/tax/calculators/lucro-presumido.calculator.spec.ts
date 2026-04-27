import {
  calculateLucroPresumido,
  AtividadeLP,
  LucroPresumidoResult,
} from './lucro-presumido.calculator';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function expectAllFields(result: LucroPresumidoResult) {
  const fields: Array<keyof LucroPresumidoResult> = [
    'baseCalculo',
    'irpj',
    'irpjAdicional',
    'csll',
    'pis',
    'cofins',
    'iss',
    'total',
    'regime',
  ];
  for (const field of fields) {
    expect(result).toHaveProperty(field);
  }
}

// ---------------------------------------------------------------------------
// COMERCIO
// ---------------------------------------------------------------------------

describe('calculateLucroPresumido — COMERCIO', () => {
  const atividade: AtividadeLP = 'COMERCIO';

  describe('Revenue R$ 100.000 / month', () => {
    const revenue = 100000;
    let result: LucroPresumidoResult;

    beforeEach(() => {
      result = calculateLucroPresumido(revenue, atividade);
    });

    it('contains all expected fields', () => {
      expectAllFields(result);
    });

    it('regime is LUCRO_PRESUMIDO', () => {
      expect(result.regime).toBe('LUCRO_PRESUMIDO');
    });

    it('baseCalculo uses 8% presumption for IRPJ', () => {
      // presuncao IRPJ = 8%
      expect(result.baseCalculo).toBeCloseTo(revenue * 0.08, 2);
    });

    it('irpj is 15% on baseCalculo', () => {
      const base = revenue * 0.08;
      expect(result.irpj).toBeCloseTo(base * 0.15, 2);
    });

    it('csll uses 12% presumption at 9%', () => {
      // presuncao CSLL = 12%
      expect(result.csll).toBeCloseTo(revenue * 0.12 * 0.09, 2);
    });

    it('pis is 0.65% of revenue', () => {
      expect(result.pis).toBeCloseTo(revenue * 0.0065, 2);
    });

    it('cofins is 3% of revenue', () => {
      expect(result.cofins).toBeCloseTo(revenue * 0.03, 2);
    });

    it('iss is 0 for COMERCIO', () => {
      expect(result.iss).toBeCloseTo(0, 2);
    });

    it('irpjAdicional is 0 when baseCalculo <= 20000', () => {
      // baseCalculo = 100000 * 0.08 = 8000 < 20000
      expect(result.irpjAdicional).toBeCloseTo(0, 2);
    });

    it('total equals sum of all components', () => {
      const expectedTotal =
        result.irpj + result.irpjAdicional + result.csll + result.pis + result.cofins + result.iss;
      expect(result.total).toBeCloseTo(expectedTotal, 2);
    });
  });

  describe('IRPJ adicional — base exceeds R$ 20.000', () => {
    // Need baseCalculo > 20000: revenue > 250000 (20000 / 0.08)
    const revenue = 300000; // baseIRPJ = 24000

    it('irpjAdicional is 10% on the excess over R$ 20.000', () => {
      const result = calculateLucroPresumido(revenue, atividade);
      const base = revenue * 0.08; // 24000
      const expectedAdicional = (base - 20000) * 0.10; // 400
      expect(result.irpjAdicional).toBeCloseTo(expectedAdicional, 2);
    });

    it('irpjAdicional is positive', () => {
      const result = calculateLucroPresumido(revenue, atividade);
      expect(result.irpjAdicional).toBeGreaterThan(0);
    });
  });
});

// ---------------------------------------------------------------------------
// SERVICOS
// ---------------------------------------------------------------------------

describe('calculateLucroPresumido — SERVICOS', () => {
  const atividade: AtividadeLP = 'SERVICOS';

  describe('Revenue R$ 50.000 / month', () => {
    const revenue = 50000;
    let result: LucroPresumidoResult;

    beforeEach(() => {
      result = calculateLucroPresumido(revenue, atividade);
    });

    it('contains all expected fields', () => {
      expectAllFields(result);
    });

    it('baseCalculo uses 32% presumption for IRPJ', () => {
      expect(result.baseCalculo).toBeCloseTo(revenue * 0.32, 2);
    });

    it('irpj is 15% on baseCalculo', () => {
      const base = revenue * 0.32;
      expect(result.irpj).toBeCloseTo(base * 0.15, 2);
    });

    it('csll uses 32% presumption at 9%', () => {
      expect(result.csll).toBeCloseTo(revenue * 0.32 * 0.09, 2);
    });

    it('pis is 0.65% of revenue', () => {
      expect(result.pis).toBeCloseTo(revenue * 0.0065, 2);
    });

    it('cofins is 3% of revenue', () => {
      expect(result.cofins).toBeCloseTo(revenue * 0.03, 2);
    });

    it('iss is 5% of revenue for SERVICOS', () => {
      expect(result.iss).toBeCloseTo(revenue * 0.05, 2);
    });
  });

  describe('Default atividade is SERVICOS', () => {
    it('matches SERVICOS result when no atividade passed', () => {
      const withDefault = calculateLucroPresumido(50000);
      const withServicos = calculateLucroPresumido(50000, 'SERVICOS');
      expect(withDefault.baseCalculo).toBeCloseTo(withServicos.baseCalculo, 2);
      expect(withDefault.irpj).toBeCloseTo(withServicos.irpj, 2);
      expect(withDefault.iss).toBeCloseTo(withServicos.iss, 2);
    });
  });

  describe('IRPJ adicional — base exceeds R$ 20.000', () => {
    // Need baseIRPJ > 20000: revenue > 62500 (20000 / 0.32)
    const revenue = 100000; // baseIRPJ = 32000

    it('irpjAdicional is 10% on excess over R$ 20.000', () => {
      const result = calculateLucroPresumido(revenue, atividade);
      const base = revenue * 0.32; // 32000
      const expectedAdicional = (base - 20000) * 0.10; // 1200
      expect(result.irpjAdicional).toBeCloseTo(expectedAdicional, 2);
    });
  });

  describe('IRPJ adicional — base exactly at R$ 20.000', () => {
    // baseIRPJ exactly = 20000: revenue = 62500
    const revenue = 62500;

    it('irpjAdicional is 0 when base equals threshold exactly', () => {
      const result = calculateLucroPresumido(revenue, atividade);
      // 62500 * 0.32 = 20000, not > 20000 so no adicional
      expect(result.irpjAdicional).toBeCloseTo(0, 2);
    });
  });
});

// ---------------------------------------------------------------------------
// MISTO
// ---------------------------------------------------------------------------

describe('calculateLucroPresumido — MISTO', () => {
  const atividade: AtividadeLP = 'MISTO';

  describe('Revenue R$ 80.000 / month', () => {
    const revenue = 80000;
    let result: LucroPresumidoResult;

    beforeEach(() => {
      result = calculateLucroPresumido(revenue, atividade);
    });

    it('contains all expected fields', () => {
      expectAllFields(result);
    });

    it('baseCalculo uses 16% presumption for IRPJ', () => {
      expect(result.baseCalculo).toBeCloseTo(revenue * 0.16, 2);
    });

    it('irpj is 15% on baseCalculo', () => {
      const base = revenue * 0.16;
      expect(result.irpj).toBeCloseTo(base * 0.15, 2);
    });

    it('csll uses 20% presumption at 9%', () => {
      expect(result.csll).toBeCloseTo(revenue * 0.20 * 0.09, 2);
    });

    it('iss is 5% of revenue (MISTO is not COMERCIO)', () => {
      expect(result.iss).toBeCloseTo(revenue * 0.05, 2);
    });

    it('irpjAdicional is 0 when baseCalculo <= 20000', () => {
      // 80000 * 0.16 = 12800 < 20000
      expect(result.irpjAdicional).toBeCloseTo(0, 2);
    });

    it('total equals sum of all components', () => {
      const expectedTotal =
        result.irpj + result.irpjAdicional + result.csll + result.pis + result.cofins + result.iss;
      expect(result.total).toBeCloseTo(expectedTotal, 2);
    });
  });

  describe('IRPJ adicional for MISTO — base exceeds R$ 20.000', () => {
    // baseIRPJ > 20000: revenue > 125000 (20000 / 0.16)
    const revenue = 200000; // baseIRPJ = 32000

    it('irpjAdicional is 10% on excess over R$ 20.000', () => {
      const result = calculateLucroPresumido(revenue, atividade);
      const base = revenue * 0.16; // 32000
      const expectedAdicional = (base - 20000) * 0.10; // 1200
      expect(result.irpjAdicional).toBeCloseTo(expectedAdicional, 2);
    });
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('calculateLucroPresumido — edge cases', () => {
  it('revenue = 0 produces all-zero taxes', () => {
    const result = calculateLucroPresumido(0, 'SERVICOS');
    expect(result.irpj).toBeCloseTo(0, 2);
    expect(result.csll).toBeCloseTo(0, 2);
    expect(result.pis).toBeCloseTo(0, 2);
    expect(result.cofins).toBeCloseTo(0, 2);
    expect(result.iss).toBeCloseTo(0, 2);
    expect(result.total).toBeCloseTo(0, 2);
  });

  it('total is always non-negative', () => {
    const result = calculateLucroPresumido(50000, 'COMERCIO');
    expect(result.total).toBeGreaterThanOrEqual(0);
  });
});
