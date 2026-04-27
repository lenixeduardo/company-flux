import { Body, Controller, Get, Headers, Post, RawBodyRequest, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { UserRole } from '@flux/shared';

@ApiTags('Billing')
@Controller('billing')
export class BillingController {
  constructor(private billing: BillingService, private config: ConfigService) {}

  @Public()
  @Get('plans')
  getPlans() { return this.billing.getPlans(); }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('subscription')
  getSubscription(@CurrentUser() user: any) {
    return this.billing.getSubscription(user.tenantId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER)
  @Post('checkout')
  createCheckout(@CurrentUser() user: any, @Body('planType') planType: string) {
    const base = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
    return this.billing.createCheckoutSession(user.tenantId, planType, `${base}/billing`, `${base}/billing`);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER)
  @Post('portal')
  createPortal(@CurrentUser() user: any) {
    const base = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
    return this.billing.createPortalSession(user.tenantId, `${base}/billing`);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER)
  @Post('cancel')
  cancel(@CurrentUser() user: any) {
    return this.billing.cancelSubscription(user.tenantId);
  }

  @Public()
  @Post('webhooks/stripe')
  webhook(@Req() req: RawBodyRequest<Request>, @Headers('stripe-signature') sig: string) {
    return this.billing.handleWebhook(req.rawBody ?? Buffer.from(''), sig);
  }
}
