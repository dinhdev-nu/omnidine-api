import { Inject, Injectable } from "@nestjs/common";
import { InjectConnection, InjectModel } from "@nestjs/mongoose";
import { Connection, Types } from "mongoose";
import Redis from "ioredis";
import { ERROR_CODE } from "src/common/constants/error-code.constant";
import { INJECTION_TOKEN } from "src/common/constants/injection-token.constant";
import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	NotFoundException,
	TooManyRequestException,
} from "src/common/exceptions";
import { NumberUtil } from "src/common/utils/number.util";
import { ObjectIdUtil } from "src/common/utils/object-id.util";
import { StringUtil } from "src/common/utils/string.util";
import { TimeUtil } from "src/common/utils/time.util";
import { CreateOrderDto } from "./dto/create-order.dto";
import {
	AddOrderItemsDto,
	CancelOrderDto,
	CreatePosOrderDto,
	CreatePublicOrderDto,
	ListOrdersQueryDto,
	OrderItemInputDto,
	UpdateOrderDiscountDto,
	UpdateOrderItemDto,
	UpdateOrderItemStatusDto,
	UpdateOrderStatusDto,
} from "./dto/order.dto";
import {
	IOrderListFilters,
	IOrderRepository,
} from "./repositories/order.repository";
import { IMenuItemRepository } from "../restaurant/menu/repositories/menu-item.repository";
import { ITableRepository } from "../restaurant/table/repositories/table.repository";
import {
	Order,
	OrderDiscountType,
	OrderDocument,
	OrderPaymentStatus,
	OrderSource,
	OrderStatus,
	OrderType,
} from "./schemas/order.schema";
import {
	OrderItem,
	OrderItemStatus,
} from "./schemas/order-item.schema";
import {
	MenuItemDocument,
} from "../restaurant/menu/schemas/menu-item.schema";
import {
	TableStatus,
} from "../restaurant/table/schemas/table.schema";
import { IPaginatedResult } from "src/common/interfaces/paginated-result.interface";
import { RestaurantService } from "../restaurant/restaurant.service";

type ActorRole = "owner" | "admin" | "staff";

export interface IActor {
	role: ActorRole ;
	staff_id?: Types.ObjectId | null;
	permissions?: {
		can_discount?: boolean;
		can_cancel_order?: boolean;
	};
}

type PaginatedOrdersResult = IPaginatedResult<Record<string, unknown>> & { summary: { total_revenue: number, total_orders: number } };

const TERMINAL_ORDER_STATUSES = new Set<OrderStatus>([
	OrderStatus.COMPLETED,
	OrderStatus.CANCELLED,
	OrderStatus.REFUNDED,
]);

const ADDABLE_STATUSES = new Set<OrderStatus>([
  OrderStatus.PENDING,
  OrderStatus.CONFIRMED,
]);

const VALID_TRANSITIONS = new Map<OrderStatus, Set<OrderStatus>>([
	[OrderStatus.PENDING, new Set([OrderStatus.CONFIRMED])],
	[OrderStatus.CONFIRMED, new Set([OrderStatus.PREPARING])],
	[OrderStatus.PREPARING, new Set([OrderStatus.READY])],
	[OrderStatus.READY, new Set([OrderStatus.DELIVERING, OrderStatus.COMPLETED])],
	[OrderStatus.DELIVERING, new Set([OrderStatus.COMPLETED])],
]);

const CACHE_ORDER_PREFIX = "order:";
const CACHE_ORDER_TTL_SECONDS = 300;
const CACHE_ORDER_LIST_PREFIX = "order:list:";
const CACHE_ORDER_LIST_TTL_SECONDS = 60;
const CACHE_ORDER_ACTIVE_PREFIX = "order:active:";
const CACHE_ORDER_ACTIVE_TTL_SECONDS = 300;
const CACHE_TABLE_PREFIX = "table:";
const CACHE_TABLE_LIST_PREFIX = "table:list:";

const RATE_LIMIT_ORDER_CREATE_PREFIX = "ratelimit:order:create:";
const RATE_LIMIT_ORDER_CREATE_TTL_SECONDS = 60;
const RATE_LIMIT_ORDER_CREATE_MAX = 120;

const RATE_LIMIT_ORDER_WRITE_PREFIX = "ratelimit:order:write:";
const RATE_LIMIT_ORDER_WRITE_TTL_SECONDS = 60;
const RATE_LIMIT_ORDER_WRITE_MAX = 30;


const ORDER_SEQUENCE_PREFIX = "order:seq:";
const ORDER_SEQUENCE_TTL_SECONDS = 86400;
const DEFAULT_SERVICE_CHARGE_RATE = 0.01;

@Injectable()
export class OrderService {
	constructor(
		@Inject(INJECTION_TOKEN.ORDER_REPOSITORY)
		private readonly orderRepository: IOrderRepository,

		@Inject(INJECTION_TOKEN.MENU_ITEM_REPOSITORY)
		private readonly menuItemRepository: IMenuItemRepository,

		@Inject(INJECTION_TOKEN.TABLE_REPOSITORY)
		private readonly tableRepository: ITableRepository,

		@InjectConnection()
		private readonly connection: Connection,

		private readonly restaurantService: RestaurantService,

		@Inject(INJECTION_TOKEN.REDIS_CLIENT)
		private readonly redis: Redis,
	) {}

