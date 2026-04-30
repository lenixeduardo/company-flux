import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TaxService } from './tax.service.js';
import { CalculateTaxDto, UpdateTaxSettingsDto } from './dto/calculate-tax.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';

@ApiTags('Tax')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tax')
export class TaxController {
  constructor(private taxService: TaxService) {}

  @Post('calculate')
  @Roles('OWNER', 'ADMIN', 'FINANCEIRO')
  @ApiOperation({ summary: 'Calculate tax obligations for a period' })
  calculate(@CurrentUser() user: any, @Body() dto: CalculateTaxDto) {
    return this.taxService.calculate(user.tenantId, dto);
  }

  @Get('obligations')
  @ApiOperation({ summary: 'List tax obligations' })
  findObligations(
    @CurrentUser() user: any,
    @Query('status') status?: string,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    return this.taxService.findObligations(user.tenantId, {
      status,
      year: year ? +year : undefined,
      month: month ? +month : undefined,
    });
  }

  @Get('obligations/:id')
  @ApiOperation({ summary: 'Get tax obligation detail' })
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.taxService.findOne(user.tenantId, id);
  }

  @Post('obligations/:id/pay')
  @Roles('OWNER', 'ADMIN', 'FINANCEIRO')
  @ApiOperation({ summary: 'Mark obligation as paid' })
  markAsPaid(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Query('transactionId') transactionId?: string,
  ) {
    return this.taxService.markAsPaid(user.tenantId, id, transactionId);
  }

  @Get('calendar')
  @ApiOperation({ summary: 'Tax calendar grouped by month' })
  getCalendar(@CurrentUser() user: any, @Query('year') year?: string) {
    return this.taxService.getCalendar(
      user.tenantId,
      year ? +year : new Date().getFullYear(),
    );
  }

  @Get('alerts')
  @ApiOperation({ summary: 'Upcoming tax due dates (next 10 days)' })
  getAlerts(@CurrentUser() user: any) {
    return this.taxService.getUpcomingAlerts(user.tenantId);
  }

  @Post('settings')
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Update tax regime settings' })
  updateSettings(@CurrentUser() user: any, @Body() dto: UpdateTaxSettingsDto) {
    return this.taxService.updateSettings(user.tenantId, dto);
  }
}
