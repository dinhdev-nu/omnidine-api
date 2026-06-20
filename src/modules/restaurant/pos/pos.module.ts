import { forwardRef, Module } from '@nestjs/common';
import { RestaurantModule } from '../restaurant.module';
import { StaffModule } from '../staff/staff.module';
import { TableModule } from '../table/table.module';
import { PosController } from './pos.controller';
import { PosService } from './pos.service';

@Module({
  imports: [
    forwardRef(() => RestaurantModule),
    StaffModule,
    TableModule,
  ],
  controllers: [PosController],
  providers: [PosService],
  exports: [PosService],
})
export class PosModule {}
