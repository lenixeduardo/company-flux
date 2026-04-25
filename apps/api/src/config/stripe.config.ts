import { registerAs } from '@nestjs/config';

export default registerAs('stripe', () => ({
  secretKey: process.env['STRIPE_SECRET_KEY'],
  webhookSecret: process.env['STRIPE_WEBHOOK_SECRET'],
  starterPriceId: process.env['STRIPE_STARTER_PRICE_ID'],
  professionalPriceId: process.env['STRIPE_PROFESSIONAL_PRICE_ID'],
}));