	async createPosOrder(
		resId: Types.ObjectId,
		payload: CreatePosOrderDto,
		actor: IActor,
	): Promise<Record<string, unknown>> {
		await this.checkCreateRateLimit(resId);
		
		const restaurant = await this.restaurantService.handleGetResAndThrow(resId);
		
		let tableId: Types.ObjectId | null = null;
		const isDineIn = payload.order_type === OrderType.DINE_IN;
		if (isDineIn) {
			if (!payload.table_id) {
				throw new BadRequestException(
					ERROR_CODE.VALIDATION_ERROR,
					"Mã bàn (table_id) là bắt buộc đối với đơn dine-in",
				);
			}
			tableId = ObjectIdUtil.toObjectId(payload.table_id, "table_id");
			await this.assertTableAvailableForNewOrder(resId, tableId);
		}
		
		const items = await this.buildOrderItemsSnapshot(
			resId,
			payload.items ?? [],
		);
		
		const orderNumber = await this.generateOrderNumber(resId);
		
		let created!: OrderDocument;
		const session = await this.connection.startSession();
		try {
			await session.withTransaction(async () => {
				if (isDineIn && tableId) {
					const table = await this.tableRepository.occupyIfAvailable(resId, tableId, {
						session,
					});
					if (!table) {
						throw new ConflictException(
							ERROR_CODE.CONFLICT_ERROR,
							"Bàn chưa sẵn sàng để nhận đơn mới",
						)
					}
				}

				created = await this.orderRepository.createOne({
					order_number: orderNumber,
					restaurant_id: resId,
					table_id: tableId,
					user_id: null,
					customer_name: StringUtil.normalizeNullableString(payload.customer_name),
					customer_phone: StringUtil.normalizeNullableString(payload.customer_phone),
					staff_id: actor.staff_id ?? null,
					order_type: payload.order_type,
					source: payload.source ?? OrderSource.POS,
					status: OrderStatus.PENDING,
					payment_status: OrderPaymentStatus.UNPAID,
					items,
					subtotal: 0,
					discount_type: OrderDiscountType.NONE,
					discount_ref: null,
					discount_value: 0,
					discount_amount: 0,
					tax_rate: Number(restaurant.tax_rate ?? 0),
					service_charge_rate: Number(
						restaurant.service_charge_rate ?? DEFAULT_SERVICE_CHARGE_RATE,
					),
					tax_amount: 0,
					service_charge_amount: 0,
					total_amount: 0,
					currency: restaurant.currency ?? "VND",
					notes: StringUtil.normalizeNullableString(payload.notes),
					completed_at: null,
					cancelled_at: null,
					cancel_reason: null,
				} as Partial<Order>,
				{
					session,
				});

				this.recomputeOrderTotals(created);
				await this.orderRepository.saveOrder(created, { session });

				return created;
			});
		} finally {
			await session.endSession();
		}

		await this.postOrderCacheUpdate(resId, created, tableId);

		return this.toPlainObject(created as any);
	}

	async createPublicOrder(
		payload: CreatePublicOrderDto,
		userId?: Types.ObjectId | null,
	): Promise<Record<string, unknown>> {
		const restaurantId = ObjectIdUtil.toObjectId(payload.restaurant_id, "restaurant_id");
		const restaurant = await this.restaurantService.handleGetResAndThrow(restaurantId);
		if (!restaurant.is_published || !restaurant.accepts_online_orders) {
			throw new NotFoundException(
				ERROR_CODE.RESTAURANT_NOT_FOUND,
				"Restaurant is not accepting online orders",
			);
		}

		let tableId: Types.ObjectId | null = null;
		const isDineIn = payload.order_type === OrderType.DINE_IN;
		if (isDineIn) {
			if (!payload.table_id) {
				throw new BadRequestException(
					ERROR_CODE.VALIDATION_ERROR,
					"Mã bàn (table_id) là bắt buộc đối với đơn dine-in",
				);
			}

			tableId = ObjectIdUtil.toObjectId(payload.table_id, "table_id");
			await this.assertTableAvailableForNewOrder(restaurantId, tableId);
		}

		const items = await this.buildOrderItemsSnapshot(restaurantId, payload.items);
		const orderNumber = await this.generateOrderNumber(restaurantId);

		const source = payload.source ?? (tableId ? OrderSource.QR : OrderSource.ONLINE);
		const autoConfirm = Boolean((restaurant.settings as any)?.auto_confirm_orders);

		let created!: OrderDocument;
		const session = await this.connection.startSession();
		try {
			await session.withTransaction(async () => {
				if (isDineIn && tableId) {
					const table = await this.tableRepository.occupyIfAvailable(
						restaurantId,
						tableId,
						{ session },
					);
					if (!table) {
						throw new ConflictException(
							ERROR_CODE.CONFLICT_ERROR,
							"Bàn chưa sẵn sàng để nhận đơn mới",
						);
					}
				}
				
				created = await this.orderRepository.createOne({
					order_number: orderNumber,
					restaurant_id: restaurantId,
					table_id: tableId,
					user_id: userId ?? null,
					customer_name: StringUtil.normalizeNullableString(payload.customer_name),
					customer_phone: StringUtil.normalizeNullableString(payload.customer_phone),
					staff_id: null,
					order_type: payload.order_type,
					source,
					status: autoConfirm ? OrderStatus.CONFIRMED : OrderStatus.PENDING,
					payment_status: OrderPaymentStatus.UNPAID,
					items,
					subtotal: 0,
					discount_type: OrderDiscountType.NONE,
					discount_ref: null,
					discount_value: 0,
					discount_amount: 0,
					tax_rate: Number(restaurant.tax_rate ?? 0),
					service_charge_rate: Number(
						restaurant.service_charge_rate ?? DEFAULT_SERVICE_CHARGE_RATE,
					),
					tax_amount: 0,
					service_charge_amount: 0,
					total_amount: 0,
					currency: restaurant.currency ?? "VND",
					notes: StringUtil.normalizeNullableString(payload.notes),
					completed_at: null,
					cancelled_at: null,
					cancel_reason: null,
				} as Partial<Order>, 
				{
					session,
				});

				this.recomputeOrderTotals(created);
				await this.orderRepository.saveOrder(created, { session });

				return created;
			});
		} finally {
			await session.endSession();
		}

		await this.postOrderCacheUpdate(restaurantId, created, tableId);

		return {
			...this.toPlainObject(created as any),
			message: "Order has been placed successfully",
		};
	}

