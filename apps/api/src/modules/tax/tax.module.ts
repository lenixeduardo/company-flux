import { Module } from '@nestjs/common';
import { TaxService } from './tax.service.js';
import { TaxController } from './tax.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  providers: [TaxService],
  controllers: [TaxController],
  exports: [TaxService],
})
export class TaxModule {}
