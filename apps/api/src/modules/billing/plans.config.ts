export enum PlanType { FREE = 'FREE', STARTER = 'STARTER', PROFESSIONAL = 'PROFESSIONAL', ENTERPRISE = 'ENTERPRISE' }

export interface PlanConfig {
  type: PlanType;
  name: string;
  price: number;
  description: string;
  features: string[];
  stripePriceIdEnvKey: string;
  highlighted?: boolean;
}

export const PLANS_CONFIG: PlanConfig[] = [
  {
    type: PlanType.FREE,
    name: 'Free',
    price: 0,
    description: 'Para começar e validar',
    stripePriceIdEnvKey: '',
    features: ['2 usuários', '100 lançamentos/mês', '1 conta bancária', '50 fornecedores', 'Fluxo de caixa básico'],
  },
  {
    type: PlanType.STARTER,
    name: 'Starter',
    price: 99,
    description: 'Para pequenas empresas',
    stripePriceIdEnvKey: 'STRIPE_STARTER_PRICE_ID',
    features: ['5 usuários', '1.000 lançamentos/mês', '3 contas bancárias', '500 fornecedores', 'Módulo fiscal', 'Conciliação bancária', 'Exportação de dados', 'Automação de regras'],
  },
  {
    type: PlanType.PROFESSIONAL,
    name: 'Professional',
    price: 299,
    description: 'Para empresas em crescimento',
    stripePriceIdEnvKey: 'STRIPE_PROFESSIONAL_PRICE_ID',
    highlighted: true,
    features: ['20 usuários', 'Lançamentos ilimitados', 'Contas ilimitadas', 'Fornecedores ilimitados', 'IA & Insights financeiros', 'API Access', 'Suporte prioritário', 'Todos os recursos Starter'],
  },
];
