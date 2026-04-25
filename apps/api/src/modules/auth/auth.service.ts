import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service.js';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existingUser) throw new ConflictException('Email already in use');

    const cnpjClean = dto.cnpj.replace(/\D/g, '');

    const existingTenant = await this.prisma.tenant.findUnique({ where: { cnpj: cnpjClean } });
    if (existingTenant) throw new ConflictException('CNPJ already registered');

    const baseSlug = dto.companyName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 40);

    const slug = `${baseSlug}-${crypto.randomBytes(3).toString('hex')}`;

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const result = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          slug,
          companyName: dto.companyName,
          cnpj: cnpjClean,
          email: dto.email,
          taxRegime: dto.taxRegime ?? null,
          status: 'ONBOARDING',
          planType: 'FREE',
        },
      });

      const user = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          emailVerifyToken: crypto.randomBytes(32).toString('hex'),
        },
      });

      await tx.userTenant.create({
        data: { userId: user.id, tenantId: tenant.id, role: 'OWNER', status: 'ACTIVE' },
      });

      await tx.subscription.create({
        data: { tenantId: tenant.id, planType: 'FREE', status: 'ACTIVE' },
      });

      return { tenant, user };
    });

    const tokens = await this.generateTokens(result.user.id, result.tenant.id, 'OWNER');

    return {
      ...tokens,
      user: this.mapUser(result.user),
      tenant: this.mapTenant(result.tenant),
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email, deletedAt: null },
    });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const userTenant = await this.prisma.userTenant.findFirst({
      where: { userId: user.id, status: 'ACTIVE' },
      include: { tenant: true },
    });
    if (!userTenant) throw new UnauthorizedException('No active company found');

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = await this.generateTokens(user.id, userTenant.tenantId, userTenant.role);

    return {
      ...tokens,
      user: this.mapUser(user),
      tenant: this.mapTenant(userTenant.tenant),
    };
  }

  async refreshToken(rawToken: string) {
    const tokenHash = this.hashToken(rawToken);

    const stored = await this.prisma.refreshToken.findFirst({
      where: { tokenHash, revokedAt: null },
      include: { user: true },
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const userTenant = await this.prisma.userTenant.findFirst({
      where: { userId: stored.userId, tenantId: stored.tenantId, status: 'ACTIVE' },
      include: { tenant: true },
    });
    if (!userTenant) throw new UnauthorizedException('Session expired');

    const tokens = await this.generateTokens(stored.userId, stored.tenantId, userTenant.role);
    return {
      ...tokens,
      user: this.mapUser(stored.user),
      tenant: this.mapTenant(userTenant.tenant),
    };
  }

  async logout(rawToken: string) {
    const tokenHash = this.hashToken(rawToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { message: 'Logged out successfully' };
  }

  async verifyEmail(token: string) {
    const user = await this.prisma.user.findFirst({ where: { emailVerifyToken: token } });
    if (!user) throw new BadRequestException('Invalid verification token');
    await this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, emailVerifyToken: null },
    });
    return { message: 'Email verified successfully' };
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return { message: 'If this email exists, a reset link was sent' };

    const resetToken = crypto.randomBytes(32).toString('hex');
    await this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerifyToken: resetToken },
    });
    return { message: 'If this email exists, a reset link was sent' };
  }

  async resetPassword(token: string, newPassword: string) {
    const user = await this.prisma.user.findFirst({ where: { emailVerifyToken: token } });
    if (!user) throw new BadRequestException('Invalid or expired token');
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, emailVerifyToken: null },
    });
    return { message: 'Password reset successfully' };
  }

  async getMe(userId: string, tenantId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const userTenant = await this.prisma.userTenant.findFirst({
      where: { userId, tenantId, status: 'ACTIVE' },
      include: { tenant: { include: { subscription: true } } },
    });
    if (!userTenant) throw new NotFoundException('Tenant membership not found');

    return {
      user: this.mapUser(user),
      tenant: this.mapTenant(userTenant.tenant),
      role: userTenant.role,
      subscription: userTenant.tenant.subscription,
    };
  }

  private async generateTokens(userId: string, tenantId: string, role: string) {
    const payload = { sub: userId, tenantId, role };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.config.get('JWT_SECRET'),
      expiresIn: this.config.get('JWT_EXPIRY') ?? '15m',
    });

    const rawRefreshToken = crypto.randomBytes(64).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tenantId,
        tokenHash: this.hashToken(rawRefreshToken),
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      expiresIn: 900,
    };
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private mapUser(user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    emailVerified: boolean;
  }) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
      emailVerified: user.emailVerified,
    };
  }

  private mapTenant(tenant: {
    id: string;
    slug: string;
    companyName: string;
    cnpj: string;
    planType: string;
    status: string;
    taxRegime: string | null;
    onboardingDone: boolean;
    onboardingStep: number;
  }) {
    return {
      id: tenant.id,
      slug: tenant.slug,
      companyName: tenant.companyName,
      cnpj: tenant.cnpj,
      planType: tenant.planType,
      status: tenant.status,
      taxRegime: tenant.taxRegime,
      onboardingDone: tenant.onboardingDone,
      onboardingStep: tenant.onboardingStep,
    };
  }
}
