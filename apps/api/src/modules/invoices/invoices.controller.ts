import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InvoicesService } from './invoices.service.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { AuthenticatedUser } from '../../common/types/authenticated-request.js';
import { UserRole } from '@flux/shared';

@ApiTags('Invoices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  @ApiOperation({ summary: 'List all invoices' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: number,
    @Query('perPage') perPage?: number,
  ) {
    return this.invoicesService.findAll(user.tenantId, page, perPage);
  }

  @Post('upload')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.FINANCEIRO)
  @ApiOperation({ summary: 'Upload NF-e XML or PDF' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
      fileFilter: (_, file, cb) => {
        const ok =
          file.mimetype.includes('xml') ||
          file.mimetype === 'application/pdf' ||
          file.originalname.endsWith('.xml') ||
          file.originalname.endsWith('.pdf');
        cb(ok ? null : new BadRequestException('Only XML and PDF files accepted'), ok);
      },
    }),
  )
  upload(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
    @Query('supplierId') supplierId?: string,
  ) {
    if (!file) throw new BadRequestException('File is required');
    return this.invoicesService.upload(user.tenantId, file, supplierId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an invoice by ID' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.invoicesService.findOne(user.tenantId, id);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Get pre-signed download URL' })
  getDownloadUrl(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.invoicesService.getDownloadUrl(user.tenantId, id);
  }

  @Delete(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Archive an invoice and remove from S3' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.invoicesService.remove(user.tenantId, id);
  }
}
