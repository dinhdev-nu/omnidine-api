import { Module } from '@nestjs/common';
import { OrderService } from './order.service';
import {
  OrderController,
  PublicOrderController,
  TableOrderController,
} from './order.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { INJECTION_TOKEN } from 'src/common/constants/injection-token.constant';
import { OrderRepository } from './repositories/order.repository';
import { Order, OrderSchema } from './schemas/order.schema';
import { MenuItem, MenuItemSchema } from '../restaurant/menu/schemas/menu-item.schema';
import {
  Restaurant,
  RestaurantSchema,
} from '../restaurant/schemas/restaurant.schema';
import { Table, TableSchema } from '../restaurant/table/schemas/table.schema';
import { SseModule } from '../sse/sse.module';
import { AuthModule } from '../auth/auth.module';
import { OptionalPublicUserInterceptor } from './interceptors/optional-public-user.interceptor';
import { MenuItemRepository } from '../restaurant/menu/repositories/menu-item.repository';
import { RestaurantRepository } from '../restaurant/repositories/restaurant.repository';
import { TableRepository } from '../restaurant/table/repositories/table.repository';
import { RestaurantModule } from '../restaurant/restaurant.module';

@Module({
  controllers: [OrderController, TableOrderController, PublicOrderController],
  providers: [
    OrderService,
    OptionalPublicUserInterceptor,
    {
      provide: INJECTION_TOKEN.ORDER_REPOSITORY,
      useClass: OrderRepository,
    },
    {
      provide: INJECTION_TOKEN.RESTAURANT_REPOSITORY,
      useClass: RestaurantRepository,
    },
    {
      provide: INJECTION_TOKEN.TABLE_REPOSITORY,
      useClass: TableRepository,
    },
    {
      provide: INJECTION_TOKEN.MENU_ITEM_REPOSITORY,
      useClass: MenuItemRepository,
    }
  ],
  imports: [
    AuthModule,
    RestaurantModule,
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: MenuItem.name, schema: MenuItemSchema },
      { name: Restaurant.name, schema: RestaurantSchema },
      { name: Table.name, schema: TableSchema },
    ]),
    SseModule,
  ],
})
export class OrderModule {}
