import React from 'react';
import { render, screen } from '@testing-library/react';
import { PlanGate } from './PlanGate';

// Mock next/link so it renders an <a> without needing the Next.js router
jest.mock('next/link', () => {
  const MockLink = ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  );
  MockLink.displayName = 'MockLink';
  return MockLink;
});

// Mock lucide-react Lock icon
jest.mock('lucide-react', () => ({
  Lock: () => <svg data-testid="lock-icon" />,
}));

// Mock useAuthStore — individual tests override the return value via mockReturnValue
jest.mock('@/store/auth.store', () => ({
  useAuthStore: jest.fn(),
}));

// Mock @flux/shared PLAN_LIMITS with the real structure
jest.mock('@flux/shared', () => ({
  PLAN_LIMITS: {
    FREE: {
      maxUsersPerTenant: 2,
      maxTransactionsPerMonth: 100,
      maxBankAccounts: 1,
      maxSuppliersTotal: 50,
      maxInvoicesPerMonth: 10,
      hasAiInsights: false,
      hasAutomationRules: false,
      hasRecurring: false,
      hasExport: false,
      hasTaxModule: false,
      hasBankReconciliation: false,
      hasApiAccess: false,
    },
    STARTER: {
      maxUsersPerTenant: 5,
      maxTransactionsPerMonth: 1000,
      maxBankAccounts: 3,
      maxSuppliersTotal: 500,
      maxInvoicesPerMonth: 100,
      hasAiInsights: false,
      hasAutomationRules: true,
      hasRecurring: true,
      hasExport: true,
      hasTaxModule: true,
      hasBankReconciliation: true,
      hasApiAccess: false,
    },
    PROFESSIONAL: {
      maxUsersPerTenant: 20,
      maxTransactionsPerMonth: Infinity,
      maxBankAccounts: Infinity,
      maxSuppliersTotal: Infinity,
      maxInvoicesPerMonth: Infinity,
      hasAiInsights: true,
      hasAutomationRules: true,
      hasRecurring: true,
      hasExport: true,
      hasTaxModule: true,
      hasBankReconciliation: true,
      hasApiAccess: true,
    },
    ENTERPRISE: {
      maxUsersPerTenant: Infinity,
      maxTransactionsPerMonth: Infinity,
      maxBankAccounts: Infinity,
      maxSuppliersTotal: Infinity,
      maxInvoicesPerMonth: Infinity,
      hasAiInsights: true,
      hasAutomationRules: true,
      hasRecurring: true,
      hasExport: true,
      hasTaxModule: true,
      hasBankReconciliation: true,
      hasApiAccess: true,
    },
  },
}));

// Import after mocks are set up
import { useAuthStore } from '@/store/auth.store';

const mockUseAuthStore = useAuthStore as jest.MockedFunction<typeof useAuthStore>;

function makeTenant(planType: string) {
  return {
    id: 'tenant-1',
    slug: 'acme',
    companyName: 'Acme Corp',
    cnpj: '00.000.000/0001-00',
    planType,
    status: 'ACTIVE',
    onboardingDone: true,
    onboardingStep: 0,
  };
}