	async listOrders(
		resId: Types.ObjectId,
		query: ListOrdersQueryDto = {},
		extra?: { user_id?: Types.ObjectId },
	): Promise<PaginatedOrdersResult> {
		const { page = 1, limit = 50 } = query;

		const { start, end, dateKey, isToday } = this.getDateRangeByHcm(query.date);
		const canUseCache =
			page === 1 &&
			!query.status &&
			!query.table_id &&
			!query.order_type &&
			!query.source &&
			!query.payment_status &&
			!extra?.user_id &&
			isToday;

		const listCacheKey = `${CACHE_ORDER_LIST_PREFIX}${resId.toString()}:${dateKey}`;
		if (canUseCache) {
			const cached = await this.redis.get(listCacheKey);
			if (cached) {
				return JSON.parse(cached) as PaginatedOrdersResult;
			}
		}

		const filters: IOrderListFilters = {
			page,
			limit,
			start_date: start,
			end_date: end,
			status: query.status,
			table_id: query.table_id ? ObjectIdUtil.toObjectId(query.table_id, "table_id") : undefined,
			order_type: query.order_type,
			source: query.source,
			payment_status: query.payment_status,
			user_id: extra?.user_id,
		};

		const result = await this.orderRepository.listByRestaurant(resId, filters);
		const totalPages = Math.max(Math.ceil(result.total / limit), 1);

		const response = {
			data: result.data.map((order) => ({
				id: order._id.toString(),
				_id: order._id,
				order_number: order.order_number,
				order_type: order.order_type,
				source: order.source,
				status: order.status,
				payment_status: order.payment_status,
				table_id: order.table_id,
				customer_name: order.customer_name,
				total_amount: order.total_amount,
				currency: order.currency,
				item_count: Array.isArray(order.items) ? order.items.length : 0,
				created_at: (order as any).created_at,
			})),
			pagination: {
				page,
				limit,
				total: result.total,
				total_pages: totalPages,
			},
			summary: {
				total_orders: result.total,
				total_revenue: NumberUtil.round2(result.total_revenue),
			},
		};

		if (canUseCache) {
			await this.redis.set(
				listCacheKey,
				JSON.stringify(response),
				"EX",
				CACHE_ORDER_LIST_TTL_SECONDS,
			);
		}

		return response;
	}

	async getOrderDetail(
		resId: Types.ObjectId,
		orderId: Types.ObjectId,
	): Promise<Record<string, unknown>> {
		const cacheKey = `${CACHE_ORDER_PREFIX}${orderId.toString()}`;
		const cached = await this.redis.get(cacheKey);

		if (cached) {
			const order = JSON.parse(cached) as OrderDocument;
			const cacheRestaurantId = ObjectIdUtil.toObjectId(
				(order as any).restaurant_id,
				"restaurant_id",
			);
			if (!ObjectIdUtil.isSameObjectId(cacheRestaurantId, resId)) {
				throw new ForbiddenException(
					ERROR_CODE.FORBIDDEN,
					"Order does not belong to this restaurant",
				);
			}

			return this.toPlainObject(order as any);
		}

		const order = await this.getOrderAndThrow(resId, orderId);

		await this.redis.set(
			cacheKey,
			JSON.stringify(order),
			"EX",
			CACHE_ORDER_TTL_SECONDS,
		);

		return this.toPlainObject(order as any);
	}

	async getActiveOrderByTable(
		resId: Types.ObjectId,
		tableId: Types.ObjectId,
	): Promise<{ order: Record<string, unknown> | null }> {
		const table = await this.tableRepository.findByIdInRestaurant(resId, tableId);

		if (!table) {
			throw new NotFoundException(
				ERROR_CODE.RESOURCE_NOT_FOUND,
				"Table not found",
				{ table_id: tableId.toString(), restaurant_id: resId.toString() },
			);
		}

		const activeKey = `${CACHE_ORDER_ACTIVE_PREFIX}${tableId.toString()}`;
		const activeCached = await this.redis.get(activeKey);

		if (activeCached) {
			const activeData = JSON.parse(activeCached) as { order_id?: string };
			const orderId = ObjectIdUtil.tryToObjectId(activeData.order_id);
			if (orderId) {
				const orderCacheKey = `${CACHE_ORDER_PREFIX}${orderId.toString()}`;
				const orderCached = await this.redis.get(orderCacheKey);
				if (orderCached) {
					return { order: JSON.parse(orderCached) as Record<string, unknown> };
				}

				const order = await this.orderRepository.findByIdInRestaurant(resId, orderId);
				if (order) {
					await this.redis.set(
						orderCacheKey,
						JSON.stringify(order),
						"EX",
						CACHE_ORDER_TTL_SECONDS,
					);
					return { order: this.toPlainObject(order as any) };
				}
			}
		}

		const activeOrder = await this.orderRepository.findActiveByTable(resId, tableId);
		if (!activeOrder) {
			return { order: null };
		}

		await this.redis.set(
			activeKey,
			JSON.stringify({ order_id: this.readEntityId(activeOrder as any) }),
			"EX",
			CACHE_ORDER_ACTIVE_TTL_SECONDS,
		);

		return { order: this.toPlainObject(activeOrder as any) };
	}

	async addOrderItems(
		resId: Types.ObjectId,
		orderId: Types.ObjectId,
		payload: AddOrderItemsDto,
	): Promise<Record<string, unknown>> {
		await this.checkWriteRateLimit(orderId);

		const order = await this.getOrderAndThrow(resId, orderId);
		this.assertOrderCanMutateItems(order);

		const newItems = await this.buildOrderItemsSnapshot(resId, payload.items);

		let result: OrderDocument | null = null;
		const session = await this.connection.startSession();
		try {
			result = await session.withTransaction(async () => {
				const updated = await this.orderRepository.addItemsToOrder(
					resId,
					orderId,
					newItems,
					{ session },
				)
				this.recomputeOrderTotals(updated);
				await this.orderRepository.updateOrderTotals(
					resId,
					orderId,
					{
						subtotal: updated.subtotal,
						discount_amount: updated.discount_amount,
						tax_amount: updated.tax_amount,
						service_charge_amount: updated.service_charge_amount,
						total_amount: updated.total_amount,
					},
					{ session },
				);
				return updated;
			});
		} finally {
			await session.endSession();
		}
		if (!result) {
			throw new ConflictException(
				ERROR_CODE.CONFLICT_ERROR,
				"Failed to add items to order, it may have been modified by another process. Please try again.",
			);
		}
		await this.invalidateOrderWriteCaches(result, true);

		return {
			order_id: this.readEntityId(result as any),
			new_items: newItems,
			subtotal: result.subtotal,
			tax_amount: result.tax_amount,
			service_charge_amount: result.service_charge_amount,
			total_amount: result.total_amount,
		};
	}

