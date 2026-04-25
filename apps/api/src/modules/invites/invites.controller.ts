import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InvitesService } from './invites.service';
import { CreateInviteDto } from './dto/create-invite.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Invites')
@Controller('invites')
export class InvitesController {
  constructor(private invitesService: InvitesService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @Post()
  @ApiOperation({ summary: 'Send email invite to a user' })
  create(@CurrentUser() user: any, @Body() dto: CreateInviteDto) {
    return this.invitesService.create(user.tenantId, user.userId, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @Get()
  @ApiOperation({ summary: 'List all pending invites' })
  list(@CurrentUser() user: any) {
    return this.invitesService.listPending(user.tenantId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @Delete(':id')
  @ApiOperation({ summary: 'Cancel an invite' })
  cancel(@Param('id') id: string, @CurrentUser() user: any) {
    return this.invitesService.cancel(user.tenantId, id);
  }

  @Public()
  @Get('info/:token')
  @ApiOperation({ summary: 'Get invite details by token (public)' })
  getInfo(@Param('token') token: string) {
    return this.invitesService.getByToken(token);
  }

  @Public()
  @Post(':token/accept')
  @ApiOperation({ summary: 'Accept an invite' })
  accept(@Param('token') token: string, @Body() body: any) {
    return this.invitesService.accept(token, body);
  }
}
