import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bull';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import Joi from 'joi';
import appConfig from './config/app.config.js';
import databaseConfig from './config/database.config.js';
import jwtConfig from './config/jwt.config.js';
import awsConfig from './config/aws.config.js';
import stripeConfig from './config/stripe.config.js';
import { PrismaModule } from './modules/prisma/prisma.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { TenantsModule } from './modules/tenants/tenants.module.js';
import { InvitesModule } from './modules/invites/invites.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, jwtConfig, awsConfig, stripeConfig],
      validationSchema: Joi.object({
        NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
        PORT: Joi.number().default(3001),
        APP_URL: Joi.string().uri().required(),
        FRONTEND_URL: Joi.string().uri().required(),
        DATABASE_URL: Joi.string().required(),
        DATABASE_MAX_CONNECTIONS: Joi.number().default(20),
        REDIS_URL: Joi.string().required(),
        JWT_SECRET: Joi.string().min(32).required(),
        JWT_EXPIRY: Joi.string().default('15m'),
        JWT_REFRESH_SECRET: Joi.string().min(32).required(),
        JWT_REFRESH_EXPIRY: Joi.string().default('7d'),
        AWS_REGION: Joi.string().required(),
        AWS_ACCESS_KEY_ID: Joi.string().required(),
        AWS_SECRET_ACCESS_KEY: Joi.string().required(),
        AWS_S3_BUCKET: Joi.string().required(),
        AWS_SES_FROM_EMAIL: Joi.string().email().required(),
        STRIPE_SECRET_KEY: Joi.string().required(),
        STRIPE_WEBHOOK_SECRET: Joi.string().required(),
        STRIPE_STARTER_PRICE_ID: Joi.string().required(),
        STRIPE_PROFESSIONAL_PRICE_ID: Joi.string().required(),
        THROTTLE_TTL_SECONDS: Joi.number().default(60),
        THROTTLE_LIMIT_PER_TENANT: Joi.number().default(100),
      }),
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
    }),

    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: config.get<number>('THROTTLE_TTL_SECONDS', 60) * 1000,
            limit: config.get<number>('THROTTLE_LIMIT_PER_TENANT', 100),
          },
        ],
        storage: new ThrottlerStorageRedisService(config.get<string>('REDIS_URL', 'redis://localhost:6379')),
        generateKey: (context: import('@nestjs/common').ExecutionContext): string => {
          const req = context.switchToHttp().getRequest<{ tenantId?: string; user?: { userId?: string } }>();
          const tenantId = req.tenantId ?? 'anonymous';
          const userId = req.user?.userId ?? 'guest';
          const route = context.switchToHttp().getRequest<{ url: string }>().url;
          return `${tenantId}:${userId}:${route}`;
        },
      }),
    }),

    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        url: config.get<string>('REDIS_URL'),
      }),
    }),

    ScheduleModule.forRoot(),

    PrismaModule,
    AuthModule,
    UsersModule,
    TenantsModule,
    InvitesModule,
  ],
})
export class AppModule {}
