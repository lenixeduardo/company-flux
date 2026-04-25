import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SuppliersService } from './suppliers.service.js';
import { CreateSupplierDto } from './dto/create-supplier.dto.js';
import { UpdateSupplierDto } from './dto/update-supplier.dto.js';
import { FilterSuppliersDto } from './dto/filter-suppliers.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { AuthenticatedUser } from '../../common/types/authenticated-request.js';
import { UserRole } from '@flux/shared';

@ApiTags('Suppliers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Get()
  @ApiOperation({ summary: 'List suppliers with filtering and pagination' })
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() filters: FilterSuppliersDto) {
    return this.suppliersService.findAll(user.tenantId, filters);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.FINANCEIRO)
  @ApiOperation({ summary: 'Create a new supplier' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateSupplierDto) {
    return this.suppliersService.create(user.tenantId, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a supplier by ID' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.suppliersService.findOne(user.tenantId, id);
  }

  @Patch(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.FINANCEIRO)
  @ApiOperation({ summary: 'Update a supplier' })
  update(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateSupplierDto,
  ) {
    return this.suppliersService.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Soft-delete a supplier' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.suppliersService.remove(user.tenantId, id);
  }

  @Get(':id/payment-history')
  @ApiOperation({ summary: 'Get payment history for a supplier' })
  getPaymentHistory(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.suppliersService.getPaymentHistory(user.tenantId, id);
  }
}
