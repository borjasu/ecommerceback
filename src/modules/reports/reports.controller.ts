import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ReportsService,
  ResumenDashboard,
  ResumenReportes,
} from './reports.service';
import { ReportesQueryDto } from './dto/reportes-query.dto';
import { RolUsuario } from '../../entities';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('vendedor')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RolUsuario.VENDEDOR)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('dashboard')
  dashboard(): Promise<ResumenDashboard> {
    return this.reportsService.dashboard();
  }

  @Get('reportes')
  reportes(@Query() query: ReportesQueryDto): Promise<ResumenReportes> {
    return this.reportsService.reportes(query);
  }
}