describe('PlanGate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('when the plan HAS the requested feature', () => {
    it('renders children directly without blur overlay (PROFESSIONAL + hasAiInsights)', () => {
      mockUseAuthStore.mockReturnValue({ tenant: makeTenant('PROFESSIONAL') } as any);

      render(
        <PlanGate feature="hasAiInsights">
          <span>AI Insights content</span>
        </PlanGate>,
      );

      expect(screen.getByText('AI Insights content')).toBeInTheDocument();
      // No upgrade link should be present
      expect(screen.queryByRole('link', { name: /ver planos/i })).not.toBeInTheDocument();
      // No lock icon
      expect(screen.queryByTestId('lock-icon')).not.toBeInTheDocument();
    });

    it('renders children directly without blur overlay (STARTER + hasExport)', () => {
      mockUseAuthStore.mockReturnValue({ tenant: makeTenant('STARTER') } as any);

      render(
        <PlanGate feature="hasExport">
          <span>Export content</span>
        </PlanGate>,
      );

      expect(screen.getByText('Export content')).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /ver planos/i })).not.toBeInTheDocument();
    });

    it('renders children directly without blur overlay (ENTERPRISE + hasApiAccess)', () => {
      mockUseAuthStore.mockReturnValue({ tenant: makeTenant('ENTERPRISE') } as any);

      render(
        <PlanGate feature="hasApiAccess">
          <span>API Access content</span>
        </PlanGate>,
      );

      expect(screen.getByText('API Access content')).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /ver planos/i })).not.toBeInTheDocument();
    });
  });

  describe('when the plan LACKS the requested feature', () => {
    it('shows blur overlay and upgrade link for FREE plan missing hasAiInsights', () => {
      mockUseAuthStore.mockReturnValue({ tenant: makeTenant('FREE') } as any);

      render(
        <PlanGate feature="hasAiInsights">
          <span>AI Insights content</span>
        </PlanGate>,
      );

      // Children are still rendered but behind the blur overlay
      expect(screen.getByText('AI Insights content')).toBeInTheDocument();

      // Lock icon should appear
      expect(screen.getByTestId('lock-icon')).toBeInTheDocument();

      // Upgrade link to /billing should be present
      const upgradeLink = screen.getByRole('link', { name: /ver planos/i });
      expect(upgradeLink).toBeInTheDocument();
      expect(upgradeLink).toHaveAttribute('href', '/billing');

      // Upgrade message text
      expect(
        screen.getByText(/disponível nos planos starter e professional/i),
      ).toBeInTheDocument();
    });

    it('shows blur overlay and upgrade link for FREE plan missing hasExport', () => {
      mockUseAuthStore.mockReturnValue({ tenant: makeTenant('FREE') } as any);

      render(
        <PlanGate feature="hasExport">
          <span>Export button</span>
        </PlanGate>,
      );

      expect(screen.getByText('Export button')).toBeInTheDocument();
      expect(screen.getByTestId('lock-icon')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /ver planos/i })).toHaveAttribute('href', '/billing');
    });

    it('shows blur overlay and upgrade link for FREE plan missing hasAutomationRules', () => {
      mockUseAuthStore.mockReturnValue({ tenant: makeTenant('FREE') } as any);

      render(
        <PlanGate feature="hasAutomationRules">
          <span>Automation Rules content</span>
        </PlanGate>,
      );

      expect(screen.getByTestId('lock-icon')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /ver planos/i })).toBeInTheDocument();
    });

    it('shows blur overlay when tenant is null (defaults to FREE)', () => {
      mockUseAuthStore.mockReturnValue({ tenant: null } as any);

      render(
        <PlanGate feature="hasAiInsights">
          <span>Protected content</span>
        </PlanGate>,
      );

      expect(screen.getByTestId('lock-icon')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /ver planos/i })).toBeInTheDocument();
    });
  });

  describe('when a fallback prop is provided', () => {
    it('renders the fallback instead of the blur overlay when plan lacks feature', () => {
      mockUseAuthStore.mockReturnValue({ tenant: makeTenant('FREE') } as any);

      render(
        <PlanGate feature="hasAiInsights" fallback={<span>Upgrade required</span>}>
          <span>AI Insights content</span>
        </PlanGate>,
      );

      // Fallback is rendered
      expect(screen.getByText('Upgrade required')).toBeInTheDocument();

      // Default overlay elements should NOT be present
      expect(screen.queryByTestId('lock-icon')).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /ver planos/i })).not.toBeInTheDocument();
    });

    it('ignores the fallback when the plan HAS the feature', () => {
      mockUseAuthStore.mockReturnValue({ tenant: makeTenant('PROFESSIONAL') } as any);

      render(
        <PlanGate feature="hasAiInsights" fallback={<span>Upgrade required</span>}>
          <span>AI Insights content</span>
        </PlanGate>,
      );

      expect(screen.getByText('AI Insights content')).toBeInTheDocument();
      expect(screen.queryByText('Upgrade required')).not.toBeInTheDocument();
    });
  });

  describe('numeric feature flags (truthy/falsy values)', () => {
    it('treats a non-zero numeric limit as truthy (hasAccess=true)', () => {
      // maxBankAccounts = 3 for STARTER → truthy
      mockUseAuthStore.mockReturnValue({ tenant: makeTenant('STARTER') } as any);

      render(
        <PlanGate feature="maxBankAccounts">
          <span>Bank accounts feature</span>
        </PlanGate>,
      );

      expect(screen.getByText('Bank accounts feature')).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /ver planos/i })).not.toBeInTheDocument();
    });
  });
});
