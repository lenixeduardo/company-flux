import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { TransactionsService } from './transactions.service.js';
import { CreateTransactionDto } from './dto/create-transaction.dto.js';
import { UpdateTransactionDto } from './dto/update-transaction.dto.js';
import { FilterTransactionsDto } from './dto/filter-transactions.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { AuthenticatedUser } from '../../common/types/authenticated-request.js';
import { UserRole } from '@flux/shared';

@ApiTags('Transactions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  @ApiOperation({ summary: 'List transactions with filtering and pagination' })
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() filter: FilterTransactionsDto) {
    return this.transactionsService.findAll(user.tenantId, filter);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN, 'FINANCEIRO' as UserRole)
  @ApiOperation({ summary: 'Create a new transaction' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateTransactionDto) {
    return this.transactionsService.create(user.tenantId, user.userId, dto);
  }

  @Get('summary')
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  @ApiOperation({ summary: 'Get income/expense summary for a period' })
  getSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.transactionsService.getSummary(user.tenantId, dateFrom, dateTo);
  }

  @Get('projection')
  @ApiQuery({ name: 'days', required: false, type: Number })
  @ApiOperation({ summary: 'Get cash flow projection for upcoming days' })
  getProjection(
    @CurrentUser() user: AuthenticatedUser,
    @Query('days') days?: string,
  ) {
    return this.transactionsService.getCashFlowProjection(
      user.tenantId,
      days ? parseInt(days, 10) : 90,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a transaction by ID' })
  findById(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.transactionsService.findById(user.tenantId, id);
  }

  @Patch(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN, 'FINANCEIRO' as UserRole)
  @ApiOperation({ summary: 'Update a transaction' })
  update(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateTransactionDto,
  ) {
    return this.transactionsService.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN, 'FINANCEIRO' as UserRole)
  @ApiOperation({ summary: 'Soft-delete a transaction' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.transactionsService.remove(user.tenantId, id);
  }

  @Post(':id/confirm')
  @Roles(UserRole.OWNER, UserRole.ADMIN, 'FINANCEIRO' as UserRole)
  @ApiOperation({ summary: 'Confirm a pending transaction' })
  confirm(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.transactionsService.confirm(user.tenantId, id);
  }
}
