import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BankAccountsService } from './bank-accounts.service.js';
import { CreateBankAccountDto } from './dto/create-bank-account.dto.js';
import { UpdateBankAccountDto } from './dto/update-bank-account.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { AuthenticatedUser } from '../../common/types/authenticated-request.js';
import { UserRole } from '@flux/shared';

@ApiTags('Bank Accounts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('bank-accounts')
export class BankAccountsController {
  constructor(private readonly bankAccountsService: BankAccountsService) {}

  @Get()
  @ApiOperation({ summary: 'List all active bank accounts' })
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.bankAccountsService.findAll(user.tenantId);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.FINANCEIRO)
  @ApiOperation({ summary: 'Create a new bank account' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateBankAccountDto) {
    return this.bankAccountsService.create(user.tenantId, dto);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get total balance across all active accounts' })
  getSummary(@CurrentUser() user: AuthenticatedUser) {
    return this.bankAccountsService.getSummary(user.tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a bank account by ID' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.bankAccountsService.findOne(user.tenantId, id);
  }

  @Patch(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.FINANCEIRO)
  @ApiOperation({ summary: 'Update a bank account' })
  update(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateBankAccountDto,
  ) {
    return this.bankAccountsService.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Soft-delete a bank account' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.bankAccountsService.remove(user.tenantId, id);
  }
}