	async updateOrderItem(
		restaurantId: Types.ObjectId,
		orderId: Types.ObjectId,
		itemId: Types.ObjectId,
		payload: UpdateOrderItemDto,
	): Promise<Record<string, unknown>> {
		await this.checkWriteRateLimit(orderId);

		const order = await this.getOrderAndThrow(restaurantId, orderId);
		this.assertOrderCanMutateItems(order);

		const item = this.findOrderItemOrThrow(order, itemId);
		if (item.status !== OrderItemStatus.PENDING) {
			throw new ConflictException(
				ERROR_CODE.CONFLICT_ERROR,
				`Cannot update item in status ${item.status}`,
			);
		}

		const hasQuantity = payload.quantity !== undefined;
		const hasNotes = payload.notes !== undefined;
		if (
			!hasQuantity && 
			!hasNotes || 
			(hasQuantity && payload.quantity === item.quantity) ||
			(hasNotes && StringUtil.normalizeNullableString(payload.notes) === item.notes)
		) {
			return {
				unchanged: true,
				item: item,
				subtotal: order.subtotal,
				tax_amount: order.tax_amount,
				service_charge_amount: order.service_charge_amount,
				total_amount: order.total_amount,
			};
		}
		if (hasQuantity) {
			item.quantity = payload.quantity as number;
			item.total_price = NumberUtil.round2(item.unit_price * item.quantity);
		}
		if (hasNotes) {
			item.notes = StringUtil.normalizeNullableString(payload.notes);
		}

		let result: OrderDocument | null = null;
		const session = await this.connection.startSession();
		try {
			result = await session.withTransaction(async () => {
				const updated = await this.orderRepository.updateItemQuantityAndNotes(
					restaurantId,
					orderId,
					itemId,
					hasQuantity ? payload.quantity : undefined,
					hasNotes ? StringUtil.normalizeNullableString(payload.notes) : undefined,
					{ session }
				);
	
				this.recomputeOrderTotals(updated);
	
				await this.orderRepository.updateOrderTotals(
					restaurantId,
					orderId,
					{
						subtotal: updated.subtotal,
						discount_amount: updated.discount_amount,
						tax_amount: updated.tax_amount,
						service_charge_amount: updated.service_charge_amount,
						total_amount: updated.total_amount,
					},
					{ session },
				);
				return updated;
			});
		} finally {
			await session.endSession();
		}

		if (!result) {
			throw new ConflictException(
				ERROR_CODE.CONFLICT_ERROR,
				"Failed to update order item, it may have been modified by another process. Please try again.",
			);
		}
		await this.invalidateOrderWriteCaches(result, true);

		return {
			item,
			subtotal: result.subtotal,
			tax_amount: result.tax_amount,
			service_charge_amount: result.service_charge_amount,
			total_amount: result.total_amount,
		};
	}

	async cancelOrderItem(
		restaurantId: Types.ObjectId,
		orderId: Types.ObjectId,
		itemId: Types.ObjectId,
		payload: CancelOrderDto,
		actor: IActor,
	): Promise<Record<string, unknown>> {
		await this.checkWriteRateLimit(orderId);

		const order = await this.getOrderAndThrow(restaurantId, orderId);
		if (TERMINAL_ORDER_STATUSES.has(order.status)) {
			throw new ConflictException(
				ERROR_CODE.CONFLICT_ERROR,
				`Cannot modify item of order in status ${order.status}`,
			);
		}
		const item = this.findOrderItemOrThrow(order, itemId);
		const isAdmin = actor.role === "admin";

		if (!isAdmin && item.status !== OrderItemStatus.PENDING) {
			throw new ConflictException(
				ERROR_CODE.CONFLICT_ERROR,
				`Cannot cancel item in status ${item.status}`,
			);
		}
		let cancelReason = isAdmin ? "Cancelled by admin" : actor.role === "owner" ? "Cancelled by owner" : "Cancelled by staff";
		if (payload.cancel_reason) {
			cancelReason += `: ${payload.cancel_reason}`;
		}
		let result: OrderDocument | null = null;
		const session = await this.connection.startSession();
		try {
			result = await session.withTransaction(async () => {
				const updated = await this.orderRepository.cancelOrderItem(
					restaurantId,
					orderId,
					itemId,
					cancelReason,
					{ session }
				);
				this.recomputeOrderTotals(updated);
	
				await this.orderRepository.updateOrderTotals(
					restaurantId,
					orderId,
					{
						subtotal: updated.subtotal,
						discount_amount: updated.discount_amount,
						tax_amount: updated.tax_amount,
						service_charge_amount: updated.service_charge_amount,
						total_amount: updated.total_amount,
					},
					{ session },
				);
				return updated;
			})

		} finally {
			await session.endSession();
		}

		if (!result) {
			throw new ConflictException(
				ERROR_CODE.CONFLICT_ERROR,
				"Failed to cancel order item, it may have been modified by another process. Please try again.",
			);
		}

		await this.invalidateOrderWriteCaches(result, true);

		return {
			item_id: (item as any)._id,
			status: item.status,
			subtotal: result.subtotal,
			tax_amount: result.tax_amount,
			service_charge_amount: result.service_charge_amount,
			total_amount: result.total_amount,
		};
	}

