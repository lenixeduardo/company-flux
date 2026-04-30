import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { PLAN_LIMITS } from '@flux/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateInviteDto } from './dto/create-invite.dto.js';

@Injectable()
export class InvitesService {
  constructor(private prisma: PrismaService) {}

  async create(tenantId: string, invitedById: string, dto: CreateInviteDto) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const limits = PLAN_LIMITS[tenant.planType as keyof typeof PLAN_LIMITS];
    const currentCount = await this.prisma.userTenant.count({
      where: { tenantId, status: 'ACTIVE' },
    });
    if (currentCount >= limits.maxUsersPerTenant) {
      throw new ForbiddenException(
        `User limit reached for ${tenant.planType} plan. Please upgrade.`,
      );
    }

    const existingUser = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existingUser) {
      const alreadyMember = await this.prisma.userTenant.findFirst({
        where: { userId: existingUser.id, tenantId, status: 'ACTIVE' },
      });
      if (alreadyMember) throw new ConflictException('User is already a member');
    }

    await this.prisma.invite.deleteMany({
      where: { tenantId, email: dto.email, acceptedAt: null },
    });

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    return this.prisma.invite.create({
      data: {
        tenantId,
        email: dto.email,
        role: dto.role ?? 'FINANCEIRO',
        token,
        invitedById,
        expiresAt,
      },
    });
  }

  async listPending(tenantId: string) {
    return this.prisma.invite.findMany({
      where: { tenantId, acceptedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async cancel(tenantId: string, inviteId: string) {
    const invite = await this.prisma.invite.findFirst({ where: { id: inviteId, tenantId } });
    if (!invite) throw new NotFoundException('Invite not found');
    await this.prisma.invite.delete({ where: { id: inviteId } });
    return { message: 'Invite cancelled' };
  }

  async getByToken(token: string) {
    const invite = await this.prisma.invite.findUnique({
      where: { token },
      include: { tenant: { select: { companyName: true, slug: true } } },
    });
    if (!invite) throw new NotFoundException('Invite not found');
    if (invite.expiresAt < new Date()) throw new BadRequestException('Invite has expired');
    return invite;
  }

  async accept(
    token: string,
    data?: { firstName?: string; lastName?: string; password?: string },
  ) {
    const invite = await this.prisma.invite.findUnique({
      where: { token },
      include: { tenant: true },
    });

    if (!invite) throw new BadRequestException('Invalid invite link');
    if (invite.acceptedAt) throw new BadRequestException('Invite already used');
    if (invite.expiresAt < new Date()) throw new BadRequestException('Invite has expired');

    let user = await this.prisma.user.findUnique({ where: { email: invite.email } });

    if (!user) {
      if (!data?.password || !data?.firstName || !data?.lastName) {
        throw new BadRequestException('First name, last name and password are required');
      }
      const passwordHash = await bcrypt.hash(data.password, 12);
      user = await this.prisma.user.create({
        data: {
          email: invite.email,
          passwordHash,
          firstName: data.firstName,
          lastName: data.lastName,
          emailVerified: true,
        },
      });
    }

    await this.prisma.$transaction([
      this.prisma.userTenant.create({
        data: { userId: user.id, tenantId: invite.tenantId, role: invite.role, status: 'ACTIVE' },
      }),
      this.prisma.invite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } }),
    ]);

    return { message: 'Invite accepted successfully', tenant: invite.tenant };
  }
}
