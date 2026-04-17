import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { IActor, OrderService } from './order.service';
import { ROLE } from 'src/common/constants/role.constant';
import {
  CurrentUser,
  Public,
  RequirePermission,
  RequireRestaurant,
  Roles,
  ThrottleCustom,
} from 'src/common/decorators';
import { ParseObjectIdPipe } from 'src/common/pipes/parse-id.pipe';
import { StaffPermissionKey } from '../restaurant/schemas/staff.schema.xxx';
import {
  AddOrderItemsDto,
  CancelOrderDto,
  CancelOrderItemDto,
  CreatePosOrderDto,
  CreatePublicOrderDto,
  ListOrdersQueryDto,
  UpdateOrderDiscountDto,
  UpdateOrderItemDto,
  UpdateOrderItemStatusDto,
  UpdateOrderStatusDto,
} from './dto/order.dto';
import { OptionalPublicUserInterceptor } from './interceptors/optional-public-user.interceptor';
import { CurrentActor } from 'src/common/decorators/user/current-actor.decorator';

@Controller('restaurants/:id')
@Roles(ROLE.ADMIN, ROLE.USER)
@RequireRestaurant()
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
  ) {}

  @Post('orders')
  async createPosOrder(
    @Param('id', ParseObjectIdPipe) restaurantId: Types.ObjectId,
    @Body() payload: CreatePosOrderDto,
    @CurrentActor() actor: IActor,                           
  ) {
    return this.orderService.createPosOrder(
      restaurantId,
      payload,
      actor
    );
  }

  @Get('orders')
  async listOrders(
    @Param('id', ParseObjectIdPipe) restaurantId: Types.ObjectId,
    @Query() query: ListOrdersQueryDto,
  ) {
    return this.orderService.listOrders(restaurantId, query);
  }

  @Get('orders/:order_id')
  async getOrderDetail(
    @Param('id', ParseObjectIdPipe) restaurantId: Types.ObjectId,
    @Param('order_id', ParseObjectIdPipe) orderId: Types.ObjectId,
  ) {
    return this.orderService.getOrderDetail(restaurantId, orderId);
  }

  @Post('orders/:order_id/items')
  async addOrderItems(
    @Param('id', ParseObjectIdPipe) restaurantId: Types.ObjectId,
    @Param('order_id', ParseObjectIdPipe) orderId: Types.ObjectId,
    @Body() payload: AddOrderItemsDto,
  ) {
    return this.orderService.addOrderItems(restaurantId, orderId, payload);
  }

  @Patch('orders/:order_id/items/:item_id')
  async updateOrderItem(
    @Param('id', ParseObjectIdPipe) restaurantId: Types.ObjectId,
    @Param('order_id', ParseObjectIdPipe) orderId: Types.ObjectId,
    @Param('item_id', ParseObjectIdPipe) itemId: Types.ObjectId,
    @Body() payload: UpdateOrderItemDto,
  ) {
    return this.orderService.updateOrderItem(
      restaurantId,
      orderId,
      itemId,
      payload,
    );
  }

  @Delete('orders/:order_id/items/:item_id')
  async cancelOrderItem(
    @Param('id', ParseObjectIdPipe) restaurantId: Types.ObjectId,
    @Param('order_id', ParseObjectIdPipe) orderId: Types.ObjectId,
    @Param('item_id', ParseObjectIdPipe) itemId: Types.ObjectId,
    @Body() payload: CancelOrderItemDto,
    @CurrentActor() actor: IActor,
  ) {
    const normalizedPayload: CancelOrderDto = {
      cancel_reason: payload.cancel_reason ?? 'Cancelled order item',
    };

    return this.orderService.cancelOrderItem(
      restaurantId,
      orderId,
      itemId,
      normalizedPayload,
      actor,
    );
  }

  @Patch('orders/:order_id/status')
  async updateOrderStatus(
    @Param('id', ParseObjectIdPipe) restaurantId: Types.ObjectId,
    @Param('order_id', ParseObjectIdPipe) orderId: Types.ObjectId,
    @Body() payload: UpdateOrderStatusDto,
  ) {
    return this.orderService.updateOrderStatus(restaurantId, orderId, payload);
  }

  @Patch('orders/:order_id/items/:item_id/status')
  async updateOrderItemStatus(
    @Param('id', ParseObjectIdPipe) restaurantId: Types.ObjectId,
    @Param('order_id', ParseObjectIdPipe) orderId: Types.ObjectId,
    @Param('item_id', ParseObjectIdPipe) itemId: Types.ObjectId,
    @Body() payload: UpdateOrderItemStatusDto,
    @CurrentActor() actor: IActor,
  ) {
    return this.orderService.updateOrderItemStatus(
      restaurantId,
      orderId,
      itemId,
      payload,
      actor,
    );
  }

  @Patch('orders/:order_id/discount')
  @RequirePermission(StaffPermissionKey.CAN_DISCOUNT)
  async updateOrderDiscount(
    @Param('id', ParseObjectIdPipe) restaurantId: Types.ObjectId,
    @Param('order_id', ParseObjectIdPipe) orderId: Types.ObjectId,
    @Body() payload: UpdateOrderDiscountDto,
    @CurrentActor() actor: IActor,
  ) {
    return this.orderService.updateOrderDiscount(
      restaurantId,
      orderId,
      payload,
      actor,
    );
  }

  @Patch('orders/:order_id/cancel')
  @RequirePermission(StaffPermissionKey.CAN_CANCEL_ORDER)
  async cancelOrder(
    @Param('id', ParseObjectIdPipe) restaurantId: Types.ObjectId,
    @Param('order_id', ParseObjectIdPipe) orderId: Types.ObjectId,
    @Body() payload: CancelOrderDto,
    @CurrentActor() actor: IActor
  ) {
    return this.orderService.cancelOrder(
      restaurantId,
      orderId,
      payload,
      actor
    );
  }
}

@Controller('restaurants/:id/tables')
@Roles(ROLE.ADMIN, ROLE.USER)
@RequireRestaurant()
export class TableOrderController {
  constructor(
    private readonly orderService: OrderService,
  ) {}

  @Get(':table_id/active-order')
  async getActiveOrderByTable(
    @Param('id', ParseObjectIdPipe) restaurantId: Types.ObjectId,
    @Param('table_id', ParseObjectIdPipe) tableId: Types.ObjectId,
  ) {
    return this.orderService.getActiveOrderByTable(restaurantId, tableId);
  }
}

@Controller('public/orders')
export class PublicOrderController {
  constructor(
    private readonly orderService: OrderService,
  ) {}

  @Post()
  @Public()
  @ThrottleCustom('public-order-create', { ttl: 60_000, limit: 10 })
  @UseInterceptors(OptionalPublicUserInterceptor)
  async createPublicOrder(
    @Body() payload: CreatePublicOrderDto,
    @CurrentUser('sub') userId?: Types.ObjectId | null,
  ) {
    return this.orderService.createPublicOrder(payload, userId);
  }
}