	async updateOrderStatus(
		restaurantId: Types.ObjectId,
		orderId: Types.ObjectId,
		payload: UpdateOrderStatusDto,
	): Promise<Record<string, unknown>> {
		await this.checkWriteRateLimit(orderId);

		const order = await this.getOrderAndThrow(restaurantId, orderId);
		const fromStatus = order.status;
		const toStatus = payload.status;
		if (fromStatus === toStatus) {
			return {
				unchanged: true,
				id: order._id.toString(),
				order_number: order.order_number,
				status: order.status,
				updated_at: (order as any).updated_at,
			};
		}

		if (!this.isAllowedOrderStatusTransition(fromStatus, toStatus, order.order_type)) {
			throw new ConflictException(
				ERROR_CODE.CONFLICT_ERROR,
				`Cannot transition order status from ${fromStatus} to ${toStatus}`,
			);
		}
		if (toStatus === OrderStatus.DELIVERING && order.order_type !== OrderType.DELIVERY) {
			throw new BadRequestException(
				ERROR_CODE.VALIDATION_ERROR,
				"Only delivery orders can transition to delivering",
			);
		}
		let newStaffId: Types.ObjectId | null = null;
		if (toStatus === OrderStatus.CONFIRMED && payload.staff_id) {
			newStaffId = ObjectIdUtil.toObjectId(payload.staff_id, "staff_id");
		}

		let result: OrderDocument | null = null;
		const session = await this.connection.startSession();
		try {
			result = await session.withTransaction(async () => {
				const updated = await this.orderRepository.updateOrderStatus(
					restaurantId,
					orderId,
					toStatus,
					newStaffId ?? undefined,
					{ session },
				);
	
				if (!updated) {
					throw new ConflictException(
						ERROR_CODE.CONFLICT_ERROR,
						"Failed to update order status, it may have been modified by another process. Please try again.",
					);
				}
	
				if (
					payload.status === OrderStatus.CONFIRMED &&
					order.order_type === OrderType.DINE_IN &&
					order.table_id
				) {
					await this.tableRepository.occupyIfAvailable(
						restaurantId,
						order.table_id,
						{ session },
					);

					await this.redis.del(
						`${CACHE_ORDER_ACTIVE_PREFIX}${order.table_id.toString()}`,
						`${CACHE_TABLE_PREFIX}${order.table_id.toString()}`,
						`${CACHE_TABLE_LIST_PREFIX}${restaurantId.toString()}`,
					)
				}
				return updated;
			})

		} finally {
			await session.endSession();
		}
		if (!result) {
			throw new ConflictException(
				ERROR_CODE.CONFLICT_ERROR,
				"Failed to update order status, it may have been modified by another process. Please try again.",
			);
		}

		await this.invalidateOrderWriteCaches(result, true);

		return {
			id: this.readEntityId(result as any),
			order_number: result.order_number,
			status: result.status,
			updated_at: (result as any).updated_at,
		};
	}

	async updateOrderItemStatus(
		restaurantId: Types.ObjectId,
		orderId: Types.ObjectId,
		itemId: Types.ObjectId,
		payload: UpdateOrderItemStatusDto,
		actor: IActor,
	): Promise<Record<string, unknown>> {
		await this.checkWriteRateLimit(orderId);

		const order = await this.getOrderAndThrow(restaurantId, orderId);

		if (TERMINAL_ORDER_STATUSES.has(order.status)) {
			throw new ConflictException(
				ERROR_CODE.CONFLICT_ERROR,
				`Cannot update item status in order status ${order.status}`,
			);
		}

		if (order.status === OrderStatus.PENDING) {
			if (payload.status !== OrderItemStatus.PREPARING && 
				payload.status !== OrderItemStatus.CANCELLED) {
				throw new BadRequestException(
					ERROR_CODE.VALIDATION_ERROR,
					`Cannot set item to ${payload.status} when order is PENDING`,
				);
			}
		}

		const item = this.findOrderItemOrThrow(order, itemId);
		if (!this.isAllowedItemStatusTransition(item.status, payload.status, actor.role)) {
			throw new ConflictException(
				ERROR_CODE.CONFLICT_ERROR,
				`Cannot transition item status from ${item.status} to ${payload.status}`,
			);
		}

		const updated = await this.orderRepository.updateItemStatus(
			restaurantId,
			orderId,
			itemId,
			payload.status,
		);
		if (!updated) {
			throw new ConflictException(
				ERROR_CODE.CONFLICT_ERROR,
				"Failed to update order item status, it may have been modified by another process. Please try again.",
			);
		}

		await this.redis.del(`${CACHE_ORDER_PREFIX}${orderId.toString()}`);

		return {
			item_id: (item as any)._id,
			status: payload.status,
			updated_at: (updated as any).updated_at,
		};
	}

	async updateOrderDiscount(
		restaurantId: Types.ObjectId,
		orderId: Types.ObjectId,
		payload: UpdateOrderDiscountDto,
		actor: IActor,
	): Promise<Record<string, unknown>> {
		await this.checkWriteRateLimit(orderId);
		this.assertCanDiscount(actor);

		const order = await this.getOrderAndThrow(restaurantId, orderId);

		if (TERMINAL_ORDER_STATUSES.has(order.status)) {
			throw new ConflictException(
				ERROR_CODE.CONFLICT_ERROR,
				"Cannot apply discount for terminal order",
			);
		}

		const subtotal = this.computeSubtotal(order.items as OrderItem[]);
		let discountValue = Number(payload.discount_value ?? 0);

		if (payload.discount_type === OrderDiscountType.NONE) {
			discountValue = 0;
			order.discount_ref = null;
		} else if (payload.discount_type === OrderDiscountType.PERCENT) {
			if (discountValue < 0.01 || discountValue > 1) {
				throw new BadRequestException(
					ERROR_CODE.VALIDATION_ERROR,
					"discount_value for percent must be in range 0.01..1.00",
				);
			}
			order.discount_ref = StringUtil.normalizeNullableString(payload.discount_ref);
		} else if (payload.discount_type === OrderDiscountType.FIXED) {
			if (discountValue < 0 || discountValue >= subtotal) {
				throw new BadRequestException(
					ERROR_CODE.VALIDATION_ERROR,
					"discount_value for fixed must be >= 0 and < subtotal",
				);
			}
			order.discount_ref = StringUtil.normalizeNullableString(payload.discount_ref);
		} else if (payload.discount_type === OrderDiscountType.COUPON) {
			if (discountValue < 0 || discountValue >= subtotal) {
				throw new BadRequestException(
					ERROR_CODE.VALIDATION_ERROR,
					"discount_value for coupon must be >= 0 and < subtotal",
				);
			}
			order.discount_ref = StringUtil.normalizeNullableString(payload.discount_ref);
		}

		order.discount_type = payload.discount_type;
		order.discount_value = discountValue;

		this.recomputeOrderTotals(order);

		await this.orderRepository.update(order._id, {
			discount_type: order.discount_type,
			discount_ref: order.discount_ref,
			discount_value: order.discount_value,
			subtotal: order.subtotal,
			discount_amount: order.discount_amount,
			tax_amount: order.tax_amount,
			service_charge_amount: order.service_charge_amount,
			total_amount: order.total_amount,
		});

		await this.invalidateOrderWriteCaches(order, true);

		return {
			discount_type: order.discount_type,
			discount_ref: order.discount_ref,
			discount_amount: order.discount_amount,
			subtotal: order.subtotal,
			tax_amount: order.tax_amount,
			service_charge_amount: order.service_charge_amount,
			total_amount: order.total_amount,
		};
	}

