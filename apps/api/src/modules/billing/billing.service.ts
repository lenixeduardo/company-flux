import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import Stripe from 'stripe';
import { PLANS_CONFIG } from './plans.config';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly stripe: Stripe;

  constructor(private prisma: PrismaService, private config: ConfigService) {
    this.stripe = new Stripe(this.config.get<string>('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2024-06-20',
    });
  }

  getPlans() {
    return PLANS_CONFIG;
  }

  async getSubscription(tenantId: string) {
    const [sub, tenant] = await Promise.all([
      this.prisma.subscription.findUnique({ where: { tenantId } }),
      this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { planType: true } }),
    ]);
    return { subscription: sub, planType: tenant?.planType ?? 'FREE' };
  }

  async createCheckoutSession(tenantId: string, planType: string, successUrl: string, cancelUrl: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const plan = PLANS_CONFIG.find((p) => p.type === planType);
    if (!plan?.stripePriceIdEnvKey) throw new NotFoundException('Plan not available for checkout');

    const priceId = this.config.get<string>(plan.stripePriceIdEnvKey);
    if (!priceId) throw new NotFoundException('Stripe price ID not configured');

    let stripeCustomerId = tenant.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await this.stripe.customers.create({
        email: tenant.email,
        name: tenant.companyName,
        metadata: { tenantId },
      });
      stripeCustomerId = customer.id;
      await this.prisma.tenant.update({ where: { id: tenantId }, data: { stripeCustomerId } });
    }

    const session = await this.stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      metadata: { tenantId, planType },
      subscription_data: { metadata: { tenantId, planType } },
      locale: 'pt-BR',
    });

    return { url: session.url, sessionId: session.id };
  }

  async createPortalSession(tenantId: string, returnUrl: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant?.stripeCustomerId) throw new NotFoundException('No Stripe customer found');

    const session = await this.stripe.billingPortal.sessions.create({
      customer: tenant.stripeCustomerId,
      return_url: returnUrl,
    });
    return { url: session.url };
  }

  async cancelSubscription(tenantId: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { tenantId } });
    if (!sub?.stripeSubscriptionId) throw new NotFoundException('No active subscription');

    await this.stripe.subscriptions.update(sub.stripeSubscriptionId, { cancel_at_period_end: true });
    return this.prisma.subscription.update({ where: { tenantId }, data: { cancelAtPeriodEnd: true } });
  }

  async handleWebhook(rawBody: Buffer, signature: string) {
    const secret = this.config.get<string>('STRIPE_WEBHOOK_SECRET') ?? '';
    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, secret);
    } catch {
      throw new Error('Invalid webhook signature');
    }

    // Idempotency check
    const existing = await this.prisma.stripeWebhookEvent.findUnique({ where: { stripeEventId: event.id } });
    if (existing?.processedAt) return { received: true };

    await this.prisma.stripeWebhookEvent.upsert({
      where: { stripeEventId: event.id },
      create: { stripeEventId: event.id, type: event.type, payload: event as any },
      update: {},
    });

    try {
      await this.processEvent(event);
      await this.prisma.stripeWebhookEvent.update({ where: { stripeEventId: event.id }, data: { processedAt: new Date() } });
    } catch (err) {
      await this.prisma.stripeWebhookEvent.update({ where: { stripeEventId: event.id }, data: { error: String(err) } });
      throw err;
    }

    return { received: true };
  }

  private async processEvent(event: Stripe.Event) {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const { tenantId, planType } = session.metadata ?? {};
        if (!tenantId || !planType) return;

        const stripeSubId = session.subscription as string;
        const stripeSub = await this.stripe.subscriptions.retrieve(stripeSubId);

        await this.prisma.$transaction([
          this.prisma.tenant.update({ where: { id: tenantId }, data: { planType: planType as any } }),
          this.prisma.subscription.upsert({
            where: { tenantId },
            create: {
              tenantId, planType: planType as any, status: 'ACTIVE',
              stripeSubscriptionId: stripeSubId,
              stripePriceId: stripeSub.items.data[0]?.price.id,
              currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
              currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
            },
            update: {
              planType: planType as any, status: 'ACTIVE',
              stripeSubscriptionId: stripeSubId,
              currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
              currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
              cancelAtPeriodEnd: false,
            },
          }),
        ]);
        this.logger.log(`Tenant ${tenantId} upgraded to ${planType}`);
        break;
      }

      case 'customer.subscription.updated': {
        const s = event.data.object as Stripe.Subscription;
        await this.prisma.subscription.updateMany({
          where: { stripeSubscriptionId: s.id },
          data: {
            status: s.status as any,
            currentPeriodStart: new Date(s.current_period_start * 1000),
            currentPeriodEnd: new Date(s.current_period_end * 1000),
            cancelAtPeriodEnd: s.cancel_at_period_end,
          },
        });
        break;
      }

      case 'customer.subscription.deleted': {
        const s = event.data.object as Stripe.Subscription;
        const tenantId = s.metadata?.tenantId;
        if (!tenantId) return;
        await this.prisma.$transaction([
          this.prisma.tenant.update({ where: { id: tenantId }, data: { planType: 'FREE' } }),
          this.prisma.subscription.updateMany({
            where: { stripeSubscriptionId: s.id },
            data: { status: 'CANCELLED', cancelledAt: new Date() },
          }),
        ]);
        break;
      }

      case 'invoice.payment_failed': {
        const inv = event.data.object as Stripe.Invoice;
        const tenant = await this.prisma.tenant.findFirst({ where: { stripeCustomerId: inv.customer as string } });
        if (tenant) {
          await this.prisma.subscription.updateMany({ where: { tenantId: tenant.id }, data: { status: 'PAST_DUE' } });
        }
        break;
      }
    }
  }
}
