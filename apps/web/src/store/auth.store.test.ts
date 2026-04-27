/**
 * Tests for the Zustand auth store.
 *
 * We import the real store and reset its state before each test using
 * setState so each test starts from a clean slate without recreating
 * the store instance (which would break the persist middleware reference).
 */

import { useAuthStore } from './auth.store';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const initialState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  tenant: null,
  role: null,
  isAuthenticated: false,
};

const mockUser = {
  id: 'user-1',
  email: 'alice@example.com',
  firstName: 'Alice',
  lastName: 'Smith',
  emailVerified: true,
};

const mockTenant = {
  id: 'tenant-1',
  slug: 'acme',
  companyName: 'Acme Corp',
  cnpj: '00.000.000/0001-00',
  planType: 'FREE',
  status: 'ACTIVE',
  onboardingDone: false,
  onboardingStep: 0,
};

// ---------------------------------------------------------------------------
// Reset store + cookie jar before each test
// ---------------------------------------------------------------------------

beforeEach(() => {
  // Reset Zustand state (keeps the same store instance)
  useAuthStore.setState(initialState);
  // Clear document.cookie
  Object.defineProperty(document, 'cookie', {
    writable: true,
    configurable: true,
    value: '',
  });
});

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

describe('initial state', () => {
  it('has isAuthenticated = false', () => {
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('has user = null', () => {
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('has accessToken = null', () => {
    expect(useAuthStore.getState().accessToken).toBeNull();
  });

  it('has refreshToken = null', () => {
    expect(useAuthStore.getState().refreshToken).toBeNull();
  });

  it('has tenant = null', () => {
    expect(useAuthStore.getState().tenant).toBeNull();
  });

  it('has role = null', () => {
    expect(useAuthStore.getState().role).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// setAuth
// ---------------------------------------------------------------------------

describe('setAuth()', () => {
  it('sets isAuthenticated to true', () => {
    useAuthStore.getState().setAuth({
      user: mockUser,
      tenant: mockTenant,
      accessToken: 'access-token-abc',
      refreshToken: 'refresh-token-xyz',
    });

    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('stores the user profile', () => {
    useAuthStore.getState().setAuth({
      user: mockUser,
      tenant: mockTenant,
      accessToken: 'access-token-abc',
      refreshToken: 'refresh-token-xyz',
    });

    expect(useAuthStore.getState().user).toEqual(mockUser);
  });

  it('stores the tenant', () => {
    useAuthStore.getState().setAuth({
      user: mockUser,
      tenant: mockTenant,
      accessToken: 'access-token-abc',
      refreshToken: 'refresh-token-xyz',
    });

    expect(useAuthStore.getState().tenant).toEqual(mockTenant);
  });

  it('stores accessToken and refreshToken', () => {
    useAuthStore.getState().setAuth({
      user: mockUser,
      tenant: mockTenant,
      accessToken: 'access-token-abc',
      refreshToken: 'refresh-token-xyz',
    });

    expect(useAuthStore.getState().accessToken).toBe('access-token-abc');
    expect(useAuthStore.getState().refreshToken).toBe('refresh-token-xyz');
  });

  it('stores role when provided', () => {
    useAuthStore.getState().setAuth({
      user: mockUser,
      tenant: mockTenant,
      accessToken: 'tok',
      refreshToken: 'ref',
      role: 'ADMIN',
    });

    expect(useAuthStore.getState().role).toBe('ADMIN');
  });

  it('sets role to null when not provided', () => {
    useAuthStore.getState().setAuth({
      user: mockUser,
      tenant: mockTenant,
      accessToken: 'tok',
      refreshToken: 'ref',
    });

    expect(useAuthStore.getState().role).toBeNull();
  });

  it('writes the flux-session cookie', () => {
    useAuthStore.getState().setAuth({
      user: mockUser,
      tenant: mockTenant,
      accessToken: 'tok',
      refreshToken: 'ref',
    });

    expect(document.cookie).toContain('flux-session');
  });
});

// ---------------------------------------------------------------------------
// clearAuth
// ---------------------------------------------------------------------------

describe('clearAuth()', () => {
  beforeEach(() => {
    // Start from an authenticated state
    useAuthStore.getState().setAuth({
      user: mockUser,
      tenant: mockTenant,
      accessToken: 'tok',
      refreshToken: 'ref',
      role: 'MEMBER',
    });
  });

  it('resets isAuthenticated to false', () => {
    useAuthStore.getState().clearAuth();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('resets user to null', () => {
    useAuthStore.getState().clearAuth();
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('resets tenant to null', () => {
    useAuthStore.getState().clearAuth();
    expect(useAuthStore.getState().tenant).toBeNull();
  });

  it('resets accessToken to null', () => {
    useAuthStore.getState().clearAuth();
    expect(useAuthStore.getState().accessToken).toBeNull();
  });

  it('resets refreshToken to null', () => {
    useAuthStore.getState().clearAuth();
    expect(useAuthStore.getState().refreshToken).toBeNull();
  });

  it('resets role to null', () => {
    useAuthStore.getState().clearAuth();
    expect(useAuthStore.getState().role).toBeNull();
  });

  it('sets flux-session cookie max-age=0 (expires the cookie)', () => {
    // Spy on the cookie setter to capture the string written
    const cookieValues: string[] = [];
    const descriptor = Object.getOwnPropertyDescriptor(document, 'cookie');
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      get: descriptor?.get ?? (() => ''),
      set: (val: string) => {
        cookieValues.push(val);
        if (descriptor?.set) descriptor.set.call(document, val);
      },
    });

    useAuthStore.getState().clearAuth();

    const expiryCookie = cookieValues.find((c) => c.includes('flux-session') && c.includes('max-age=0'));
    expect(expiryCookie).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// updateUser
// ---------------------------------------------------------------------------

describe('updateUser()', () => {
  beforeEach(() => {
    useAuthStore.getState().setAuth({
      user: mockUser,
      tenant: mockTenant,
      accessToken: 'tok',
      refreshToken: 'ref',
    });
  });

  it('updates only the specified fields', () => {
    useAuthStore.getState().updateUser({ firstName: 'Bob' });

    const user = useAuthStore.getState().user!;
    expect(user.firstName).toBe('Bob');
    // Other fields should remain unchanged
    expect(user.lastName).toBe('Smith');
    expect(user.email).toBe('alice@example.com');
  });

  it('can update multiple fields at once', () => {
    useAuthStore.getState().updateUser({ firstName: 'Carol', lastName: 'Jones' });

    const user = useAuthStore.getState().user!;
    expect(user.firstName).toBe('Carol');
    expect(user.lastName).toBe('Jones');
    expect(user.email).toBe('alice@example.com');
  });

  it('can update avatarUrl', () => {
    useAuthStore.getState().updateUser({ avatarUrl: 'https://example.com/avatar.png' });

    expect(useAuthStore.getState().user?.avatarUrl).toBe('https://example.com/avatar.png');
  });

  it('does nothing (keeps null) when user is null', () => {
    useAuthStore.setState({ user: null });
    useAuthStore.getState().updateUser({ firstName: 'Ghost' });

    expect(useAuthStore.getState().user).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// updateTenant
// ---------------------------------------------------------------------------

describe('updateTenant()', () => {
  beforeEach(() => {
    useAuthStore.getState().setAuth({
      user: mockUser,
      tenant: mockTenant,
      accessToken: 'tok',
      refreshToken: 'ref',
    });
  });

  it('updates only the specified tenant fields', () => {
    useAuthStore.getState().updateTenant({ planType: 'PROFESSIONAL' });

    const tenant = useAuthStore.getState().tenant!;
    expect(tenant.planType).toBe('PROFESSIONAL');
    // Other fields unchanged
    expect(tenant.companyName).toBe('Acme Corp');
    expect(tenant.slug).toBe('acme');
  });

  it('can update onboardingDone and onboardingStep', () => {
    useAuthStore.getState().updateTenant({ onboardingDone: true, onboardingStep: 3 });

    const tenant = useAuthStore.getState().tenant!;
    expect(tenant.onboardingDone).toBe(true);
    expect(tenant.onboardingStep).toBe(3);
  });

  it('can update companyName', () => {
    useAuthStore.getState().updateTenant({ companyName: 'New Corp' });

    expect(useAuthStore.getState().tenant?.companyName).toBe('New Corp');
  });

  it('does nothing (keeps null) when tenant is null', () => {
    useAuthStore.setState({ tenant: null });
    useAuthStore.getState().updateTenant({ planType: 'STARTER' });

    expect(useAuthStore.getState().tenant).toBeNull();
  });
});
