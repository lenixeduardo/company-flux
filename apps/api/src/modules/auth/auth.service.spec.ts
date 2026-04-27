import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

// ---------------------------------------------------------------------------
// Mock bcrypt — must be hoisted before imports are resolved
// ---------------------------------------------------------------------------
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('$hashed'),
  compare: jest.fn().mockResolvedValue(true),
}));

// ---------------------------------------------------------------------------
// Mock crypto to make tokens deterministic
// ---------------------------------------------------------------------------
jest.mock('crypto', () => {
  const actual = jest.requireActual<typeof import('crypto')>('crypto');
  return {
    ...actual,
    randomBytes: jest.fn().mockReturnValue({
      toString: jest.fn().mockReturnValue('mocked_random_hex'),
    }),
  };
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockUserId = 'user-uuid-1';
const mockTenantId = 'tenant-uuid-1';

const mockUser = {
  id: mockUserId,
  email: 'test@example.com',
  passwordHash: '$hashed',
  firstName: 'Jane',
  lastName: 'Doe',
  avatarUrl: null,
  emailVerified: false,
  emailVerifyToken: 'verify_token',
  lastLoginAt: null,
  deletedAt: null,
};

const mockTenant = {
  id: mockTenantId,
  slug: 'test-company-abc123',
  companyName: 'Test Company',
  cnpj: '12345678000195',
  email: 'test@example.com',
  planType: 'FREE',
  status: 'ONBOARDING',
  taxRegime: null,
  onboardingDone: false,
  onboardingStep: 0,
  subscription: { id: 'sub-1', planType: 'FREE', status: 'ACTIVE' },
};

const mockUserTenant = {
  userId: mockUserId,
  tenantId: mockTenantId,
  role: 'OWNER',
  status: 'ACTIVE',
  tenant: mockTenant,
};

const mockRefreshToken = {
  id: 'rt-uuid-1',
  userId: mockUserId,
  tenantId: mockTenantId,
  tokenHash: 'hashed_token',
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  revokedAt: null,
  user: mockUser,
};

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const prismaMock = {
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  tenant: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  userTenant: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  subscription: {
    create: jest.fn(),
  },
  refreshToken: {
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  $transaction: jest.fn(),
};

const jwtMock = {
  sign: jest.fn().mockReturnValue('mock_access_token'),
};

const configMock = {
  get: jest.fn().mockImplementation((key: string) => {
    const values: Record<string, string> = {
      JWT_SECRET: 'test-secret',
      JWT_EXPIRY: '15m',
    };
    return values[key] ?? null;
  }),
};

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: JwtService, useValue: jwtMock },
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);

    // Default $transaction implementation that runs the callback with prismaMock
    prismaMock.$transaction.mockImplementation(
      (cb: (tx: typeof prismaMock) => Promise<unknown>) => cb(prismaMock),
    );
  });

  // -------------------------------------------------------------------------
  // register()
  // -------------------------------------------------------------------------

  describe('register()', () => {
    const registerDto = {
      email: 'jane@example.com',
      password: 'Password1',
      firstName: 'Jane',
      lastName: 'Doe',
      companyName: 'Test Company',
      cnpj: '12.345.678/0001-95',
    };

    beforeEach(() => {
      // Happy-path defaults
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.tenant.findUnique.mockResolvedValue(null);
      prismaMock.tenant.create.mockResolvedValue(mockTenant);
      prismaMock.user.create.mockResolvedValue(mockUser);
      prismaMock.userTenant.create.mockResolvedValue(mockUserTenant);
      prismaMock.subscription.create.mockResolvedValue({ id: 'sub-1' });
      prismaMock.refreshToken.create.mockResolvedValue(mockRefreshToken);
    });

    it('creates tenant and user, returns accessToken and refreshToken', async () => {
      const result = await service.register(registerDto);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.accessToken).toBe('mock_access_token');
    });

    it('returns mapped user object', async () => {
      const result = await service.register(registerDto);

      expect(result.user).toMatchObject({
        id: mockUser.id,
        email: mockUser.email,
        firstName: mockUser.firstName,
        lastName: mockUser.lastName,
      });
    });

    it('returns mapped tenant object', async () => {
      const result = await service.register(registerDto);

      expect(result.tenant).toMatchObject({
        id: mockTenant.id,
        companyName: mockTenant.companyName,
      });
    });

    it('throws ConflictException when email already in use', async () => {
      prismaMock.user.findUnique.mockResolvedValue(mockUser);

      await expect(service.register(registerDto)).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException with correct message for duplicate email', async () => {
      prismaMock.user.findUnique.mockResolvedValue(mockUser);

      await expect(service.register(registerDto)).rejects.toThrow('Email already in use');
    });

    it('throws ConflictException when CNPJ already registered', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.tenant.findUnique.mockResolvedValue(mockTenant);

      await expect(service.register(registerDto)).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException with correct message for duplicate CNPJ', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.tenant.findUnique.mockResolvedValue(mockTenant);

      await expect(service.register(registerDto)).rejects.toThrow('CNPJ already registered');
    });

    it('strips non-digits from CNPJ before checking uniqueness', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.tenant.findUnique.mockResolvedValue(null);
      prismaMock.tenant.create.mockResolvedValue(mockTenant);
      prismaMock.user.create.mockResolvedValue(mockUser);
      prismaMock.userTenant.create.mockResolvedValue(mockUserTenant);
      prismaMock.subscription.create.mockResolvedValue({ id: 'sub-1' });
      prismaMock.refreshToken.create.mockResolvedValue(mockRefreshToken);

      await service.register(registerDto);

      expect(prismaMock.tenant.findUnique).toHaveBeenCalledWith({
        where: { cnpj: '12345678000195' },
      });
    });

    it('calls prisma.$transaction', async () => {
      await service.register(registerDto);
      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // login()
  // -------------------------------------------------------------------------

  describe('login()', () => {
    const loginDto = {
      email: 'jane@example.com',
      password: 'Password1',
    };

    beforeEach(() => {
      prismaMock.user.findFirst.mockResolvedValue(mockUser);
      prismaMock.userTenant.findFirst.mockResolvedValue(mockUserTenant);
      prismaMock.user.update.mockResolvedValue(mockUser);
      prismaMock.refreshToken.create.mockResolvedValue(mockRefreshToken);
    });

    it('returns accessToken and refreshToken on valid credentials', async () => {
      const bcrypt = jest.requireMock<{ compare: jest.Mock }>('bcrypt');
      bcrypt.compare.mockResolvedValue(true);

      const result = await service.login(loginDto);

      expect(result).toHaveProperty('accessToken', 'mock_access_token');
      expect(result).toHaveProperty('refreshToken');
    });

    it('returns mapped user and tenant', async () => {
      const bcrypt = jest.requireMock<{ compare: jest.Mock }>('bcrypt');
      bcrypt.compare.mockResolvedValue(true);

      const result = await service.login(loginDto);

      expect(result.user).toMatchObject({ email: mockUser.email });
      expect(result.tenant).toMatchObject({ id: mockTenant.id });
    });

    it('throws UnauthorizedException when user not found', async () => {
      prismaMock.user.findFirst.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException with message when user not found', async () => {
      prismaMock.user.findFirst.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow('Invalid credentials');
    });

    it('throws UnauthorizedException when password is wrong', async () => {
      const bcrypt = jest.requireMock<{ compare: jest.Mock }>('bcrypt');
      bcrypt.compare.mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when no active tenant membership', async () => {
      const bcrypt = jest.requireMock<{ compare: jest.Mock }>('bcrypt');
      bcrypt.compare.mockResolvedValue(true);
      prismaMock.userTenant.findFirst.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException with correct message when no company', async () => {
      const bcrypt = jest.requireMock<{ compare: jest.Mock }>('bcrypt');
      bcrypt.compare.mockResolvedValue(true);
      prismaMock.userTenant.findFirst.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow('No active company found');
    });

    it('updates lastLoginAt on successful login', async () => {
      const bcrypt = jest.requireMock<{ compare: jest.Mock }>('bcrypt');
      bcrypt.compare.mockResolvedValue(true);

      await service.login(loginDto);

      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockUser.id },
          data: expect.objectContaining({ lastLoginAt: expect.any(Date) }),
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // logout()
  // -------------------------------------------------------------------------

  describe('logout()', () => {
    beforeEach(() => {
      prismaMock.refreshToken.updateMany.mockResolvedValue({ count: 1 });
    });

    it('calls prisma.refreshToken.updateMany to revoke token', async () => {
      await service.logout('some_raw_token');

      expect(prismaMock.refreshToken.updateMany).toHaveBeenCalledTimes(1);
      expect(prismaMock.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ revokedAt: null }),
          data: expect.objectContaining({ revokedAt: expect.any(Date) }),
        }),
      );
    });

    it('returns success message', async () => {
      const result = await service.logout('some_raw_token');

      expect(result).toEqual({ message: 'Logged out successfully' });
    });

    it('hashes the raw token before querying DB', async () => {
      const rawToken = 'my_raw_refresh_token';
      await service.logout(rawToken);

      const callArgs = prismaMock.refreshToken.updateMany.mock.calls[0][0] as {
        where: { tokenHash: string };
      };
      // The tokenHash should not equal the raw token (it should be hashed)
      expect(callArgs.where.tokenHash).not.toBe(rawToken);
      // Should be a 64-char hex string (SHA-256)
      expect(callArgs.where.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  // -------------------------------------------------------------------------
  // generateTokens() indirectly via register()
  // -------------------------------------------------------------------------

  describe('token generation (via register)', () => {
    beforeEach(() => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.tenant.findUnique.mockResolvedValue(null);
      prismaMock.tenant.create.mockResolvedValue(mockTenant);
      prismaMock.user.create.mockResolvedValue(mockUser);
      prismaMock.userTenant.create.mockResolvedValue(mockUserTenant);
      prismaMock.subscription.create.mockResolvedValue({ id: 'sub-1' });
      prismaMock.refreshToken.create.mockResolvedValue(mockRefreshToken);
    });

    it('stores a refresh token record in DB', async () => {
      await service.register({
        email: 'a@b.com',
        password: 'Password1',
        firstName: 'A',
        lastName: 'B',
        companyName: 'Company',
        cnpj: '12345678000195',
      });

      expect(prismaMock.refreshToken.create).toHaveBeenCalledTimes(1);
      expect(prismaMock.refreshToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: mockUser.id,
            tenantId: mockTenant.id,
            expiresAt: expect.any(Date),
          }),
        }),
      );
    });

    it('signs JWT with correct payload', async () => {
      await service.register({
        email: 'a@b.com',
        password: 'Password1',
        firstName: 'A',
        lastName: 'B',
        companyName: 'Company',
        cnpj: '12345678000195',
      });

      expect(jwtMock.sign).toHaveBeenCalledWith(
        expect.objectContaining({ sub: mockUser.id, tenantId: mockTenant.id }),
        expect.objectContaining({ secret: 'test-secret' }),
      );
    });
  });
});
