import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { INJECTION_TOKEN } from 'src/common/constants/injection-token.constant';
import { OrderRepository } from 'src/modules/order/repositories/order.repository';
import { Order, OrderSchema } from 'src/modules/order/schemas/order.schema';
import { RestaurantModule } from '../restaurant.module';
import { MenuController, PublicMenuController } from './menu.controller';
import { MenuService } from './menu.service';
import { MenuCategoryRepository } from './repositories/menu-category.repository';
import { MenuItemRepository } from './repositories/menu-item.repository';
import { MenuCategory, MenuCategorySchema } from './schemas/menu-category.schema';
import { MenuItem, MenuItemSchema } from './schemas/menu-item.schema';

@Module({
  imports: [
    forwardRef(() => RestaurantModule),
    MongooseModule.forFeature([
      { name: MenuCategory.name, schema: MenuCategorySchema },
      { name: MenuItem.name, schema: MenuItemSchema },
      { name: Order.name, schema: OrderSchema },
    ]),
  ],
  controllers: [MenuController, PublicMenuController],
  providers: [
    MenuService,
    {
      provide: INJECTION_TOKEN.MENU_CATEGORY_REPOSITORY,
      useClass: MenuCategoryRepository,
    },
    {
      provide: INJECTION_TOKEN.MENU_ITEM_REPOSITORY,
      useClass: MenuItemRepository,
    },
    {
      provide: INJECTION_TOKEN.ORDER_REPOSITORY,
      useClass: OrderRepository,
    },
  ],
  exports: [
    MenuService,
    INJECTION_TOKEN.MENU_CATEGORY_REPOSITORY,
    INJECTION_TOKEN.MENU_ITEM_REPOSITORY,
  ],
})
export class MenuModule {}
