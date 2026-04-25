import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenantsService } from './tenants.service.js';
import { UpdateTenantDto } from './dto/update-tenant.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { UserRole } from '@flux/shared';
import { AuthenticatedUser } from '../../common/types/authenticated-request.js';

@ApiTags('Tenants')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tenants')
export class TenantsController {
  constructor(private tenantsService: TenantsService) {}

  @Get('current')
  @ApiOperation({ summary: 'Get current tenant details' })
  getCurrent(@CurrentUser() user: AuthenticatedUser) {
    return this.tenantsService.findById(user.tenantId);
  }

  @Patch('current')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update tenant settings' })
  update(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateTenantDto) {
    return this.tenantsService.update(user.tenantId, dto);
  }

  @Get('current/usage')
  @ApiOperation({ summary: 'Get plan usage metrics' })
  getUsage(@CurrentUser() user: AuthenticatedUser) {
    return this.tenantsService.getUsage(user.tenantId);
  }

  @Post('onboarding/step')
  @ApiOperation({ summary: 'Progress onboarding step' })
  progressOnboarding(@CurrentUser() user: AuthenticatedUser, @Body('step') step: number) {
    return this.tenantsService.progressOnboarding(user.tenantId, step);
  }
}