	async cancelOrder(
		restaurantId: Types.ObjectId,
		orderId: Types.ObjectId,
		payload: CancelOrderDto,
		actor: IActor,
	): Promise<Record<string, unknown>> {
		await this.checkWriteRateLimit(orderId);

		const order = await this.getOrderAndThrow(restaurantId, orderId);
		const role = actor.role;

		if (order.status === OrderStatus.PENDING || order.status === OrderStatus.CONFIRMED) {
			this.assertCanCancelOrder(actor);
		}
		if (order.status === OrderStatus.DELIVERING) {
			throw new ConflictException(
				ERROR_CODE.CONFLICT_ERROR,
				"Cannot cancel delivering order",
			);
		}
		if (
			order.status === OrderStatus.COMPLETED ||
			order.status === OrderStatus.CANCELLED ||
			order.status === OrderStatus.REFUNDED
		) {
			throw new ConflictException(
				ERROR_CODE.CONFLICT_ERROR,
				`Cannot cancel order in status ${order.status}`,
			);
		}
		if (
			(order.status === OrderStatus.PREPARING || order.status === OrderStatus.READY) &&
			role === "staff"
		) {
			throw new ConflictException(
				ERROR_CODE.CONFLICT_ERROR,
				"Staff cannot cancel order in preparing/ready status",
			);
		}

		let result: OrderDocument | null = null;
		const session = await this.connection.startSession();
		try {
			result = await session.withTransaction(async () => {
				const updated = await this.orderRepository.cancelOrder(
					restaurantId,
					orderId,
					payload.cancel_reason,
					{ session },
				)
				
				if (!updated) {
					throw new ConflictException(
						ERROR_CODE.CONFLICT_ERROR,
						"Failed to cancel order, it may have been modified by another process. Please try again.",
					);
				}

				await this.orderRepository.cancelMultipleOrderItems(
					restaurantId,
					orderId,
					{ session },
				);

				if (updated.order_type === OrderType.DINE_IN && updated.table_id) {
					const otherActive = await this.orderRepository.countOtherActiveByTable(
						restaurantId,
						updated.table_id,
						updated._id,
					);
					if (otherActive === 0) {
						await this.tableRepository.updateStatus(
							restaurantId,
							updated.table_id,
							TableStatus.AVAILABLE,
							{ session },
						);
					}
					await this.redis.del(
						`${CACHE_ORDER_ACTIVE_PREFIX}${updated.table_id.toString()}`,
						`${CACHE_TABLE_PREFIX}${updated.table_id.toString()}`,
					);
				}

				return updated;
			})
		} finally {
			await session.endSession();
		}

		await this.invalidateOrderWriteCaches(order, true);

		return {
			id: this.readEntityId(order as any),
			order_number: order.order_number,
			status: order.status,
			cancel_reason: order.cancel_reason,
			cancelled_at: order.cancelled_at,
		};
	}

	private async getOrderAndThrow(resId: Types.ObjectId, orderId: Types.ObjectId): Promise<OrderDocument> {
		const order = await this.orderRepository.findByIdInRestaurant(resId, orderId);
		if (!order) {
			throw new NotFoundException(
				ERROR_CODE.RESOURCE_NOT_FOUND,
				"Order not found",
				{ order_id: orderId.toString(), restaurant_id: resId.toString() },
			);
		}

		return order;
	}

	async create(dto: CreateOrderDto): Promise<Record<string, unknown>> {
		const restaurantIdRaw = (dto as any).restaurant_id ?? (dto as any).restaurantId;
		if (!restaurantIdRaw) {
			throw new BadRequestException(
				ERROR_CODE.VALIDATION_ERROR,
				"restaurant_id is required",
			);
		}

		const restaurantId = ObjectIdUtil.toObjectId(restaurantIdRaw, "restaurant_id");

		const payload: CreatePosOrderDto = {
			order_type: (dto as any).order_type ?? OrderType.TAKEAWAY,
			source: (dto as any).source ?? OrderSource.POS,
			table_id: (dto as any).table_id,
			customer_name: (dto as any).customer_name,
			customer_phone: (dto as any).customer_phone,
			notes: (dto as any).notes,
			items: this.mapLegacyItems((dto as any).items),
		};

		return this.createPosOrder(restaurantId, payload, { role: "owner" });
	}

	async createDraftOrder(dto: CreateOrderDto): Promise<Record<string, unknown>> {
		const payload = {
			...(dto as any),
			items: [],
		} as CreateOrderDto;

		return this.create(payload);
	}

	async getListDraftOrders(
		restaurantId: Types.ObjectId,
		userId?: Types.ObjectId,
	): Promise<PaginatedOrdersResult> {
		return this.listOrders(
			restaurantId,
			{ status: OrderStatus.PENDING, page: 1, limit: 100 } as ListOrdersQueryDto,
			userId ? { user_id: userId } : undefined,
		);
	}

	async getOrdersForUser(
		restaurantId: Types.ObjectId,
		userId: Types.ObjectId,
	): Promise<PaginatedOrdersResult> {
		return this.listOrders(
			restaurantId,
			{ page: 1, limit: 100 } as ListOrdersQueryDto,
			{ user_id: userId },
		);
	}

	async findOrdersByRestaurant(
		restaurantId: Types.ObjectId,
		page: number,
		limit: number,
		filters: Partial<ListOrdersQueryDto>,
	): Promise<PaginatedOrdersResult> {
		return this.listOrders(
			restaurantId,
			{
				...filters,
				page,
				limit,
			} as ListOrdersQueryDto,
		);
	}

	async getOrderCheckoutDetailsById(orderId: Types.ObjectId): Promise<Record<string, unknown>> {
		const order = await this.orderRepository.findById(orderId);
		if (!order) {
			throw new NotFoundException(
				ERROR_CODE.RESOURCE_NOT_FOUND,
				"Order not found",
			);
		}

		const restaurantId = ObjectIdUtil.toObjectId((order as any).restaurant_id, "restaurant_id");
		return this.getOrderDetail(restaurantId, orderId);
	}

