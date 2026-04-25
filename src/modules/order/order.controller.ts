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
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
  getSchemaPath,
} from '@nestjs/swagger';
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
  ActiveOrderByTableResponseDto,
  AddOrderItemsDto,
  AddOrderItemsResponseDto,
  CancelOrderResponseDto,
  CancelOrderDto,
  CancelOrderItemDto,
  CancelOrderItemResponseDto,
  CreatePosOrderDto,
  CreatePublicOrderResponseDto,
  CreatePublicOrderDto,
  ListOrdersQueryDto,
  ListOrdersResponseDto,
  OrderPersistedResponseDto,
  UpdateOrderDiscountResponseDto,
  UpdateOrderDiscountDto,
  UpdateOrderItemDto,
  UpdateOrderItemResponseDto,
  UpdateOrderItemStatusResponseDto,
  UpdateOrderItemStatusDto,
  UpdateOrderStatusResponseDto,
  UpdateOrderStatusDto,
} from './dto/order.dto';
import { OptionalPublicUserInterceptor } from './interceptors/optional-public-user.interceptor';
import { CurrentActor } from 'src/common/decorators/user/current-actor.decorator';
import {
  OrderPaymentStatus,
  OrderSource,
  OrderStatus,
  OrderType,
} from './schemas/order.schema.xxx';
import { swWrap } from 'src/common/swagger/api-response.util';

