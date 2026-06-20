import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { INJECTION_TOKEN } from 'src/common/constants/injection-token.constant';
import { OrderRepository } from 'src/modules/order/repositories/order.repository';
import { Order, OrderSchema } from 'src/modules/order/schemas/order.schema';
import { RestaurantModule } from '../restaurant.module';
import { TableRepository } from './repositories/table.repository';
import { Table, TableSchema } from './schemas/table.schema';
import { PublicTableController, TableController } from './table.controller';
import { TableService } from './table.service';

@Module({
  imports: [
    forwardRef(() => RestaurantModule),
    MongooseModule.forFeature([
      { name: Table.name, schema: TableSchema },
      { name: Order.name, schema: OrderSchema },
    ]),
  ],
  controllers: [TableController, PublicTableController],
  providers: [
    TableService,
    {
      provide: INJECTION_TOKEN.TABLE_REPOSITORY,
      useClass: TableRepository,
    },
    {
      provide: INJECTION_TOKEN.ORDER_REPOSITORY,
      useClass: OrderRepository,
    },
  ],
  exports: [TableService, INJECTION_TOKEN.TABLE_REPOSITORY],
})
export class TableModule {}
