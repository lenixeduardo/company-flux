import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { ROLE_HIERARCHY, UserRole } from '@flux/shared';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAllInTenant(tenantId: string) {
    return this.prisma.userTenant.findMany({
      where: { tenantId, status: 'ACTIVE' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            lastLoginAt: true,
          },
        },
      },
    });
  }

  async findById(userId: string, tenantId: string) {
    const membership = await this.prisma.userTenant.findFirst({
      where: { userId, tenantId, status: 'ACTIVE' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            lastLoginAt: true,
            createdAt: true,
          },
        },
      },
    });
    if (!membership) throw new NotFoundException('User not found in this tenant');
    return membership;
  }

  async updateRole(
    tenantId: string,
    targetUserId: string,
    newRole: UserRole,
    requestingUserId: string,
  ) {
    const requester = await this.prisma.userTenant.findFirst({
      where: { userId: requestingUserId, tenantId },
    });
    const target = await this.prisma.userTenant.findFirst({
      where: { userId: targetUserId, tenantId },
    });
    if (!requester || !target) throw new NotFoundException('User not found');

    if (requestingUserId === targetUserId) {
      throw new ForbiddenException('Cannot change own role');
    }
    if (ROLE_HIERARCHY[newRole as UserRole] >= ROLE_HIERARCHY[requester.role as UserRole]) {
      throw new ForbiddenException('Cannot assign role equal or higher than your own');
    }

    return this.prisma.userTenant.update({
      where: { id: target.id },
      data: { role: newRole },
    });
  }

  async removeFromTenant(tenantId: string, targetUserId: string, requestingUserId: string) {
    if (targetUserId === requestingUserId) {
      throw new BadRequestException('Cannot remove yourself');
    }

    const target = await this.prisma.userTenant.findFirst({
      where: { userId: targetUserId, tenantId },
    });
    if (!target) throw new NotFoundException('User not found in tenant');
    if (target.role === 'OWNER') throw new ForbiddenException('Cannot remove the owner');

    return this.prisma.userTenant.update({
      where: { id: target.id },
      data: { status: 'INACTIVE' },
    });
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    return this.prisma.user.update({ where: { id: userId }, data: dto });
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid) throw new BadRequestException('Current password is incorrect');

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });

    // Revoke all refresh tokens to force re-login on other devices
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return { message: 'Password changed successfully' };
  }
}
