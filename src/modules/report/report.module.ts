import { Module } from '@nestjs/common';
import { ReportService } from './report.service';
import { ReportController } from './report.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { DailySaleStats, DailySaleStatsSchema } from './schemas/daily-sale-stats.schema';
import { MonthlySaleStats, MonthlySaleStatsSchema } from './schemas/monthly-sale-stats.schema';

@Module({
  imports: [
     MongooseModule.forFeature([
      { name: DailySaleStats.name, schema: DailySaleStatsSchema },
      { name: MonthlySaleStats.name, schema: MonthlySaleStatsSchema }
    ])
  ],
  controllers: [ReportController],
  providers: [ReportService,],
})
export class ReportModule {}