@ApiTags('orders')
@ApiBearerAuth()
@ApiExtraModels(
  OrderPersistedResponseDto,
  ListOrdersResponseDto,
  AddOrderItemsResponseDto,
  UpdateOrderItemResponseDto,
  CancelOrderItemResponseDto,
  UpdateOrderStatusResponseDto,
  UpdateOrderItemStatusResponseDto,
  UpdateOrderDiscountResponseDto,
  CancelOrderResponseDto,
)
@Controller('restaurants/:id')
@Roles(ROLE.ADMIN, ROLE.USER)
@RequireRestaurant()
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
  ) {}

  @ApiOperation({
    summary: 'Create POS order',
    description: 'Create a new order in restaurant context. Dine-in orders require table_id.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    example: '664f1a2b3c4d5e6f7a8b9001',
    description: 'Restaurant ObjectId',
  })
  @ApiBody({ type: CreatePosOrderDto })
  @ApiOkResponse({
    description: 'Order created successfully',
    schema: swWrap({ $ref: getSchemaPath(OrderPersistedResponseDto) }),
  })
  @ApiBadRequestResponse({ description: 'Invalid payload, invalid id, or missing table_id for dine-in orders.' })
  @ApiNotFoundResponse({ description: 'Restaurant, table, or menu item not found.' })
  @ApiConflictResponse({ description: 'Table is not available for a new order.' })
  @ApiTooManyRequestsResponse({ description: 'Order creation rate limit exceeded.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid Bearer token.' })
  @ApiForbiddenResponse({ description: 'Requester has no access to this restaurant context.' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error.' })
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

  @ApiOperation({
    summary: 'List orders',
    description: 'Return paginated order list with filtering and summary for one day range.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    example: '664f1a2b3c4d5e6f7a8b9001',
    description: 'Restaurant ObjectId',
  })
  @ApiQuery({ name: 'status', required: false, enum: OrderStatus, description: 'Filter by order status' })
  @ApiQuery({ name: 'date', required: false, type: String, example: '2026-04-17', description: 'ISO date used for daily range filtering' })
  @ApiQuery({ name: 'table_id', required: false, type: String, example: '664f1a2b3c4d5e6f7a8b9401', description: 'Filter by table id' })
  @ApiQuery({ name: 'order_type', required: false, enum: OrderType, description: 'Filter by order type' })
  @ApiQuery({ name: 'source', required: false, enum: OrderSource, description: 'Filter by order source' })
  @ApiQuery({ name: 'payment_status', required: false, enum: OrderPaymentStatus, description: 'Filter by payment status' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1, description: 'Page number >= 1' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 50, description: 'Page size 1..100' })
  @ApiOkResponse({
    description: 'Paginated order list',
    schema: swWrap({ $ref: getSchemaPath(ListOrdersResponseDto) }),
  })
  @ApiBadRequestResponse({ description: 'Invalid query input, invalid id, or invalid date format.' })
  @ApiNotFoundResponse({ description: 'Restaurant context not found.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid Bearer token.' })
  @ApiForbiddenResponse({ description: 'Requester has no access to this restaurant context.' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error.' })
  @Get('orders')
  async listOrders(
    @Param('id', ParseObjectIdPipe) restaurantId: Types.ObjectId,
    @Query() query: ListOrdersQueryDto,
  ) {
    return this.orderService.listOrders(restaurantId, query);
  }

  @ApiOperation({
    summary: 'Get order detail',
    description: 'Return full order payload including item snapshots and computed totals.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    example: '664f1a2b3c4d5e6f7a8b9001',
    description: 'Restaurant ObjectId',
  })
  @ApiParam({
    name: 'order_id',
    type: String,
    example: '664f1a2b3c4d5e6f7a8b9501',
    description: 'Order ObjectId',
  })
  @ApiOkResponse({
    description: 'Order detail',
    schema: swWrap({ $ref: getSchemaPath(OrderPersistedResponseDto) }),
  })
  @ApiBadRequestResponse({ description: 'Invalid id or order_id.' })
  @ApiNotFoundResponse({ description: 'Order not found.' })
  @ApiForbiddenResponse({ description: 'Order does not belong to current restaurant context.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid Bearer token.' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error.' })
  @Get('orders/:order_id')
  async getOrderDetail(
    @Param('id', ParseObjectIdPipe) restaurantId: Types.ObjectId,
    @Param('order_id', ParseObjectIdPipe) orderId: Types.ObjectId,
  ) {
    return this.orderService.getOrderDetail(restaurantId, orderId);
  }

  @ApiOperation({
    summary: 'Add items to order',
    description: 'Append new menu items to an existing mutable order and recompute totals.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    example: '664f1a2b3c4d5e6f7a8b9001',
    description: 'Restaurant ObjectId',
  })
  @ApiParam({
    name: 'order_id',
    type: String,
    example: '664f1a2b3c4d5e6f7a8b9501',
    description: 'Order ObjectId',
  })
  @ApiBody({ type: AddOrderItemsDto })
  @ApiOkResponse({
    description: 'Items added successfully',
    schema: swWrap({ $ref: getSchemaPath(AddOrderItemsResponseDto) }),
  })
  @ApiBadRequestResponse({ description: 'Invalid payload, invalid id/order_id, or write not allowed for current order status.' })
  @ApiNotFoundResponse({ description: 'Order or menu item not found.' })
  @ApiConflictResponse({ description: 'Order cannot be modified in current state or was updated concurrently.' })
  @ApiTooManyRequestsResponse({ description: 'Order write rate limit exceeded.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid Bearer token.' })
  @ApiForbiddenResponse({ description: 'Requester has no access to this restaurant context.' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error.' })
  @Post('orders/:order_id/items')
  async addOrderItems(
    @Param('id', ParseObjectIdPipe) restaurantId: Types.ObjectId,
    @Param('order_id', ParseObjectIdPipe) orderId: Types.ObjectId,
    @Body() payload: AddOrderItemsDto,
  ) {
    return this.orderService.addOrderItems(restaurantId, orderId, payload);
  }

  @ApiOperation({
    summary: 'Update order item',
    description: 'Update quantity and/or notes of one item, then recompute order totals.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    example: '664f1a2b3c4d5e6f7a8b9001',
    description: 'Restaurant ObjectId',
  })
  @ApiParam({
    name: 'order_id',
    type: String,
    example: '664f1a2b3c4d5e6f7a8b9501',
    description: 'Order ObjectId',
  })
  @ApiParam({
    name: 'item_id',
    type: String,
    example: '664f1a2b3c4d5e6f7a8b9601',
    description: 'Order item ObjectId',
  })
  @ApiBody({ type: UpdateOrderItemDto })
  @ApiOkResponse({
    description: 'Order item updated successfully',
    schema: swWrap({ $ref: getSchemaPath(UpdateOrderItemResponseDto) }),
  })
  @ApiBadRequestResponse({ description: 'Invalid payload or invalid route params.' })
  @ApiNotFoundResponse({ description: 'Order or order item not found.' })
  @ApiConflictResponse({ description: 'Item cannot be changed in current status or order mutated concurrently.' })
  @ApiTooManyRequestsResponse({ description: 'Order write rate limit exceeded.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid Bearer token.' })
  @ApiForbiddenResponse({ description: 'Requester has no access to this restaurant context.' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error.' })
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

  @ApiOperation({
    summary: 'Cancel one order item',
    description: 'Cancel one item in an order and recompute totals.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    example: '664f1a2b3c4d5e6f7a8b9001',
    description: 'Restaurant ObjectId',
  })
  @ApiParam({
    name: 'order_id',
    type: String,
    example: '664f1a2b3c4d5e6f7a8b9501',
    description: 'Order ObjectId',
  })
  @ApiParam({
    name: 'item_id',
    type: String,
    example: '664f1a2b3c4d5e6f7a8b9601',
    description: 'Order item ObjectId',
  })
  @ApiBody({ type: CancelOrderItemDto })
  @ApiOkResponse({
    description: 'Order item cancellation applied',
    schema: swWrap({ $ref: getSchemaPath(CancelOrderItemResponseDto) }),
  })
  @ApiBadRequestResponse({ description: 'Invalid payload or invalid route params.' })
  @ApiNotFoundResponse({ description: 'Order or order item not found.' })
  @ApiConflictResponse({ description: 'Order/item state prevents cancellation or order was changed concurrently.' })
  @ApiTooManyRequestsResponse({ description: 'Order write rate limit exceeded.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid Bearer token.' })
  @ApiForbiddenResponse({ description: 'Requester has no access to this restaurant context.' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error.' })
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

  @ApiOperation({
    summary: 'Update order status',
    description: 'Apply allowed status transitions for order lifecycle.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    example: '664f1a2b3c4d5e6f7a8b9001',
    description: 'Restaurant ObjectId',
  })
  @ApiParam({
    name: 'order_id',
    type: String,
    example: '664f1a2b3c4d5e6f7a8b9501',
    description: 'Order ObjectId',
  })
  @ApiBody({ type: UpdateOrderStatusDto })
  @ApiOkResponse({
    description: 'Order status updated',
    schema: swWrap({ $ref: getSchemaPath(UpdateOrderStatusResponseDto) }),
  })
  @ApiBadRequestResponse({ description: 'Invalid payload, invalid params, or delivering transition used for non-delivery orders.' })
  @ApiNotFoundResponse({ description: 'Order not found.' })
  @ApiConflictResponse({ description: 'Invalid status transition or order changed concurrently.' })
  @ApiTooManyRequestsResponse({ description: 'Order write rate limit exceeded.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid Bearer token.' })
  @ApiForbiddenResponse({ description: 'Requester has no access to this restaurant context.' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error.' })
  @Patch('orders/:order_id/status')
  async updateOrderStatus(
    @Param('id', ParseObjectIdPipe) restaurantId: Types.ObjectId,
    @Param('order_id', ParseObjectIdPipe) orderId: Types.ObjectId,
    @Body() payload: UpdateOrderStatusDto,
  ) {
    return this.orderService.updateOrderStatus(restaurantId, orderId, payload);
  }

  @ApiOperation({
    summary: 'Update order item status',
    description: 'Update one item status according to actor role and transition rules.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    example: '664f1a2b3c4d5e6f7a8b9001',
    description: 'Restaurant ObjectId',
  })
  @ApiParam({
    name: 'order_id',
    type: String,
    example: '664f1a2b3c4d5e6f7a8b9501',
    description: 'Order ObjectId',
  })
  @ApiParam({
    name: 'item_id',
    type: String,
    example: '664f1a2b3c4d5e6f7a8b9601',
    description: 'Order item ObjectId',
  })
  @ApiBody({ type: UpdateOrderItemStatusDto })
  @ApiOkResponse({
    description: 'Order item status updated',
    schema: swWrap({ $ref: getSchemaPath(UpdateOrderItemStatusResponseDto) }),
  })
  @ApiBadRequestResponse({ description: 'Invalid payload or invalid route params.' })
  @ApiNotFoundResponse({ description: 'Order or order item not found.' })
  @ApiConflictResponse({ description: 'Item/order status transition is not allowed or order changed concurrently.' })
  @ApiTooManyRequestsResponse({ description: 'Order write rate limit exceeded.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid Bearer token.' })
  @ApiForbiddenResponse({ description: 'Requester has no access to this restaurant context.' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error.' })
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

  @ApiOperation({
    summary: 'Update order discount',
    description: 'Apply, update, or clear discount and recompute totals.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    example: '664f1a2b3c4d5e6f7a8b9001',
    description: 'Restaurant ObjectId',
  })
  @ApiParam({
    name: 'order_id',
    type: String,
    example: '664f1a2b3c4d5e6f7a8b9501',
    description: 'Order ObjectId',
  })
  @ApiBody({ type: UpdateOrderDiscountDto })
  @ApiOkResponse({
    description: 'Order discount updated',
    schema: swWrap({ $ref: getSchemaPath(UpdateOrderDiscountResponseDto) }),
  })
  @ApiBadRequestResponse({ description: 'Invalid payload, discount rules violated, or invalid route params.' })
  @ApiNotFoundResponse({ description: 'Order not found.' })
  @ApiConflictResponse({ description: 'Terminal order cannot be discounted.' })
  @ApiTooManyRequestsResponse({ description: 'Order write rate limit exceeded.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid Bearer token.' })
  @ApiForbiddenResponse({ description: 'Requester has no discount permission in current restaurant context.' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error.' })
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

  @ApiOperation({
    summary: 'Cancel order',
    description: 'Cancel a full order according to role and lifecycle rules.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    example: '664f1a2b3c4d5e6f7a8b9001',
    description: 'Restaurant ObjectId',
  })
  @ApiParam({
    name: 'order_id',
    type: String,
    example: '664f1a2b3c4d5e6f7a8b9501',
    description: 'Order ObjectId',
  })
  @ApiBody({ type: CancelOrderDto })
  @ApiOkResponse({
    description: 'Order cancellation applied',
    schema: swWrap({ $ref: getSchemaPath(CancelOrderResponseDto) }),
  })
  @ApiBadRequestResponse({ description: 'Invalid payload or invalid route params.' })
  @ApiNotFoundResponse({ description: 'Order not found.' })
  @ApiConflictResponse({ description: 'Order status does not allow cancellation in current context.' })
  @ApiTooManyRequestsResponse({ description: 'Order write rate limit exceeded.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid Bearer token.' })
  @ApiForbiddenResponse({ description: 'Requester has no cancel permission in current restaurant context.' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error.' })
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

@ApiTags('table-orders')
@ApiBearerAuth()
@ApiExtraModels(ActiveOrderByTableResponseDto)
@Controller('restaurants/:id/tables')
@Roles(ROLE.ADMIN, ROLE.USER)
@RequireRestaurant()
export class TableOrderController {
  constructor(
    private readonly orderService: OrderService,
  ) {}

  @ApiOperation({
    summary: 'Get active order by table',
    description: 'Return active unpaid order of a table if available, otherwise null.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    example: '664f1a2b3c4d5e6f7a8b9001',
    description: 'Restaurant ObjectId',
  })
  @ApiParam({
    name: 'table_id',
    type: String,
    example: '664f1a2b3c4d5e6f7a8b9401',
    description: 'Table ObjectId',
  })
  @ApiOkResponse({
    description: 'Active order lookup result',
    schema: swWrap({ $ref: getSchemaPath(ActiveOrderByTableResponseDto) }),
  })
  @ApiBadRequestResponse({ description: 'Invalid id or table_id.' })
  @ApiNotFoundResponse({ description: 'Table not found.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid Bearer token.' })
  @ApiForbiddenResponse({ description: 'Requester has no access to this restaurant context.' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error.' })
  @Get(':table_id/active-order')
  async getActiveOrderByTable(
    @Param('id', ParseObjectIdPipe) restaurantId: Types.ObjectId,
    @Param('table_id', ParseObjectIdPipe) tableId: Types.ObjectId,
  ) {
    return this.orderService.getActiveOrderByTable(restaurantId, tableId);
  }
}

@ApiTags('public-orders')
@ApiExtraModels(CreatePublicOrderResponseDto)
@Controller('public/orders')
export class PublicOrderController {
  constructor(
    private readonly orderService: OrderService,
  ) {}

  @ApiOperation({
    summary: 'Create public order',
    description: 'Create an online or QR order. Authorization header is optional and used to attach user_id when valid.',
  })
  @ApiBody({ type: CreatePublicOrderDto })
  @ApiOkResponse({
    description: 'Public order created successfully',
    schema: swWrap({ $ref: getSchemaPath(CreatePublicOrderResponseDto) }),
  })
  @ApiBadRequestResponse({ description: 'Invalid payload or missing table_id for dine-in public order.' })
  @ApiNotFoundResponse({ description: 'Restaurant, table, or menu item not found, or restaurant not accepting online orders.' })
  @ApiConflictResponse({ description: 'Table is not available for creating a new public dine-in order.' })
  @ApiTooManyRequestsResponse({ description: 'Public order creation throttled.' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error.' })
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
