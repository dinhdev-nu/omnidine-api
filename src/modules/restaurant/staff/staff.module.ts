import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { INJECTION_TOKEN } from 'src/common/constants/injection-token.constant';
import { AuthModule } from 'src/modules/auth/auth.module';
import { OrderRepository } from 'src/modules/order/repositories/order.repository';
import { Order, OrderSchema } from 'src/modules/order/schemas/order.schema';
import { StaffRepository } from './repositories/staff.repository';
import { Staff, StaffSchema } from './schemas/staff.schema';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: Staff.name, schema: StaffSchema },
      { name: Order.name, schema: OrderSchema },
    ]),
  ],
  controllers: [StaffController],
  providers: [
    StaffService,
    {
      provide: INJECTION_TOKEN.STAFF_REPOSITORY,
      useClass: StaffRepository,
    },
    {
      provide: INJECTION_TOKEN.ORDER_REPOSITORY,
      useClass: OrderRepository,
    },
  ],
  exports: [StaffService, INJECTION_TOKEN.STAFF_REPOSITORY],
})
export class StaffModule {}
