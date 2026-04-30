import { Body, Controller, Get, Headers, Post, RawBodyRequest, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { BillingService } from './billing.service.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';

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
  @Roles('OWNER')
  @Post('checkout')
  createCheckout(@CurrentUser() user: any, @Body('planType') planType: string) {
    const base = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
    return this.billing.createCheckoutSession(user.tenantId, planType, `${base}/billing`, `${base}/billing`);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER')
  @Post('portal')
  createPortal(@CurrentUser() user: any) {
    const base = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
    return this.billing.createPortalSession(user.tenantId, `${base}/billing`);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER')
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
