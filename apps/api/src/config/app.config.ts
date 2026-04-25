import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  nodeEnv: process.env['NODE_ENV'] ?? 'development',
  port: parseInt(process.env['PORT'] ?? '3001', 10),
  appUrl: process.env['APP_URL'] ?? 'http://localhost:3001',
  frontendUrl: process.env['FRONTEND_URL'] ?? 'http://localhost:3000',
  apiPrefix: process.env['API_PREFIX'] ?? 'api/v1',
}));