	private async assertTableAvailableForNewOrder(
		restaurantId: Types.ObjectId,
		tableId: Types.ObjectId,
	): Promise<void> {
		const table = await this.tableRepository.findByIdInRestaurant(
			restaurantId,
			tableId,
		);

		if (!table) {
			throw new NotFoundException(
				ERROR_CODE.RESOURCE_NOT_FOUND,
				"Table not found",
			);
		}

		if (!table.is_active) {
			throw new BadRequestException(
				ERROR_CODE.VALIDATION_ERROR,
				"Table is inactive",
			);
		}

		if (table.status !== TableStatus.AVAILABLE) {
			throw new ConflictException(
				ERROR_CODE.CONFLICT_ERROR,
				"Table is not available for new order",
			);
		}

		const cacheKey = `${CACHE_ORDER_ACTIVE_PREFIX}${tableId.toString()}`;
		const cached = await this.redis.get(cacheKey);
		if (cached) {
			throw new ConflictException(
				ERROR_CODE.CONFLICT_ERROR,
				"Table has active unpaid order",
			)
		}

		// Không get mongodb vì có findOneAndUpdate phía sau
	}

	private async buildOrderItemsSnapshot(
		restaurantId: Types.ObjectId,
		itemInputs: OrderItemInputDto[],
	): Promise<OrderItem[]> {
		if (!itemInputs.length) return [];

		// Merge dulicate
		const mergedMap = new Map<string, OrderItemInputDto>();
		for (const item of itemInputs) {
			const key = item.menu_item_id.toString();
			if (mergedMap.has(key)) {
				const existing = mergedMap.get(key)!;
				existing.quantity += item.quantity;
				if (item.notes && item.notes !== existing.notes) {
					existing.notes = [ existing.notes, item.notes].filter(Boolean).join(" , ");
				}
			} else {
				mergedMap.set(key, { ...item });
			}
		}
		const mergedInputs = Array.from(mergedMap.values());
		const uniqueIds = mergedInputs.map((i) =>
			ObjectIdUtil.toObjectId(i.menu_item_id, "menu_item_id"),
		);

		const menuItemsInDB = await this.menuItemRepository.getAvailableItemsByUniqueIdsInRestaurant(restaurantId, uniqueIds);

		const menuMap = new Map<string, MenuItemDocument>();
		for (const item of menuItemsInDB) {
			item._id
			menuMap.set((item as any)._id.toString(), item as MenuItemDocument);
		}

		const snapshots: OrderItem[] = [];
		for (const i of mergedInputs) {
			const menuItemId = ObjectIdUtil.toObjectId(i.menu_item_id, "menu_item_id");
			const menuItem = menuMap.get(menuItemId.toString());
			if (!menuItem) {
				throw new NotFoundException(
					ERROR_CODE.RESOURCE_NOT_FOUND,
					`Menu item is not available: ${menuItemId.toString()}`,
				);
			}
			
			const unitPrice = menuItem.base_price;
			snapshots.push({
				menu_item_id: menuItemId,
				item_name: menuItem.name,
				quantity: i.quantity,
				unit_price: unitPrice,
				total_price: NumberUtil.round2(unitPrice * i.quantity),
				status: OrderItemStatus.PENDING,
				notes: StringUtil.normalizeNullableString(i.notes),
				created_at: new Date(),
			} as OrderItem);
		}

		return snapshots;
	}

	private recomputeOrderTotals(order: OrderDocument): void {
		const items = (order.items ?? []) as unknown as OrderItem[];
		const subtotal = this.computeSubtotal(items);
		const discountAmount = this.resolveDiscountAmount(
			order.discount_type,
			Number((order as any).discount_value ?? 0),
			subtotal,
		);

		const taxable = Math.max(subtotal - discountAmount, 0);
		const taxAmount = NumberUtil.round2(taxable * Number(order.tax_rate ?? 0));
		const serviceChargeAmount = NumberUtil.round2(
			taxable * Number(order.service_charge_rate ?? DEFAULT_SERVICE_CHARGE_RATE),
		);
		const totalAmount = NumberUtil.round2(taxable + taxAmount + serviceChargeAmount);

		order.subtotal = subtotal;
		order.discount_amount = discountAmount;
		order.tax_amount = taxAmount;
		order.service_charge_amount = serviceChargeAmount;
		order.total_amount = totalAmount;
	}

	private computeSubtotal(items: OrderItem[]): number {
		const subtotal = items
			.filter((item) => item.status !== OrderItemStatus.CANCELLED)
			.reduce((sum, item) => sum + Number(item.total_price ?? 0), 0);

		return NumberUtil.round2(subtotal);
	}

	private resolveDiscountAmount(
		discountType: OrderDiscountType,
		discountValue: number,
		subtotal: number,
	): number {
		if (discountType === OrderDiscountType.NONE) return 0;

		if (discountType === OrderDiscountType.PERCENT) {
			if (discountValue <= 0) return 0;
			return NumberUtil.round2(subtotal * discountValue);
		}

		if (discountType === OrderDiscountType.FIXED || discountType === OrderDiscountType.COUPON) {
			if (discountValue <= 0) return 0;
			return NumberUtil.round2(Math.min(discountValue, subtotal));
		}

		return 0;
	}

	private assertOrderCanMutateItems(order: Order): void {
		if (!ADDABLE_STATUSES.has(order.status)) {
			throw new ConflictException(
				ERROR_CODE.CONFLICT_ERROR,
				`Cannot modify items when order status is ${order.status}`,
			);
		}
	}

	private isAllowedOrderStatusTransition(
		from: OrderStatus,
		to: OrderStatus,
		orderType: OrderType,
	): boolean {
		const allowed = VALID_TRANSITIONS.get(from);
		
		if (to === OrderStatus.DELIVERING && orderType === OrderType.DELIVERY) return true;
		if (!allowed || !allowed.has(to)) {
			return false;
		}
		return true;
	}

	private isAllowedItemStatusTransition(
		from: OrderItemStatus,
		to: OrderItemStatus,
		actorRole: ActorRole,
	): boolean {
		if (from === to) return true;

		const isHasPermission = actorRole === "admin" || actorRole === "owner";

		if (from === OrderItemStatus.PENDING) {
			return to === OrderItemStatus.PREPARING || to === OrderItemStatus.CANCELLED;
		}

		if (from === OrderItemStatus.PREPARING) {
			if (to === OrderItemStatus.READY) return true;
			if (to === OrderItemStatus.CANCELLED && isHasPermission) return true;
			return false;
		}

		if (from === OrderItemStatus.READY) {
			if (to === OrderItemStatus.SERVED) return true;
			if (to === OrderItemStatus.CANCELLED && isHasPermission) return true;
			return false;
		}

		return false;
	}

