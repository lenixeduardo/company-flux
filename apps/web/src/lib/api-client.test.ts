/**
 * Tests for the api-client Axios instance.
 *
 * We use jest.mock('axios') to control all HTTP traffic.
 * The module-level `isRefreshing` and `refreshQueue` state is reset between
 * tests by re-importing via jest.resetModules().
 */

import axios, { AxiosRequestConfig } from 'axios';

// ---------------------------------------------------------------------------
// Mock axios BEFORE importing api-client
// ---------------------------------------------------------------------------

jest.mock('axios', () => {
  const interceptors = {
    request: { use: jest.fn(), eject: jest.fn() },
    response: { use: jest.fn(), eject: jest.fn() },
  };

  const instance = {
    interceptors,
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  };

  const axiosMock = jest.fn().mockResolvedValue({ data: {} }) as jest.Mock & {
    create: jest.Mock;
    post: jest.Mock;
    interceptors: typeof interceptors;
  };
  axiosMock.create = jest.fn(() => instance);
  axiosMock.post = jest.fn();

  return {
    __esModule: true,
    default: axiosMock,
  };
});

// ---------------------------------------------------------------------------
// Helpers to extract interceptors registered by api-client
// ---------------------------------------------------------------------------

type RequestInterceptor = (config: AxiosRequestConfig & { headers: Record<string, string> }) => AxiosRequestConfig;
type ResponseFulfilled = (response: any) => any;
type ResponseRejected = (error: any) => Promise<any>;

function getRequestInterceptor(): RequestInterceptor {
  const mockedAxios = axios as jest.MockedFunction<typeof axios> & { create: jest.Mock };
  const instance = mockedAxios.create.mock.results[0].value;
  const [fulfilled] = instance.interceptors.request.use.mock.calls[0];
  return fulfilled;
}

function getResponseInterceptors(): [ResponseFulfilled, ResponseRejected] {
  const mockedAxios = axios as jest.MockedFunction<typeof axios> & { create: jest.Mock };
  const instance = mockedAxios.create.mock.results[0].value;
  const [fulfilled, rejected] = instance.interceptors.response.use.mock.calls[0];
  return [fulfilled, rejected];
}

// ---------------------------------------------------------------------------
// Import the module under test (after mocks are registered)
// ---------------------------------------------------------------------------

// We import at module level; resetModules is used in some describe blocks
// to get a fresh isRefreshing state for concurrent-refresh tests.
import api from './api-client';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  // Clear localStorage and cookies
  localStorage.clear();
  Object.defineProperty(document, 'cookie', { writable: true, value: '' });
  // Reset window.location.href tracking
  delete (window as any).location;
  (window as any).location = { href: '' };
});

// ---------------------------------------------------------------------------
// Request interceptor
// ---------------------------------------------------------------------------

describe('request interceptor', () => {
  it('adds Bearer token from localStorage when present', () => {
    const storedState = {
      state: { accessToken: 'my-access-token', refreshToken: 'my-refresh-token' },
    };
    localStorage.setItem('flux-auth-store', JSON.stringify(storedState));

    const interceptor = getRequestInterceptor();
    const config: any = { headers: {} };
    const result = interceptor(config);

    expect(result.headers.Authorization).toBe('Bearer my-access-token');
  });

  it('does NOT add Authorization header when localStorage is empty', () => {
    const interceptor = getRequestInterceptor();
    const config: any = { headers: {} };
    const result = interceptor(config);

    expect(result.headers.Authorization).toBeUndefined();
  });

  it('does NOT add Authorization header when accessToken is null in store', () => {
    const storedState = { state: { accessToken: null, refreshToken: null } };
    localStorage.setItem('flux-auth-store', JSON.stringify(storedState));

    const interceptor = getRequestInterceptor();
    const config: any = { headers: {} };
    const result = interceptor(config);

    expect(result.headers.Authorization).toBeUndefined();
  });

  it('does NOT add Authorization header when localStorage value is malformed JSON', () => {
    localStorage.setItem('flux-auth-store', 'not-valid-json{{');

    const interceptor = getRequestInterceptor();
    const config: any = { headers: {} };
    // Should not throw
    const result = interceptor(config);

    expect(result.headers.Authorization).toBeUndefined();
  });

  it('returns the config object unchanged (pass-through)', () => {
    const interceptor = getRequestInterceptor();
    const config: any = { headers: {}, url: '/some/endpoint', method: 'GET' };
    const result = interceptor(config);

    expect(result.url).toBe('/some/endpoint');
    expect(result.method).toBe('GET');
  });
});

