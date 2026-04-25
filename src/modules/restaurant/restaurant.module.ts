import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MenuItem, MenuItemSchema } from './schemas/menu-item.schema';
import { MenuCategory, MenuCategorySchema } from './schemas/menu-category.schema';
import { MenuService, RestaurantService, StaffService, TableService } from './services';
import { INJECTION_TOKEN } from 'src/common/constants/injection-token.constant';
import { AuthModule } from '../auth/auth.module';
import {
  MenuCategoryRepository,
  MenuItemRepository,
  RestaurantRepository,
  StaffRepository,
  TableRepository,
} from './repositories';
import { UserRepository } from '../auth/repositories/user.repository';
import { Staff, StaffSchema } from './schemas/staff.schema.xxx';
import {
  MenuController,
  PublicMenuController,
  PublicRestaurantController,
  PublicTableController,
  RestaurantController,
  StaffController,
  TableController,
} from './controllers';
import { OrderRepository } from '../order/repositories/order.repository';
import { Order, OrderSchema } from '../order/schemas/order.schema.xxx';
import { Restaurant, RestaurantSchema } from './schemas/restaurant.schema.xxx';
import { User, UserSchema } from '../auth/schema/user.xxx.schema';
import { Table, TableSchema } from './schemas/table.schema';

@Module({
  controllers: [
    StaffController,
    MenuController,
    PublicMenuController,
    TableController,
    PublicTableController,
    RestaurantController,
    PublicRestaurantController,
  ],
  providers: [
    RestaurantService,
    StaffService,
    MenuService,
    TableService,
    {
      provide: INJECTION_TOKEN.STAFF_REPOSITORY,
      useClass: StaffRepository,
    },
    {
      provide: INJECTION_TOKEN.MENU_CATEGORY_REPOSITORY,
      useClass: MenuCategoryRepository,
    },
    {
      provide: INJECTION_TOKEN.MENU_ITEM_REPOSITORY,
      useClass: MenuItemRepository,
    },
    {
      provide: INJECTION_TOKEN.TABLE_REPOSITORY,
      useClass: TableRepository,
    },
    {
      provide: INJECTION_TOKEN.ORDER_REPOSITORY,
      useClass: OrderRepository,
    },
    {
      provide: INJECTION_TOKEN.RESTAURANT_REPOSITORY,
      useClass: RestaurantRepository,
    },
    {
      provide: INJECTION_TOKEN.USER_REPOSITORY,
      useClass: UserRepository,
    }
  ],
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: MenuItem.name, schema: MenuItemSchema },
      { name: MenuCategory.name, schema: MenuCategorySchema },
      { name: Staff.name, schema: StaffSchema },
      { name: Table.name, schema: TableSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Restaurant.name, schema: RestaurantSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  exports: [RestaurantService, StaffService],
})
export class RestaurantModule {}