	private assertCanDiscount(actor: IActor): void {
		if (actor.role === "staff" && actor.permissions?.can_discount !== true) {
			throw new ForbiddenException(
				ERROR_CODE.FORBIDDEN,
				"Staff does not have discount permission",
			);
		}
	}

	private assertCanCancelOrder(actor: IActor): void {
		if (actor.role === "staff" && actor.permissions?.can_cancel_order !== true) {
			throw new ForbiddenException(
				ERROR_CODE.FORBIDDEN,
				"Staff does not have cancel order permission",
			);
		}
	}

	private findOrderItemOrThrow(order: OrderDocument, itemId: Types.ObjectId): OrderItem {
		const item = (order.items as any[]).find(
			(it) => it._id && it._id.toString() === itemId.toString(),
		) as OrderItem | undefined;

		if (!item) {
			throw new NotFoundException(
				ERROR_CODE.RESOURCE_NOT_FOUND,
				"Order item not found",
				{ item_id: itemId.toString() },
			);
		}

		return item;
	}

	private async generateOrderNumber(restaurantId: Types.ObjectId): Promise<string> {
		const dateKey = TimeUtil.getCurrentHcmDateKey();
		const seqKey = `${ORDER_SEQUENCE_PREFIX}${restaurantId.toString()}:${dateKey}`;
		const seq = await this.redis.incr(seqKey);

		if (seq === 1) {
			await this.redis.expire(seqKey, ORDER_SEQUENCE_TTL_SECONDS);
		}

		const width = seq > 9999 ? 5 : 4;
		return `${dateKey}-${String(seq).padStart(width, "0")}`;
	}

	private getDateRangeByHcm(date?: string): {
		start: Date;
		end: Date;
		dateKey: string;
		isToday: boolean;
	} {
		let ymd: string;
		if (date) {
			if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
				ymd = date;
			} else {
				const parsed = new Date(date);
				if (Number.isNaN(parsed.getTime())) {
					throw new BadRequestException(
						ERROR_CODE.VALIDATION_ERROR,
						"date is invalid",
					);
				}

				ymd = TimeUtil.formatDateByTimezone(parsed);
			}

		} else {
			ymd = TimeUtil.formatDateByTimezone(new Date());
		}

		const start = new Date(`${ymd}T00:00:00.000+07:00`);
		const end = new Date(`${ymd}T23:59:59.999+07:00`);
		const dateKey = ymd.replace(/-/g, "");

		return {
			start,
			end,
			dateKey,
			isToday: dateKey === TimeUtil.getCurrentHcmDateKey(),
		};
	}

	private async checkCreateRateLimit(restaurantId: Types.ObjectId): Promise<void> {
		await this.checkRateLimit(
			`${RATE_LIMIT_ORDER_CREATE_PREFIX}${restaurantId.toString()}`,
			RATE_LIMIT_ORDER_CREATE_MAX,
			RATE_LIMIT_ORDER_CREATE_TTL_SECONDS,
			"Too many order creations",
		);
	}

	private async checkWriteRateLimit(orderId: Types.ObjectId): Promise<void> {
		await this.checkRateLimit(
			`${RATE_LIMIT_ORDER_WRITE_PREFIX}${orderId.toString()}`,
			RATE_LIMIT_ORDER_WRITE_MAX,
			RATE_LIMIT_ORDER_WRITE_TTL_SECONDS,
			"Too many order write operations",
		);
	}

	private async checkRateLimit(
		key: string,
		max: number,
		ttlSeconds: number,
		message: string,
	): Promise<void> {
		const count = await this.redis.incr(key);
		if (count === 1) {
			await this.redis.expire(key, ttlSeconds);
		}

		if (count > max) {
			throw new TooManyRequestException(ERROR_CODE.TOO_MANY_REQUESTS, message);
		}
	}

	private async invalidateOrderWriteCaches(order: OrderDocument, includeList: boolean): Promise<void> {
		const keys: string[] = [`${CACHE_ORDER_PREFIX}${this.readEntityId(order as any)}`];

		if (includeList) {
			const restaurantId = ObjectIdUtil.toObjectId((order as any).restaurant_id, "restaurant_id");
			const dateKey = this.getDateKeyFromDate((order as any).created_at ?? new Date());
			keys.push(`${CACHE_ORDER_LIST_PREFIX}${restaurantId.toString()}:${dateKey}`);
		}

		await this.redis.del(...keys);
	}

	private async invalidateOrderListCacheByDate(
		restaurantId: Types.ObjectId,
		date: Date,
	): Promise<void> {
		const dateKey = this.getDateKeyFromDate(date);
		await this.redis.del(`${CACHE_ORDER_LIST_PREFIX}${restaurantId.toString()}:${dateKey}`);
	}

	private getDateKeyFromDate(date: Date): string {
		return TimeUtil.getDateKeyByTimezone(date);
	}

	private mapLegacyItems(items: any[] | undefined): OrderItemInputDto[] {
		if (!Array.isArray(items)) return [];

		return items.map((item) => ({
			menu_item_id: item.menu_item_id ?? item.itemId,
			quantity: item.quantity,
			notes: item.notes ?? item.note,
		} as OrderItemInputDto));
	}

	private toPlainObject(entity: any): Record<string, any> {
		if (entity && typeof entity.toObject === "function") {
			return entity.toObject();
		}
		return { ...entity };
	}

	private readEntityId(entity: Record<string, any>): string {
		if (entity.id) return String(entity.id);
		if (entity._id) return String(entity._id);
		return "";
	}

	private async postOrderCacheUpdate(
		resId: Types.ObjectId,
		order: OrderDocument,
		tableId: Types.ObjectId | null,
	): Promise<void> {
		if (tableId) {
			await this.redis.set(
				`${CACHE_ORDER_ACTIVE_PREFIX}${tableId.toString()}`,
				JSON.stringify({ order_id: order._id.toString() }),
				"EX",
				CACHE_ORDER_ACTIVE_TTL_SECONDS,
			);

			await this.redis.del(`${CACHE_TABLE_PREFIX}${tableId.toString()}`);
			await this.redis.del(`${CACHE_TABLE_LIST_PREFIX}${resId.toString()}`);
		}

		await this.invalidateOrderListCacheByDate( resId, (order as any).created_at );
	}
}
