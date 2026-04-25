import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

interface RequestWithTenant extends Request {
  tenantId?: string;
}

interface JwtPayload {
  tenantId?: string;
  sub?: string;
}

@Injectable()
export class TenantResolutionMiddleware implements NestMiddleware {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  use(req: RequestWithTenant, _res: Response, next: NextFunction): void {
    // 1. Check X-Tenant-Id header first
    const headerTenantId = req.headers['x-tenant-id'];
    if (headerTenantId && typeof headerTenantId === 'string') {
      req.tenantId = headerTenantId;
      next();
      return;
    }

    // 2. Parse subdomain from Host header
    const host = req.headers.host ?? '';
    const hostname = host.split(':')[0] ?? '';
    const parts = hostname.split('.');
    // e.g. tenant.flux.com → subdomain is "tenant"
    if (parts.length >= 3 && parts[0] && parts[0] !== 'www' && parts[0] !== 'api') {
      req.tenantId = parts[0];
      next();
      return;
    }

    // 3. Fall back to JWT payload
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const secret = this.configService.get<string>('JWT_SECRET');
        const payload = this.jwtService.verify<JwtPayload>(token, { secret });
        if (payload.tenantId) {
          req.tenantId = payload.tenantId;
        }
      } catch {
        // Token invalid or expired — let JwtAuthGuard handle it downstream
      }
    }

    next();
  }
}
