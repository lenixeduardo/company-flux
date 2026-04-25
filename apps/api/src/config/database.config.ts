import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  url: process.env['DATABASE_URL'],
  maxConnections: parseInt(process.env['DATABASE_MAX_CONNECTIONS'] ?? '20', 10),
}));
