import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { AuthenticatedUser } from '../../common/types/authenticated-request.js';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Get financial summary for a given month' })
  @ApiQuery({ name: 'year', required: false, type: Number })
  @ApiQuery({ name: 'month', required: false, type: Number })
  getSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    const now = new Date();
    const y = year ? parseInt(year, 10) : now.getFullYear();
    const m = month ? parseInt(month, 10) : now.getMonth() + 1;
    return this.dashboardService.getSummary(user.tenantId, y, m);
  }

  @Get('monthly-comparison')
  @ApiOperation({ summary: 'Get income vs expense for the last N months' })
  @ApiQuery({ name: 'months', required: false, type: Number })
  getMonthlyComparison(
    @CurrentUser() user: AuthenticatedUser,
    @Query('months') months?: string,
  ) {
    const m = months ? parseInt(months, 10) : 6;
    return this.dashboardService.getMonthlyComparison(user.tenantId, m);
  }

  @Get('category-breakdown')
  @ApiOperation({ summary: 'Get transaction totals grouped by category' })
  @ApiQuery({ name: 'type', required: true, enum: ['INCOME', 'EXPENSE'] })
  @ApiQuery({ name: 'year', required: false, type: Number })
  @ApiQuery({ name: 'month', required: false, type: Number })
  getCategoryBreakdown(
    @CurrentUser() user: AuthenticatedUser,
    @Query('type') type: 'INCOME' | 'EXPENSE',
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    const now = new Date();
    const y = year ? parseInt(year, 10) : now.getFullYear();
    const m = month ? parseInt(month, 10) : now.getMonth() + 1;
    return this.dashboardService.getCategoryBreakdown(user.tenantId, type ?? 'EXPENSE', y, m);
  }

  @Get('upcoming')
  @ApiOperation({ summary: 'Get upcoming pending transactions within N days' })
  @ApiQuery({ name: 'days', required: false, type: Number })
  getUpcomingTransactions(
    @CurrentUser() user: AuthenticatedUser,
    @Query('days') days?: string,
  ) {
    const d = days ? parseInt(days, 10) : 7;
    return this.dashboardService.getUpcomingTransactions(user.tenantId, d);
  }

  @Get('burn-rate')
  @ApiOperation({ summary: 'Get average monthly burn rate and cash runway' })
  getBurnRate(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.getBurnRate(user.tenantId);
  }
}
