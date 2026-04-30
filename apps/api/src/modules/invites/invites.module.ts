import { Module } from '@nestjs/common';
import { InvitesService } from './invites.service.js';
import { InvitesController } from './invites.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  providers: [InvitesService],
  controllers: [InvitesController],
  exports: [InvitesService],
})
export class InvitesModule {}
