import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { INJECTION_TOKEN } from 'src/common/constants/injection-token.constant';
import { PublicRestaurantController, RestaurantController } from './restaurant.controller';
import { RestaurantService } from './restaurant.service';
import { RestaurantRepository } from './repositories/restaurant.repository';
import { OrderRepository } from '../order/repositories/order.repository';
import { Order, OrderSchema } from '../order/schemas/order.schema';
import { Restaurant, RestaurantSchema } from './schemas/restaurant.schema';
import { MenuModule } from './menu/menu.module';
import { StaffModule } from './staff/staff.module';
import { TableModule } from './table/table.module';
import { PosModule } from './pos/pos.module';

@Module({
  controllers: [RestaurantController, PublicRestaurantController],
  providers: [
    RestaurantService,
    {
      provide: INJECTION_TOKEN.ORDER_REPOSITORY,
      useClass: OrderRepository,
    },
    {
      provide: INJECTION_TOKEN.RESTAURANT_REPOSITORY,
      useClass: RestaurantRepository,
    },
  ],
  imports: [
    forwardRef(() => MenuModule),
    StaffModule,
    forwardRef(() => TableModule),
    forwardRef(() => PosModule),
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: Restaurant.name, schema: RestaurantSchema },
    ]),
  ],
  exports: [
    RestaurantService,
    INJECTION_TOKEN.RESTAURANT_REPOSITORY,
    StaffModule,
  ],
})
export class RestaurantModule {}