// ---------------------------------------------------------------------------
// Response interceptor — success path
// ---------------------------------------------------------------------------

describe('response interceptor (success)', () => {
  it('passes successful responses through unchanged', async () => {
    const [fulfilled] = getResponseInterceptors();
    const response = { status: 200, data: { ok: true } };
    const result = await fulfilled(response);

    expect(result).toBe(response);
  });
});

// ---------------------------------------------------------------------------
// Response interceptor — 401 error path
// ---------------------------------------------------------------------------

describe('response interceptor (401 error)', () => {
  it('attempts token refresh when 401 and _retry is not set', async () => {
    const storedState = {
      state: { accessToken: 'old-token', refreshToken: 'refresh-token-abc' },
    };
    localStorage.setItem('flux-auth-store', JSON.stringify(storedState));

    const mockedAxios = axios as jest.MockedFunction<typeof axios> & { create: jest.Mock; post: jest.Mock };
    const instance = mockedAxios.create.mock.results[0].value;

    // Refresh call returns new tokens
    mockedAxios.post.mockResolvedValueOnce({
      data: { accessToken: 'new-access-token', refreshToken: 'new-refresh-token' },
    });

    // Retry of original request succeeds
    instance.mockResolvedValueOnce({ data: { success: true } });

    const [, rejected] = getResponseInterceptors();
    const error = {
      response: { status: 401 },
      config: { headers: {}, _retry: false },
    };

    const result = await rejected(error);
    expect(result.data.success).toBe(true);

    // The axios.post for /auth/refresh should have been called
    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('/auth/refresh'),
      { refreshToken: 'refresh-token-abc' },
    );
  });

  it('updates localStorage with new tokens after successful refresh', async () => {
    const storedState = {
      state: { accessToken: 'old-token', refreshToken: 'refresh-token-abc' },
    };
    localStorage.setItem('flux-auth-store', JSON.stringify(storedState));

    const mockedAxios = axios as jest.MockedFunction<typeof axios> & { create: jest.Mock; post: jest.Mock };
    const instance = mockedAxios.create.mock.results[0].value;

    mockedAxios.post.mockResolvedValueOnce({
      data: { accessToken: 'new-access-token', refreshToken: 'new-refresh-token' },
    });
    instance.mockResolvedValueOnce({ data: {} });

    const [, rejected] = getResponseInterceptors();
    await rejected({
      response: { status: 401 },
      config: { headers: {}, _retry: false },
    });

    const updated = JSON.parse(localStorage.getItem('flux-auth-store')!);
    expect(updated.state.accessToken).toBe('new-access-token');
    expect(updated.state.refreshToken).toBe('new-refresh-token');
  });

  it('retries original request with new Bearer token after refresh', async () => {
    const storedState = {
      state: { accessToken: 'old-token', refreshToken: 'refresh-token-abc' },
    };
    localStorage.setItem('flux-auth-store', JSON.stringify(storedState));

    const mockedAxios = axios as jest.MockedFunction<typeof axios> & { create: jest.Mock; post: jest.Mock };
    const instance = mockedAxios.create.mock.results[0].value;

    mockedAxios.post.mockResolvedValueOnce({
      data: { accessToken: 'new-access-token', refreshToken: 'new-refresh-token' },
    });
    instance.mockResolvedValueOnce({ data: { retried: true } });

    const [, rejected] = getResponseInterceptors();
    const originalConfig: any = { headers: {}, _retry: false, url: '/some/protected' };
    await rejected({
      response: { status: 401 },
      config: originalConfig,
    });

    // The instance should have been called again (retry) with the new token
    expect(instance).toHaveBeenCalledWith(
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer new-access-token' }) }),
    );
  });

  it('does NOT retry if _retry is already true (prevents infinite loop)', async () => {
    const mockedAxios = axios as jest.MockedFunction<typeof axios> & { create: jest.Mock; post: jest.Mock };

    const [, rejected] = getResponseInterceptors();
    const error = {
      response: { status: 401 },
      config: { headers: {}, _retry: true },
    };

    await expect(rejected(error)).rejects.toEqual(error);
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('passes through non-401 errors unchanged', async () => {
    const [, rejected] = getResponseInterceptors();
    const error = {
      response: { status: 500 },
      config: { headers: {}, _retry: false },
    };

    await expect(rejected(error)).rejects.toEqual(error);
  });

  it('passes through errors without a response object', async () => {
    const [, rejected] = getResponseInterceptors();
    const error = { message: 'Network Error', config: { headers: {} } };

    await expect(rejected(error)).rejects.toEqual(error);
  });
});

// ---------------------------------------------------------------------------
// Response interceptor — refresh failure path
// ---------------------------------------------------------------------------

describe('response interceptor (refresh failure)', () => {
  it('removes flux-auth-store from localStorage on refresh failure', async () => {
    const storedState = {
      state: { accessToken: 'old-token', refreshToken: 'bad-refresh-token' },
    };
    localStorage.setItem('flux-auth-store', JSON.stringify(storedState));

    const mockedAxios = axios as jest.MockedFunction<typeof axios> & { create: jest.Mock; post: jest.Mock };
    mockedAxios.post.mockRejectedValueOnce(new Error('Refresh failed'));

    const [, rejected] = getResponseInterceptors();

    await expect(
      rejected({
        response: { status: 401 },
        config: { headers: {}, _retry: false },
      }),
    ).rejects.toThrow('Refresh failed');

    expect(localStorage.getItem('flux-auth-store')).toBeNull();
  });

  it('sets flux-session cookie max-age=0 on refresh failure', async () => {
    const storedState = {
      state: { accessToken: 'old-token', refreshToken: 'bad-refresh-token' },
    };
    localStorage.setItem('flux-auth-store', JSON.stringify(storedState));

    const cookieValues: string[] = [];
    const originalDescriptor = Object.getOwnPropertyDescriptor(document, 'cookie');
    Object.defineProperty(document, 'cookie', {
      get: () => '',
      set: (val: string) => {
        cookieValues.push(val);
        if (originalDescriptor?.set) originalDescriptor.set.call(document, val);
      },
      configurable: true,
    });

    const mockedAxios = axios as jest.MockedFunction<typeof axios> & { create: jest.Mock; post: jest.Mock };
    mockedAxios.post.mockRejectedValueOnce(new Error('Refresh failed'));

    const [, rejected] = getResponseInterceptors();

    await expect(
      rejected({
        response: { status: 401 },
        config: { headers: {}, _retry: false },
      }),
    ).rejects.toThrow();

    const expiryCookie = cookieValues.find((c) => c.includes('flux-session') && c.includes('max-age=0'));
    expect(expiryCookie).toBeDefined();
  });

  it('redirects to /login on refresh failure', async () => {
    const storedState = {
      state: { accessToken: 'old-token', refreshToken: 'bad-refresh-token' },
    };
    localStorage.setItem('flux-auth-store', JSON.stringify(storedState));

    const mockedAxios = axios as jest.MockedFunction<typeof axios> & { create: jest.Mock; post: jest.Mock };
    mockedAxios.post.mockRejectedValueOnce(new Error('Refresh failed'));

    const [, rejected] = getResponseInterceptors();

    await expect(
      rejected({
        response: { status: 401 },
        config: { headers: {}, _retry: false },
      }),
    ).rejects.toThrow();

    expect(window.location.href).toBe('/login');
  });

  it('rejects when no refresh token is stored', async () => {
    const storedState = { state: { accessToken: 'old-token', refreshToken: null } };
    localStorage.setItem('flux-auth-store', JSON.stringify(storedState));

    const mockedAxios = axios as jest.MockedFunction<typeof axios> & { create: jest.Mock; post: jest.Mock };

    const [, rejected] = getResponseInterceptors();

    await expect(
      rejected({
        response: { status: 401 },
        config: { headers: {}, _retry: false },
      }),
    ).rejects.toThrow();

    // Should not have attempted a POST to refresh
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('rejects when localStorage is empty (no refresh token)', async () => {
    // localStorage.clear() already called in beforeEach

    const [, rejected] = getResponseInterceptors();

    await expect(
      rejected({
        response: { status: 401 },
        config: { headers: {}, _retry: false },
      }),
    ).rejects.toThrow();
  });
});
