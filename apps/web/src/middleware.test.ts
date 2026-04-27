/**
 * Tests for the Next.js edge middleware.
 *
 * We mock NextRequest / NextResponse from 'next/server' so tests can run
 * inside Jest (jsdom / Node) without an actual Next.js runtime.
 */

// ---------------------------------------------------------------------------
// Mocks — must appear before any import of the module under test
// ---------------------------------------------------------------------------

const mockRedirect = jest.fn();
const mockNext = jest.fn();
const mockCloneUrl = jest.fn();

jest.mock('next/server', () => {
  class MockURL {
    pathname: string;
    searchParams: URLSearchParams;
    href: string;

    constructor(urlOrPath: string, base?: string) {
      // If base is provided, resolve relative to it
      if (base) {
        const baseUrl = base.startsWith('http') ? new URL(base) : new URL('http://localhost' + base);
        const resolved = new URL(urlOrPath, baseUrl);
        this.pathname = resolved.pathname;
        this.searchParams = resolved.searchParams;
        this.href = resolved.href;
      } else if (urlOrPath.startsWith('http')) {
        const parsed = new URL(urlOrPath);
        this.pathname = parsed.pathname;
        this.searchParams = parsed.searchParams;
        this.href = parsed.href;
      } else {
        this.pathname = urlOrPath;
        this.searchParams = new URLSearchParams();
        this.href = 'http://localhost' + urlOrPath;
      }
    }

    clone() {
      const cloned = new MockURL(this.href);
      mockCloneUrl(this.href);
      return cloned;
    }

    toString() {
      return this.href;
    }
  }

  class MockNextRequest {
    nextUrl: MockURL;
    url: string;
    private _cookies: Map<string, string>;

    constructor(url: string, cookies: Record<string, string> = {}) {
      this.url = url.startsWith('http') ? url : 'http://localhost' + url;
      this.nextUrl = new MockURL(this.url);
      this._cookies = new Map(Object.entries(cookies));
    }

    get cookies() {
      return {
        has: (name: string) => this._cookies.has(name),
        get: (name: string) => this._cookies.get(name),
      };
    }
  }

  const MockNextResponse = {
    next: jest.fn(() => ({ type: 'next' })),
    redirect: jest.fn((url: MockURL | string) => ({ type: 'redirect', url })),
  };

  return {
    NextRequest: MockNextRequest,
    NextResponse: MockNextResponse,
  };
});

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { middleware } from './middleware';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(path: string, cookies: Record<string, string> = {}): InstanceType<typeof NextRequest> {
  // @ts-expect-error — MockNextRequest matches the shape the middleware uses
  return new NextRequest('http://localhost' + path, cookies);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (NextResponse.next as jest.Mock).mockReturnValue({ type: 'next' });
    (NextResponse.redirect as jest.Mock).mockImplementation((url) => ({ type: 'redirect', url }));
  });

  // -------------------------------------------------------------------------
  // ALWAYS_PUBLIC paths — must always pass through
  // -------------------------------------------------------------------------

  describe('ALWAYS_PUBLIC paths', () => {
    it('passes through /_next/static/chunk.js without checking session', () => {
      const req = makeRequest('/_next/static/chunk.js');
      middleware(req);

      expect(NextResponse.next).toHaveBeenCalledTimes(1);
      expect(NextResponse.redirect).not.toHaveBeenCalled();
    });

    it('passes through /_next/image/foo without checking session', () => {
      const req = makeRequest('/_next/image/foo');
      middleware(req);

      expect(NextResponse.next).toHaveBeenCalledTimes(1);
      expect(NextResponse.redirect).not.toHaveBeenCalled();
    });

    it('passes through /favicon.ico', () => {
      const req = makeRequest('/favicon.ico');
      middleware(req);

      expect(NextResponse.next).toHaveBeenCalledTimes(1);
      expect(NextResponse.redirect).not.toHaveBeenCalled();
    });

    it('passes through /api/webhooks/stripe', () => {
      const req = makeRequest('/api/webhooks/stripe');
      middleware(req);

      expect(NextResponse.next).toHaveBeenCalledTimes(1);
      expect(NextResponse.redirect).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Unauthenticated requests (no flux-session cookie)
  // -------------------------------------------------------------------------

  describe('unauthenticated requests', () => {
    it('redirects / to /login?next=/', () => {
      const req = makeRequest('/');
      const result = middleware(req) as any;

      expect(NextResponse.redirect).toHaveBeenCalledTimes(1);
      const redirectUrl = (NextResponse.redirect as jest.Mock).mock.calls[0][0];
      expect(redirectUrl.pathname).toBe('/login');
      expect(redirectUrl.searchParams.get('next')).toBe('/');
    });

    it('redirects /dashboard to /login?next=/dashboard', () => {
      const req = makeRequest('/dashboard');
      middleware(req);

      expect(NextResponse.redirect).toHaveBeenCalledTimes(1);
      const redirectUrl = (NextResponse.redirect as jest.Mock).mock.calls[0][0];
      expect(redirectUrl.pathname).toBe('/login');
      expect(redirectUrl.searchParams.get('next')).toBe('/dashboard');
    });

    it('passes through /login (public auth page)', () => {
      const req = makeRequest('/login');
      middleware(req);

      expect(NextResponse.next).toHaveBeenCalledTimes(1);
      expect(NextResponse.redirect).not.toHaveBeenCalled();
    });

    it('passes through /register (public auth page)', () => {
      const req = makeRequest('/register');
      middleware(req);

      expect(NextResponse.next).toHaveBeenCalledTimes(1);
      expect(NextResponse.redirect).not.toHaveBeenCalled();
    });

    it('passes through /forgot-password (public auth page)', () => {
      const req = makeRequest('/forgot-password');
      middleware(req);

      expect(NextResponse.next).toHaveBeenCalledTimes(1);
      expect(NextResponse.redirect).not.toHaveBeenCalled();
    });

    it('passes through /invite/abc (public invite path)', () => {
      const req = makeRequest('/invite/abc');
      middleware(req);

      expect(NextResponse.next).toHaveBeenCalledTimes(1);
      expect(NextResponse.redirect).not.toHaveBeenCalled();
    });

    it('passes through /invite/token-xyz (public invite path)', () => {
      const req = makeRequest('/invite/token-xyz');
      middleware(req);

      expect(NextResponse.next).toHaveBeenCalledTimes(1);
      expect(NextResponse.redirect).not.toHaveBeenCalled();
    });

    it('redirects protected nested route /settings/profile to /login', () => {
      const req = makeRequest('/settings/profile');
      middleware(req);

      expect(NextResponse.redirect).toHaveBeenCalledTimes(1);
      const redirectUrl = (NextResponse.redirect as jest.Mock).mock.calls[0][0];
      expect(redirectUrl.pathname).toBe('/login');
      expect(redirectUrl.searchParams.get('next')).toBe('/settings/profile');
    });
  });

  // -------------------------------------------------------------------------
  // Authenticated requests (has flux-session cookie)
  // -------------------------------------------------------------------------

  describe('authenticated requests', () => {
    const withSession = { 'flux-session': '1' };

    it('redirects /login to / when already authenticated', () => {
      const req = makeRequest('/login', withSession);
      middleware(req);

      expect(NextResponse.redirect).toHaveBeenCalledTimes(1);
      const redirectUrl = (NextResponse.redirect as jest.Mock).mock.calls[0][0];
      expect(redirectUrl.toString()).toContain('/');
    });

    it('redirects /register to / when already authenticated', () => {
      const req = makeRequest('/register', withSession);
      middleware(req);

      expect(NextResponse.redirect).toHaveBeenCalledTimes(1);
    });

    it('redirects /forgot-password to / when already authenticated', () => {
      const req = makeRequest('/forgot-password', withSession);
      middleware(req);

      expect(NextResponse.redirect).toHaveBeenCalledTimes(1);
    });

    it('passes through / when authenticated', () => {
      const req = makeRequest('/', withSession);
      middleware(req);

      expect(NextResponse.next).toHaveBeenCalledTimes(1);
      expect(NextResponse.redirect).not.toHaveBeenCalled();
    });

    it('passes through /dashboard when authenticated', () => {
      const req = makeRequest('/dashboard', withSession);
      middleware(req);

      expect(NextResponse.next).toHaveBeenCalledTimes(1);
      expect(NextResponse.redirect).not.toHaveBeenCalled();
    });

    it('passes through /settings when authenticated', () => {
      const req = makeRequest('/settings', withSession);
      middleware(req);

      expect(NextResponse.next).toHaveBeenCalledTimes(1);
      expect(NextResponse.redirect).not.toHaveBeenCalled();
    });

    it('passes through /invite/abc when authenticated (invite paths are always public)', () => {
      const req = makeRequest('/invite/abc', withSession);
      middleware(req);

      // Not an auth page, and it's public — should just pass through
      expect(NextResponse.next).toHaveBeenCalledTimes(1);
      expect(NextResponse.redirect).not.toHaveBeenCalled();
    });

    it('passes through /onboarding when authenticated', () => {
      const req = makeRequest('/onboarding', withSession);
      middleware(req);

      expect(NextResponse.next).toHaveBeenCalledTimes(1);
      expect(NextResponse.redirect).not.toHaveBeenCalled();
    });
  });
});
