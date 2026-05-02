import { Inject, Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import Redis from 'ioredis';
import { ERROR_CODE } from 'src/common/constants/error-code.constant';
import { INJECTION_TOKEN } from 'src/common/constants/injection-token.constant';
import {
	BadRequestException,
	ConflictException,
	NotFoundException,
	TooManyRequestException,
} from 'src/common/exceptions';
import { NumberUtil } from 'src/common/utils/number.util';
import { ObjectIdUtil } from 'src/common/utils/object-id.util';
import { StringUtil } from 'src/common/utils/string.util';
import { TimeUtil } from 'src/common/utils/time.util';
import {
	CreatePaymentByCashDto,
	CreatePaymentDto,
	RefundPaymentDto,
} from './dto/create-payment.dto';
import {
	IPaymentRepository,
	IPaymentSettlementSummary,
} from './repositories/payment.repository';
import {
	GATEWAY_METHODS,
	INSTANT_COMPLETE_METHODS,
	PAYMENT_NUMBER_PREFIX,
	PAYMENT_NUMBER_SEQ_PADDING,
	Payment,
	PaymentDocument,
	PaymentMethod,
	PaymentStatus,
	REFUNDABLE_PAYMENT_STATUSES,
	REFERENCE_NUMBER_REQUIRED_METHODS,
} from './schemas/payment.schema';
import {
	OrderDocument,
	OrderPaymentStatus,
	OrderStatus,
} from '../order/schemas/order.schema.xxx';
import { IOrderRepository } from '../order/repositories/order.repository';

const PAYMENT_CREATE_ALLOWED_ORDER_STATUSES = new Set<OrderStatus>([
	OrderStatus.CONFIRMED,
	OrderStatus.PREPARING,
	OrderStatus.READY,
	OrderStatus.COMPLETED,
]);

const PAYMENT_CREATE_RATE_LIMIT_PREFIX = 'ratelimit:payment:create:';
const PAYMENT_CREATE_RATE_LIMIT_TTL_SECONDS = 60;
const PAYMENT_CREATE_RATE_LIMIT_MAX = 10;

const PAYMENT_REFUND_RATE_LIMIT_PREFIX = 'ratelimit:payment:refund:';
const PAYMENT_REFUND_RATE_LIMIT_TTL_SECONDS = 60;
const PAYMENT_REFUND_RATE_LIMIT_MAX = 5;

const PAYMENT_SEQUENCE_PREFIX = 'payment:seq:';
const PAYMENT_SEQUENCE_TTL_SECONDS = 86400;

const PAYMENT_PENDING_TTL_SECONDS = 900;
const PAYMENT_PENDING_EXPIRES_MS = 15 * 60 * 1000;

const CACHE_PAYMENT_PREFIX = 'payment:';
const CACHE_PAYMENT_LIST_PREFIX = 'payment:list:';
const CACHE_PENDING_PAYMENT_PREFIX = 'payment:pending:';

interface ICreatePaymentInput {
	restaurantId: Types.ObjectId;
	orderId: Types.ObjectId;
	method: PaymentMethod;
	amount: number;
	idempotencyKey: string;
	cashTendered?: number | null;
	referenceNumber?: string | null;
	notes?: string | null;
	returnUrl?: string | null;
	processedBy?: Types.ObjectId | null;
	paymentUrl?: string | null;
	qrCodeUrl?: string | null;
	gatewayResponse?: Record<string, unknown> | null;
}

@Injectable()
export class PaymentService {
	constructor(
		@Inject(INJECTION_TOKEN.PAYMENT_REPOSITORY)
		private readonly paymentRepository: IPaymentRepository,

		@Inject(INJECTION_TOKEN.ORDER_REPOSITORY)
		private readonly orderRepository: IOrderRepository,

		@InjectConnection()
		private readonly connection: Connection,

		@Inject(INJECTION_TOKEN.REDIS_CLIENT)
		private readonly redis: Redis,
	) {}

	async paymentByCash(
		dto: CreatePaymentByCashDto,
		restaurantId: Types.ObjectId | string,
		orderId: Types.ObjectId | string,
		actorId?: string | null,
	): Promise<Record<string, unknown>> {
		const method = dto.method;
		if (method !== PaymentMethod.CASH) {
			throw new BadRequestException(
				ERROR_CODE.VALIDATION_ERROR,
				'cash endpoint only accepts method=cash',
			);
		}
		
		const restaurantObjectId = ObjectIdUtil.toObjectId(restaurantId, 'restaurantId');
		const orderObjectId = ObjectIdUtil.toObjectId(orderId, 'orderId');
		const amount = NumberUtil.round2(Number(dto.amount ?? 0));
		const cashTendered = NumberUtil.round2(Number(dto.cash_tendered ?? 0));

		return this.createPaymentInternal({
			restaurantId: restaurantObjectId,
			orderId: orderObjectId,
			method,
			amount,
			idempotencyKey: dto.idempotency_key,
			cashTendered,
			referenceNumber: null,
			notes: dto.notes,
			processedBy: actorId
				? ObjectIdUtil.toObjectId(actorId, 'processedBy')
				: null,
		});
	}

	async createNonCashPayment(
		dto: CreatePaymentDto,
		restaurantId: Types.ObjectId | string,
		orderId: Types.ObjectId | string,
		actorId?: string | null,
	): Promise<Record<string, unknown>> {
		const method = dto.method;
		if (method === PaymentMethod.CASH) {
			throw new BadRequestException(
				ERROR_CODE.VALIDATION_ERROR,
				'cash payments must use /payments/cash endpoint',
			);
		}

		const isSupported =
			INSTANT_COMPLETE_METHODS.includes(method) || GATEWAY_METHODS.includes(method);
		if (!isSupported) {
			throw new BadRequestException(
				ERROR_CODE.VALIDATION_ERROR,
				`Unsupported payment method: ${method}`,
			);
		}

		const restaurantObjectId = ObjectIdUtil.toObjectId(restaurantId, 'restaurantId');
		const orderObjectId = ObjectIdUtil.toObjectId(orderId, 'orderId');
		const amount = NumberUtil.round2(Number(dto.amount ?? 0));

		return this.createPaymentInternal({
			restaurantId: restaurantObjectId,
			orderId: orderObjectId,
			method,
			amount,
			idempotencyKey: dto.idempotency_key,
			referenceNumber:  null,
			notes: dto.notes,
			returnUrl: dto.return_url,
			processedBy: actorId
				? ObjectIdUtil.toObjectId(actorId, 'processedBy')
				: null,
		});
	}

	async refundPayment(
		resId: string,
		orderId: string,
		paymentId: string,
		dto: RefundPaymentDto
	): Promise<Record<string, unknown>> {
		const resObjecId = ObjectIdUtil.toObjectId(resId, 'restaurantId');
		const orderObjectId = ObjectIdUtil.toObjectId(orderId, 'orderId');
		const paymentObjectId = ObjectIdUtil.toObjectId(paymentId, 'paymentId');
		const refundAmount = NumberUtil.round2(Number(dto.refund_amount ?? 0));
		const refundReason = StringUtil.normalizeNullableString(dto.refund_reason);

		if (!refundReason) {
			throw new BadRequestException(
				ERROR_CODE.VALIDATION_ERROR,
				'refundReason is required',
			);
		}

		await this.checkRefundRateLimit(orderObjectId);

		let transactionResult:
			| {
					updatedPayment: PaymentDocument;
					nextOrderStatus: OrderStatus;
					nextOrderPaymentStatus: OrderPaymentStatus;
			  }
			| null = null;

		const session = await this.connection.startSession();
		try {
			transactionResult = await session.withTransaction(async () => {
				const order = await this.orderRepository.findMutableByIdInRestaurant(
					resObjecId,
					orderObjectId,
					{ session },
				);

				if (!order) {
					throw new NotFoundException(
						ERROR_CODE.RESOURCE_NOT_FOUND,
						'Order not found',
						{ order_id: orderObjectId.toString(), restaurant_id: resObjecId.toString() },
					);
				}

				const payment = await this.paymentRepository.findByIdInOrder(
					resObjecId,
					orderObjectId,
					paymentObjectId,
					{ session },
				);

				if (!payment) {
					throw new NotFoundException(
						ERROR_CODE.RESOURCE_NOT_FOUND,
						'Payment not found',
						{
							payment_id: paymentObjectId.toString(),
							order_id: orderObjectId.toString(),
							restaurant_id: resObjecId.toString(),
						},
					);
				}

				if (!REFUNDABLE_PAYMENT_STATUSES.includes(payment.status)) {
					throw new ConflictException(
						ERROR_CODE.CONFLICT_ERROR,
						`Cannot refund payment in status ${payment.status}`,
					);
				}

				const maxRefundable = NumberUtil.round2(
					Number(payment.amount ?? 0) - Number(payment.refunded_amount ?? 0),
				);

				if (refundAmount <= 0) {
					throw new BadRequestException(
						ERROR_CODE.VALIDATION_ERROR,
						'refundAmount must be greater than 0',
					);
				}

				if (refundAmount > maxRefundable) {
					throw new BadRequestException(
						ERROR_CODE.VALIDATION_ERROR,
						`refundAmount exceeds max refundable amount: ${maxRefundable}`,
					);
				}

				const nextRefundedAmount = NumberUtil.round2(
					Number(payment.refunded_amount ?? 0) + refundAmount,
				);

				const nextPaymentStatus =
					nextRefundedAmount >= Number(payment.amount ?? 0)
						? PaymentStatus.REFUNDED
						: PaymentStatus.PARTIALLY_REFUNDED;

				const updatedPayment = await this.paymentRepository.updateByIdInOrder(
					resObjecId,
					orderObjectId,
					paymentObjectId,
					{
						refunded_amount: nextRefundedAmount,
						refund_reason: refundReason,
						refunded_at: payment.refunded_at ?? new Date(),
						status: nextPaymentStatus,
					},
					{ session },
				);

				if (!updatedPayment) {
					throw new ConflictException(
						ERROR_CODE.CONFLICT_ERROR,
						'Failed to update payment refund state',
					);
				}

				const settlement = await this.paymentRepository.aggregateSettlementByOrder(orderObjectId, {
					session,
				});

				const nextOrderPaymentStatus = this.resolveOrderPaymentStatus(
					settlement,
					Number(order.total_amount ?? 0),
				);

				const nextOrderStatus =
					nextOrderPaymentStatus === OrderPaymentStatus.REFUNDED &&
					order.status === OrderStatus.COMPLETED
						? OrderStatus.REFUNDED
						: order.status;

				const updatedOrder = await this.orderRepository.updatePaymentState(
					resObjecId,
					orderObjectId,
					nextOrderPaymentStatus,
					nextOrderStatus,
					{ session },
				);

				if (!updatedOrder) {
					throw new ConflictException(
						ERROR_CODE.CONFLICT_ERROR,
						'Failed to update order payment state',
					);
				}

				return {
					updatedPayment,
					nextOrderStatus,
					nextOrderPaymentStatus,
				};
			});
		} finally {
			await session.endSession();
		}

		if (!transactionResult?.updatedPayment) {
			throw new ConflictException(
				ERROR_CODE.CONFLICT_ERROR,
				'Failed to refund payment',
			);
		}

		const { updatedPayment, nextOrderStatus, nextOrderPaymentStatus } = transactionResult;

		await this.invalidatePaymentCaches(orderObjectId, paymentObjectId, false);
		await this.cachePaymentDetail(updatedPayment);

		return {
			payment_id: paymentObjectId.toString(),
			refunded_amount: updatedPayment.refunded_amount,
			payment_status: updatedPayment.status,
			refunded_at: updatedPayment.refunded_at,
			order_payment_status: nextOrderPaymentStatus,
			order_status: nextOrderStatus,
		};
	}

	async listPayments(
		restaurantId: Types.ObjectId | string,
		orderId: Types.ObjectId | string,
	): Promise<Record<string, unknown>> {
		const restaurantObjectId = ObjectIdUtil.toObjectId(restaurantId, 'restaurantId');
		const orderObjectId = ObjectIdUtil.toObjectId(orderId, 'orderId');
		const cacheKey = `${CACHE_PAYMENT_LIST_PREFIX}${orderObjectId.toString()}`;

		const cached = await this.redis.get(cacheKey);
		if (cached) {
			return JSON.parse(cached) as Record<string, unknown>;
		}

		const order = await this.orderRepository.findByIdInRestaurant(
			restaurantObjectId,
			orderObjectId,
		);

		if (!order) {
			throw new NotFoundException(
				ERROR_CODE.RESOURCE_NOT_FOUND,
				'Order not found',
				{
					order_id: orderObjectId.toString(),
					restaurant_id: restaurantObjectId.toString(),
				},
			);
		}

		const [payments, settlement] = await Promise.all([
			this.paymentRepository.listByOrder(restaurantObjectId, orderObjectId),
			this.paymentRepository.aggregateSettlementByOrder(orderObjectId),
		]);

		const response = {
			payments: payments.map((payment) => this.toPaymentListItem(payment)),
			summary: this.buildOrderPaymentSummary(order, settlement),
		};

		await this.redis.set(cacheKey, JSON.stringify(response), 'EX', 120);

		return response;
	}

	async getPaymentById(
		restaurantId: Types.ObjectId | string,
		orderId: Types.ObjectId | string,
		paymentId: Types.ObjectId | string,
		includeGatewayResponse = false,
	): Promise<Record<string, unknown>> {
		const restaurantObjectId = ObjectIdUtil.toObjectId(restaurantId, 'restaurantId');
		const orderObjectId = ObjectIdUtil.toObjectId(orderId, 'orderId');
		const paymentObjectId = ObjectIdUtil.toObjectId(paymentId, 'paymentId');
		const cacheKey = `${CACHE_PAYMENT_PREFIX}${paymentObjectId.toString()}`;

		if (!includeGatewayResponse) {
			const cached = await this.redis.get(cacheKey);
			if (cached) {
				return JSON.parse(cached) as Record<string, unknown>;
			}
		}

		const payment = await this.paymentRepository.findById(paymentObjectId);
		if (!payment) {
			throw new NotFoundException(
				ERROR_CODE.RESOURCE_NOT_FOUND,
				'Payment not found',
				{ payment_id: paymentObjectId.toString() },
			);
		}

		if (
			!ObjectIdUtil.isSameObjectId(payment.restaurant_id, restaurantObjectId) ||
			!ObjectIdUtil.isSameObjectId(payment.order_id, orderObjectId)
		) {
			throw new NotFoundException(
				ERROR_CODE.RESOURCE_NOT_FOUND,
				'Payment not found',
				{
					payment_id: paymentObjectId.toString(),
					order_id: orderObjectId.toString(),
					restaurant_id: restaurantObjectId.toString(),
				},
			);
		}

		const response = this.toPaymentDetailItem(payment, includeGatewayResponse);
		if (!includeGatewayResponse) {
			await this.redis.set(cacheKey, JSON.stringify(response), 'EX', 300);
		}

		return response;
	}

	private async createPaymentInternal(
		input: ICreatePaymentInput,
	): Promise<Record<string, unknown>> {
		await this.checkCreateRateLimit(input.orderId);

		const existing = await this.paymentRepository.findByRestaurantAndIdempotencyKey(
			input.restaurantId,
			input.idempotencyKey,
		);

		if (existing) {
			return this.resolveIdempotentResult(existing, input.restaurantId, input.orderId);
		}

		let transactionResult:{
			createdPayment: PaymentDocument;
			orderPaymentStatus: OrderPaymentStatus | null;
		} | null = null;

		const session = await this.connection.startSession();
		try {
			transactionResult = await session.withTransaction(async () => {
				const existingInTxn = await this.paymentRepository.findByRestaurantAndIdempotencyKey(
					input.restaurantId,
					input.idempotencyKey,
					{ session },
				);

				if (existingInTxn) {
					const orderInTxn = await this.orderRepository.findMutableByIdInRestaurant(
						input.restaurantId,
						input.orderId,
						{ session },
					);

					const orderPaymentStatus = (orderInTxn?.payment_status ??
						OrderPaymentStatus.UNPAID) as OrderPaymentStatus;

					if (!ObjectIdUtil.isSameObjectId(existingInTxn.order_id, input.orderId)) {
						throw new ConflictException(
							ERROR_CODE.CONFLICT_ERROR,
							'idempotencyKey is already used for another order',
						);
					}

					if (existingInTxn.status === PaymentStatus.FAILED) {
						throw new ConflictException(
							ERROR_CODE.CONFLICT_ERROR,
							'Idempotency key is already bound to a failed payment, please use a new key',
						);
					}

					return {
						createdPayment: existingInTxn,
						orderPaymentStatus,
					};
				}

				const order = await this.orderRepository.findMutableByIdInRestaurant(
					input.restaurantId,
					input.orderId,
					{ session },
				);

				if (!order) {
					throw new NotFoundException(
						ERROR_CODE.RESOURCE_NOT_FOUND,
						'Order not found',
						{
							order_id: input.orderId.toString(),
							restaurant_id: input.restaurantId.toString(),
						},
					);
				}

				this.assertOrderCanCreatePayment(order);

				const settlementBefore = await this.paymentRepository.aggregateSettlementByOrder(
					input.orderId,
					{ session },
				);

				const remainingAmount = this.computeRemainingAmount(
					Number(order.total_amount ?? 0),
					settlementBefore.net_paid,
					settlementBefore.pending_hold,
				);

				if (remainingAmount <= 0) {
					throw new ConflictException(
						ERROR_CODE.CONFLICT_ERROR,
						'Order is already fully paid',
					);
				}

				if (input.amount <= 0) {
					throw new BadRequestException(
						ERROR_CODE.VALIDATION_ERROR,
						'Payment amount must be greater than 0',
					);
				}

				if (input.amount > remainingAmount) {
					throw new BadRequestException(
						ERROR_CODE.VALIDATION_ERROR,
						`Payment amount exceeds remaining amount: ${remainingAmount}`,
					);
				}

				this.assertMethodPayload(input);

				const paymentNumber = await this.generatePaymentNumber(input.restaurantId);
				const now = new Date();
				const isGateway = GATEWAY_METHODS.includes(input.method);
				const status = isGateway ? PaymentStatus.PENDING : PaymentStatus.COMPLETED;

				const cashTendered =
					input.method === PaymentMethod.CASH
						? NumberUtil.round2(Number(input.cashTendered ?? 0))
						: null;

				const changeAmount =
					input.method === PaymentMethod.CASH
						? NumberUtil.round2(Number(cashTendered ?? 0) - input.amount)
						: 0;

				const normalizedReference = StringUtil.normalizeNullableString(
					input.referenceNumber,
				);

				const createdPayment = await this.paymentRepository.createOne(
					{
						order_id: input.orderId,
						restaurant_id: input.restaurantId,
						payment_number: paymentNumber,
						amount: NumberUtil.round2(input.amount),
						cash_tendered: cashTendered,
						currency: order.currency ?? 'VND',
						method: input.method,
						status,
						reference_number: normalizedReference,
						idempotency_key: input.idempotencyKey,
						change_amount: changeAmount,
						processed_by: input.processedBy ?? null,
						processed_at: status === PaymentStatus.COMPLETED ? now : null,
						expires_at: status === PaymentStatus.PENDING
							? new Date(now.getTime() + PAYMENT_PENDING_EXPIRES_MS)
							: null,
						failed_reason: null,
						gateway_response: null,
						refunded_amount: 0,
						refunded_at: null,
						refund_reason: null,
						notes: StringUtil.normalizeNullableString(input.notes),
					} as Partial<Payment>,
					{ session },
				);

				if (!createdPayment) {
					throw new ConflictException(
						ERROR_CODE.CONFLICT_ERROR,
						'Failed to create payment',
					);
				}

				let orderPaymentStatus: OrderPaymentStatus | null = null;
				if (status === PaymentStatus.COMPLETED) {
					const settlementAfter = await this.paymentRepository.aggregateSettlementByOrder(
						input.orderId,
						{ session },
					);

					orderPaymentStatus = this.resolveOrderPaymentStatus(
						settlementAfter,
						Number(order.total_amount ?? 0),
					);

					const updatedOrder = await this.orderRepository.updatePaymentState(
						input.restaurantId,
						input.orderId,
						orderPaymentStatus,
						undefined,
						{ session },
					);

					if (!updatedOrder) {
						throw new ConflictException(
							ERROR_CODE.CONFLICT_ERROR,
							'Failed to update order payment status',
						);
					}
				} else {
					orderPaymentStatus = order.payment_status as OrderPaymentStatus;
				}

				return {
					createdPayment,
					orderPaymentStatus,
				};
			});
		} finally {
			await session.endSession();
		}

		if (!transactionResult?.createdPayment) {
			throw new ConflictException(
				ERROR_CODE.CONFLICT_ERROR,
				'Failed to create payment, it may have been modified by another process',
			);
		}

		const { createdPayment, orderPaymentStatus } = transactionResult;

		await this.invalidatePaymentCaches(
			input.orderId,
			ObjectIdUtil.toObjectId((createdPayment as any)._id, 'payment_id'),
			createdPayment.status === PaymentStatus.PENDING,
			createdPayment,
		);

		await this.cachePaymentDetail(createdPayment);
		if (createdPayment.status === PaymentStatus.PENDING) {
			await this.cachePendingPayment(createdPayment, input.paymentUrl, input.qrCodeUrl);
		}

		return this.toCreatePaymentResponse(createdPayment, orderPaymentStatus, false);
	}

	private assertOrderCanCreatePayment(order: OrderDocument): void {
		if (!PAYMENT_CREATE_ALLOWED_ORDER_STATUSES.has(order.status)) {
			throw new ConflictException(
				ERROR_CODE.CONFLICT_ERROR,
				`Cannot create payment while order is in status ${order.status}`,
			);
		}
	}

	private assertMethodPayload(input: ICreatePaymentInput): void {
		if (input.method === PaymentMethod.CASH) {
			const cashTendered = Number(input.cashTendered ?? 0);
			if (cashTendered <= 0) {
				throw new BadRequestException(
					ERROR_CODE.VALIDATION_ERROR,
					'cashTendered is required for cash payment',
				);
			}

			if (cashTendered < input.amount) {
				throw new BadRequestException(
					ERROR_CODE.VALIDATION_ERROR,
					'cashTendered must be greater than or equal to amount',
				);
			}
			return;
		}

		if (input.cashTendered !== undefined && input.cashTendered !== null) {
			throw new BadRequestException(
				ERROR_CODE.VALIDATION_ERROR,
				`cashTendered must be null for method ${input.method}`,
			);
		}

		if (
			REFERENCE_NUMBER_REQUIRED_METHODS.includes(input.method) &&
			!StringUtil.normalizeNullableString(input.referenceNumber)
		) {
			throw new BadRequestException(
				ERROR_CODE.VALIDATION_ERROR,
				`referenceNumber is required for method ${input.method}`,
			);
		}
	}

	private resolveOrderPaymentStatus(
		settlement: IPaymentSettlementSummary,
		orderTotal: number,
	): OrderPaymentStatus {
		if (settlement.total_refunded > 0 && settlement.net_paid <= 0) {
			return OrderPaymentStatus.REFUNDED;
		}

		if (settlement.total_refunded > 0 && settlement.net_paid > 0) {
			return OrderPaymentStatus.PARTIALLY_REFUNDED;
		}

		if (settlement.net_paid <= 0) {
			return OrderPaymentStatus.UNPAID;
		}

		if (settlement.net_paid < orderTotal) {
			return OrderPaymentStatus.PARTIAL;
		}

		return OrderPaymentStatus.PAID;
	}

	private computeRemainingAmount(
		orderTotal: number,
		netPaid: number,
		pendingHold: number,
	): number {
		const remaining = orderTotal - netPaid - pendingHold;
		return NumberUtil.round2(Math.max(remaining, 0));
	}

	private async resolveIdempotentResult(
		payment: PaymentDocument,
		restaurantId: Types.ObjectId,
		requestedOrderId: Types.ObjectId,
	): Promise<Record<string, unknown>> {
		if (!ObjectIdUtil.isSameObjectId(payment.order_id, requestedOrderId)) {
			throw new ConflictException(
				ERROR_CODE.CONFLICT_ERROR,
				'idempotencyKey is already used for another order',
			);
		}

		if (payment.status === PaymentStatus.FAILED) {
			throw new ConflictException(
				ERROR_CODE.CONFLICT_ERROR,
				'Idempotency key is already bound to a failed payment, please use a new key',
			);
		}

		const order = await this.orderRepository.findByIdInRestaurant(
			restaurantId,
			requestedOrderId,
		);

		return this.toCreatePaymentResponse(
			payment,
			(order?.payment_status ?? OrderPaymentStatus.UNPAID) as OrderPaymentStatus,
			true,
		);
	}

	private toCreatePaymentResponse(
		payment: PaymentDocument,
		orderPaymentStatus?: OrderPaymentStatus | null,
		idempotent = false,
		paymentUrl?: string | null,
		qrCodeUrl?: string | null,
	): Record<string, unknown> {
		return {
			id: this.readEntityId(payment as any),
			payment_number: payment.payment_number,
			order_id: this.readValueAsString((payment as any).order_id),
			amount: payment.amount,
			cash_tendered: (payment as any).cash_tendered ?? null,
			change_amount: payment.change_amount,
			method: payment.method,
			status: payment.status,
			reference_number: payment.reference_number,
			processed_by: this.readValueAsString((payment as any).processed_by),
			processed_at: payment.processed_at,
			expires_at: (payment as any).expires_at ?? null,
			payment_url: paymentUrl ?? null,
			qr_code_url: qrCodeUrl ?? null,
			order_payment_status: orderPaymentStatus ?? null,
			created_at: (payment as any).created_at,
			idempotent,
		};
	}

	private async generatePaymentNumber(restaurantId: Types.ObjectId): Promise<string> {
		const dateKey = TimeUtil.getCurrentHcmDateKey();
		const seqKey = `${PAYMENT_SEQUENCE_PREFIX}${restaurantId.toString()}:${dateKey}`;
		const sequence = await this.redis.incr(seqKey);

		if (sequence === 1) {
			await this.redis.expire(seqKey, PAYMENT_SEQUENCE_TTL_SECONDS);
		}

		const width = sequence > 9999 ? 5 : PAYMENT_NUMBER_SEQ_PADDING;
		return `${PAYMENT_NUMBER_PREFIX}-${dateKey}-${String(sequence).padStart(width, '0')}`;
	}

	private async checkCreateRateLimit(orderId: Types.ObjectId): Promise<void> {
		await this.checkRateLimit(
			`${PAYMENT_CREATE_RATE_LIMIT_PREFIX}${orderId.toString()}`,
			PAYMENT_CREATE_RATE_LIMIT_MAX,
			PAYMENT_CREATE_RATE_LIMIT_TTL_SECONDS,
			'Too many payment create requests',
		);
	}

	private async checkRefundRateLimit(orderId: Types.ObjectId): Promise<void> {
		await this.checkRateLimit(
			`${PAYMENT_REFUND_RATE_LIMIT_PREFIX}${orderId.toString()}`,
			PAYMENT_REFUND_RATE_LIMIT_MAX,
			PAYMENT_REFUND_RATE_LIMIT_TTL_SECONDS,
			'Too many refund requests',
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

	private async invalidatePaymentCaches(
		orderId: Types.ObjectId,
		paymentId: Types.ObjectId,
		setPendingCache: boolean,
		payment?: PaymentDocument,
	): Promise<void> {
		const keys = [
			`${CACHE_PAYMENT_LIST_PREFIX}${orderId.toString()}`,
			`${CACHE_PAYMENT_PREFIX}${paymentId.toString()}`,
			`${CACHE_PENDING_PAYMENT_PREFIX}${paymentId.toString()}`,
		];

		await this.redis.del(...keys);

		if (setPendingCache && payment) {
			await this.cachePendingPayment(payment);
		}
	}

	private async cachePaymentDetail(payment: PaymentDocument): Promise<void> {
		await this.redis.set(
			`${CACHE_PAYMENT_PREFIX}${this.readEntityId(payment as any)}`,
			JSON.stringify(payment),
			'EX',
			300,
		);
	}

	private async cachePendingPayment(
		payment: PaymentDocument,
		paymentUrl: string | null = null,
		qrCodeUrl: string | null = null,
	): Promise<void> {
		await this.redis.set(
			`${CACHE_PENDING_PAYMENT_PREFIX}${this.readEntityId(payment as any)}`,
			JSON.stringify({
				amount: payment.amount,
				payment_number: payment.payment_number,
				expires_at: (payment as any).expires_at ?? null,
				payment_url: paymentUrl,
				qr_code_url: qrCodeUrl,
			}),
			'EX',
			PAYMENT_PENDING_TTL_SECONDS,
		);
	}

	private buildOrderPaymentSummary(
		order: OrderDocument,
		settlement: IPaymentSettlementSummary,
	): Record<string, unknown> {
		return {
			net_paid: settlement.net_paid,
			total_refunded: settlement.total_refunded,
			remaining_amount: this.computeRemainingAmount(
				Number(order.total_amount ?? 0),
				settlement.net_paid,
				settlement.pending_hold,
			),
			order_payment_status: this.resolveOrderPaymentStatus(
				settlement,
				Number(order.total_amount ?? 0),
			),
		};
	}

	private toPaymentListItem(payment: PaymentDocument): Record<string, unknown> {
		return {
			id: this.readEntityId(payment as any),
			payment_number: payment.payment_number,
			amount: payment.amount,
			method: payment.method,
			status: payment.status,
			reference_number: payment.reference_number,
			cash_tendered: (payment as any).cash_tendered ?? null,
			change_amount: payment.change_amount,
			refunded_amount: payment.refunded_amount,
			processed_by: this.readValueAsString((payment as any).processed_by),
			processed_at: payment.processed_at,
			expires_at: (payment as any).expires_at ?? null,
			created_at: (payment as any).created_at,
		};
	}

	private toPaymentDetailItem(
		payment: PaymentDocument,
		includeGatewayResponse = false,
	): Record<string, unknown> {
		return {
			...this.toPaymentListItem(payment),
			refund_reason: payment.refund_reason,
			refunded_at: payment.refunded_at,
			gateway_response: includeGatewayResponse ? payment.gateway_response : null,
		};
	}

	private readEntityId(entity: Record<string, unknown>): string {
		const id = entity.id as string | undefined;
		if (id) {
			return String(id);
		}

		const _id = entity._id as Types.ObjectId | string | undefined;
		if (_id) {
			return String(_id);
		}

		return '';
	}

	private readValueAsString(value: unknown): string | null {
		if (value === null || value === undefined) {
			return null;
		}
		return String(value);
	}
}
