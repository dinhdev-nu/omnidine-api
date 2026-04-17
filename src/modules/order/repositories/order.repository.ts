import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { ClientSession, FilterQuery, Model, Types, UpdateQuery } from "mongoose";
import { BaseRepository, IBaseRepository } from "src/common/repositories/base.repositories";
import { Order, OrderDocument, OrderPaymentStatus, OrderStatus, OrderType, OrderSource } from "../schemas/order.schema.xxx";
import { OrderItem, OrderItemStatus } from "../schemas/order-item.schema.xxx";

const TERMINAL_ORDER_STATUSES = [
    OrderStatus.COMPLETED,
    OrderStatus.CANCELLED,
    OrderStatus.REFUNDED,
];

const ACTIVE_UNPAID_PAYMENT_STATUSES = [
    OrderPaymentStatus.UNPAID,
    OrderPaymentStatus.PARTIAL,
];
const ADDABLE_STATUSES = new Set<OrderStatus>([
  OrderStatus.PENDING,
  OrderStatus.CONFIRMED,
]);

const UPDATEABLE_ITEM_STATUSES = new Set<OrderItemStatus>([
    OrderItemStatus.PENDING,
    OrderItemStatus.PREPARING,
    OrderItemStatus.READY
]);


export interface IOrderListFilters {
    status?: OrderStatus;
    table_id?: Types.ObjectId;
    order_type?: OrderType;
    source?: OrderSource;
    payment_status?: OrderPaymentStatus;
    user_id?: Types.ObjectId;
    start_date?: Date;
    end_date?: Date;
    page: number;
    limit: number;
}

export interface IOrderListResult {
    data: OrderDocument[];
    total: number;
    total_revenue: number;
}

export interface IOrderRepository extends IBaseRepository<OrderDocument> {
    findByIdInRestaurant(
        restaurantId: Types.ObjectId,
        orderId: Types.ObjectId,
    ): Promise<OrderDocument | null>;
    findMutableByIdInRestaurant(
        restaurantId: Types.ObjectId,
        orderId: Types.ObjectId,
        options?: { session?: ClientSession },
    ): Promise<OrderDocument | null>;
    createOne(
        data: Partial<Order>,
        options?: { session?: ClientSession },
    ): Promise<OrderDocument>;
    addItemsToOrder(
        restaurantId: Types.ObjectId,
        orderId: Types.ObjectId,
        newItems: Partial<OrderItem>[],
        options?: { session?: ClientSession },
    ): Promise<OrderDocument>;
    updateOrderTotals(
        restaurantId: Types.ObjectId,
        orderId: Types.ObjectId,
        recomputedOrderTotals: Partial<Order>,
        options?: { session?: ClientSession },
    ): Promise<OrderDocument>;
    saveOrder(
        order: OrderDocument,
        options?: { session?: ClientSession },
    ): Promise<OrderDocument>;
    listByRestaurant(
        restaurantId: Types.ObjectId,
        filters: IOrderListFilters,
    ): Promise<IOrderListResult>;
    findActiveByTable(
        restaurantId: Types.ObjectId,
        tableId: Types.ObjectId): Promise<OrderDocument | null>;
    countActiveByRestaurant(restaurantId: Types.ObjectId): Promise<number>;
    countActiveUnpaidByTable(
        restaurantId: Types.ObjectId,
        tableId: Types.ObjectId,
        session?: ClientSession,
    ): Promise<number>;
    countActiveByStaff(
        restaurantId: Types.ObjectId,
        staffId: Types.ObjectId,
        options?: { session?: ClientSession },
    ): Promise<number>;
    countOtherActiveByTable(
        restaurantId: Types.ObjectId,
        tableId: Types.ObjectId,
        excludeOrderId: Types.ObjectId,
    ): Promise<number>;
    countActiveOrderItems(
        restaurantId: Types.ObjectId,
        itemId: Types.ObjectId,
    ): Promise<number>;
    updateItemQuantityAndNotes(
        restaurantId: Types.ObjectId,
        orderId: Types.ObjectId,
        itemId: Types.ObjectId,
        quantity?: number,
        notes?: string | null,
        options?: { session?: ClientSession },
    ): Promise<OrderDocument>;
    cancelOrderItem(
        restaurantId: Types.ObjectId,
        orderId: Types.ObjectId,
        itemId: Types.ObjectId,
        cancel_reason?: string,
        options?: { session?: ClientSession },
    ): Promise<OrderDocument>;
    cancelMultipleOrderItems(
        restaurantId: Types.ObjectId,
        orderId: Types.ObjectId,
        options?: { session?: ClientSession },
    ): Promise<OrderDocument>;
    updateOrderStatus(
        restaurantId: Types.ObjectId,
        orderId: Types.ObjectId,
        newStatus: OrderStatus,
        newStaffId?: Types.ObjectId,
        options?: { session?: ClientSession },
    ): Promise<OrderDocument>;
    updatePaymentState(
        restaurantId: Types.ObjectId,
        orderId: Types.ObjectId,
        paymentStatus: OrderPaymentStatus,
        status?: OrderStatus,
        options?: { session?: ClientSession },
    ): Promise<OrderDocument | null>;
    cancelOrder(
        restaurantId: Types.ObjectId,
        orderId: Types.ObjectId,
        cancel_reason: string,
        options?: { session?: ClientSession },
    ): Promise<OrderDocument | null>;
    unlinkOrdersFromTable(
        restaurantId: Types.ObjectId,
        tableId: Types.ObjectId,
        options?: { session?: ClientSession },
    ): Promise<number>;
}

@Injectable()
export class OrderRepository
    extends BaseRepository<OrderDocument>
    implements IOrderRepository
{
    constructor(
        @InjectModel(Order.name)
        private readonly orderModel: Model<OrderDocument>,
    ) {
        super(orderModel);
    }

    async countActiveOrderItems(restaurantId: Types.ObjectId, itemId: Types.ObjectId): Promise<number> {
        return this.orderModel.countDocuments({
            restaurant_id: restaurantId,
            "items.menu_item_id": itemId,
            "items.status": { $in: UPDATEABLE_ITEM_STATUSES},
        }).exec();
    }

    async countActiveByStaff(
        restaurantId: Types.ObjectId,
        staffId: Types.ObjectId,
        options?: { session?: ClientSession },
    ): Promise<number> {
        return this.orderModel.countDocuments({
            restaurant_id: restaurantId,
            staff_id: staffId,
            status: { $nin: TERMINAL_ORDER_STATUSES },
            payment_status: { $in: ACTIVE_UNPAID_PAYMENT_STATUSES },
        }).session(options?.session ?? null).exec();
    }

    async unlinkOrdersFromTable(
        restaurantId: Types.ObjectId,
        tableId: Types.ObjectId,
        options?: { session?: ClientSession },
    ): Promise<number> {
        const result = await this.orderModel.updateMany(
            {
                restaurant_id: restaurantId,
                table_id: tableId,
            },
            {
                $set: {
                    table_id: null,
                },
            }
        ).session(options?.session ?? null).exec();
        return result.modifiedCount;
    }

    async cancelMultipleOrderItems(restaurantId: Types.ObjectId, orderId: Types.ObjectId, options?: { session?: ClientSession; }): Promise<OrderDocument> {
        return await this.orderModel.findOneAndUpdate(
            {
                _id: orderId,
                restaurant_id: restaurantId,
                "items.status": OrderItemStatus.PENDING ,
            },
            {
                $set: {
                    "items.$[elem].status": OrderItemStatus.CANCELLED,
                },
            },
            { 
                new: true, session: options?.session ?? null,
                arrayFilters: [{ "elem.status": OrderItemStatus.PENDING }]
            }
        ).lean().exec() as OrderDocument;
    }

    async cancelOrder(restaurantId: Types.ObjectId, orderId: Types.ObjectId, cancel_reason: string, options?: { session?: ClientSession; }): Promise<OrderDocument | null> {
        return await this.orderModel.findOneAndUpdate(
            {
                _id: orderId,
                restaurant_id: restaurantId,
                status: { $nin: TERMINAL_ORDER_STATUSES },
            },
            {
                $set: {
                    status: OrderStatus.CANCELLED,
                    cancel_reason,
                    cancelled_at: new Date(),
                },
            },
            { new: true, session: options?.session ?? null }
        ).lean().exec() as OrderDocument | null;
    }

    async updateOrderStatus(
        restaurantId: Types.ObjectId,
        orderId: Types.ObjectId,
        newStatus: OrderStatus,
        newStaffId?: Types.ObjectId,
        options?: { session?: ClientSession },
    ): Promise<OrderDocument> {
        const filter: FilterQuery<OrderDocument> = {
            _id: orderId,
            restaurant_id: restaurantId,
        };
        const updateFields: UpdateQuery<OrderDocument> = { 
            status: newStatus,
            updated_at: new Date(),
        };
        if (newStatus === OrderStatus.CONFIRMED && newStaffId) {
            updateFields.staff_id = newStaffId;
        }
        if (newStatus === OrderStatus.COMPLETED) {
            updateFields.completed_at = new Date();
        }
        if (newStatus === OrderStatus.CANCELLED) {
            updateFields.cancelled_at = new Date();
        }
        return await this.orderModel.findOneAndUpdate(
            filter,
            { $set: updateFields },
            { new: true, session: options?.session ?? null }
        ).lean().exec() as OrderDocument;
    }

    async updatePaymentState(
        restaurantId: Types.ObjectId,
        orderId: Types.ObjectId,
        paymentStatus: OrderPaymentStatus,
        status?: OrderStatus,
        options?: { session?: ClientSession },
    ): Promise<OrderDocument | null> {
        const updateFields: UpdateQuery<OrderDocument> = {
            payment_status: paymentStatus,
            updated_at: new Date(),
        };

        if (status !== undefined) {
            updateFields.status = status;
        }

        return await this.orderModel.findOneAndUpdate(
            {
                _id: orderId,
                restaurant_id: restaurantId,
            },
            { $set: updateFields },
            { new: true, session: options?.session ?? null }
        ).lean().exec() as OrderDocument | null;
    }

    async findByIdInRestaurant(
        restaurantId: Types.ObjectId,
        orderId: Types.ObjectId,
    ): Promise<OrderDocument | null> {
        return this.orderModel
            .findOne({
                _id: orderId,
                restaurant_id: restaurantId,
            })
            .lean()
            .exec() as Promise<OrderDocument | null>;
    }

    async findMutableByIdInRestaurant(
        restaurantId: Types.ObjectId,
        orderId: Types.ObjectId,
        options?: { session?: ClientSession },
    ): Promise<OrderDocument | null> {
        const query = this.orderModel.findOne({
            _id: orderId,
            restaurant_id: restaurantId,
        });

        if (options?.session) {
            query.session(options.session);
        }

        return query.exec();
    }

    async addItemsToOrder(
        restaurantId: Types.ObjectId,
        orderId: Types.ObjectId,
        newItems: Partial<OrderItem>[],
        options?: { session?: ClientSession },
    ): Promise<OrderDocument> {
        return await this.orderModel.findOneAndUpdate(
            {
                _id: orderId,
                restaurant_id: restaurantId,
                status: { $in: ADDABLE_STATUSES },
            },
            { 
                $push: { items: { $each: newItems } }
            },
            { new: true, session: options?.session ?? null }
        ).lean().exec() as OrderDocument;
    }

    async updateOrderTotals(
        restaurantId: Types.ObjectId,
        orderId: Types.ObjectId,
        recomputedOrderTotals: Partial<Order>,
        options?: { session?: ClientSession },
    ): Promise<OrderDocument> {
        const {
            subtotal,
            discount_amount,
            tax_amount,
            service_charge_amount,
            total_amount,
        } = recomputedOrderTotals;
        return await this.orderModel.findOneAndUpdate(
            {
                _id: orderId,
                restaurant_id: restaurantId,
            },
            {
                $set: {
                    subtotal,
                    discount_amount,
                    tax_amount,
                    service_charge_amount,
                    total_amount,
                },
            },
            { new: true, session: options?.session ?? null }
        ).lean().exec() as OrderDocument;
    }

    async updateItemQuantityAndNotes(
        restaurantId: Types.ObjectId,
        orderId: Types.ObjectId,
        itemId: Types.ObjectId,
        quantity?: number,
        notes?: string | null,
        options?: { session?: ClientSession },
    ): Promise<OrderDocument> {
        const updateFields: UpdateQuery<OrderDocument> = {};
        if (quantity !== undefined) {
            updateFields["items.$.quantity"] = quantity;
        }
        if (notes !== undefined) {
            updateFields["items.$.notes"] = notes;
        }
        return await this.orderModel.findOneAndUpdate(
            {
                _id: orderId,
                restaurant_id: restaurantId,
                "items._id": itemId,
            },
            { $set: updateFields },
            { new: true, session: options?.session ?? null }
        ).lean().exec() as OrderDocument;
    }

    async cancelOrderItem(
        restaurantId: Types.ObjectId,
        orderId: Types.ObjectId,
        itemId: Types.ObjectId,
        cancel_reason?: string,
        options?: { session?: ClientSession },
    ): Promise<OrderDocument> {
        const updateFields: any = {
            "items.$.status": OrderItemStatus.CANCELLED,
        };
        if (cancel_reason !== undefined) {
            updateFields["items.$.notes"] = cancel_reason;
        }

        return await this.orderModel.findOneAndUpdate(
            {
                _id: orderId,
                restaurant_id: restaurantId,
                "items._id": itemId,
            },
            {
                $set: updateFields,
            },
            { new: true, session: options?.session ?? null }
        ).lean().exec() as OrderDocument;
    }

    async createOne(
        data: Partial<Order>,
        options?: { session?: ClientSession },
    ): Promise<OrderDocument> {
        if (!options?.session) {
            return this.orderModel.create(data) as Promise<OrderDocument>;
        }

        const docs = await this.orderModel.create([data], {
            session: options.session,
        });
        return docs[0] as OrderDocument;
    }

    async saveOrder(
        order: OrderDocument,
        options?: { session?: ClientSession },
    ): Promise<OrderDocument> {
        return order.save(options?.session ? { session: options.session } : undefined);
    }

    async listByRestaurant(
        restaurantId: Types.ObjectId,
        filters: IOrderListFilters,
    ): Promise<IOrderListResult> {
        const {
            page,
            limit,
            status,
            table_id,
            order_type,
            source,
            payment_status,
            user_id,
            start_date,
            end_date,
        } = filters;

        const query: FilterQuery<OrderDocument> = {
            restaurant_id: restaurantId,
        };

        if (status) query.status = status;
        if (table_id) query.table_id = table_id;
        if (order_type) query.order_type = order_type;
        if (source) query.source = source;
        if (payment_status) query.payment_status = payment_status;
        if (user_id) query.user_id = user_id;

        if (start_date && end_date) {
            query.created_at = {
                $gte: start_date,
                $lte: end_date,
            } as any;
        }

        const skip = (page - 1) * limit;

        const [data, total, revenueAgg] = await Promise.all([
            this.orderModel
                .find(query)
                .sort({ created_at: -1 })
                .skip(skip)
                .limit(limit)
                .lean()
                .exec(),
            this.orderModel.countDocuments(query).exec(),
            this.orderModel.aggregate([
                {
                    $match: {
                        ...query,
                        payment_status: {
                            $in: [OrderPaymentStatus.PAID, OrderPaymentStatus.PARTIAL],
                        },
                    },
                },
                {
                    $group: {
                        _id: null,
                        total_revenue: { $sum: "$total_amount" },
                    },
                },
            ]).exec(),
        ]);

        return {
            data: data as OrderDocument[],
            total,
            total_revenue: Number(revenueAgg?.[0]?.total_revenue ?? 0),
        };
    }

    async findActiveByTable(
        restaurantId: Types.ObjectId,
        tableId: Types.ObjectId
    ): Promise<OrderDocument | null> {
        return this.orderModel
            .findOne({
                restaurant_id: restaurantId,
                table_id: tableId,
                status: { $nin: TERMINAL_ORDER_STATUSES },
                payment_status: { $in: ACTIVE_UNPAID_PAYMENT_STATUSES },
            })
            .sort({ created_at: -1 })
            .lean()
            .exec() as Promise<OrderDocument | null>;
    }

    async countActiveByRestaurant(restaurantId: Types.ObjectId): Promise<number> {
        return this.orderModel.countDocuments({
            restaurant_id: restaurantId,
            status: { $nin: TERMINAL_ORDER_STATUSES },
            payment_status: { $in: ACTIVE_UNPAID_PAYMENT_STATUSES },
            }).exec();
    }


    async countActiveUnpaidByTable(
        restaurantId: Types.ObjectId,
        tableId: Types.ObjectId,
        session?: ClientSession,
    ): Promise<number> {
        return this.orderModel.countDocuments({
            restaurant_id: restaurantId,
            table_id: tableId,
            status: { $nin: TERMINAL_ORDER_STATUSES },
            payment_status: { $in: ACTIVE_UNPAID_PAYMENT_STATUSES },
        }).session(session ?? null).exec();
    }

    async countOtherActiveByTable(
        restaurantId: Types.ObjectId,
        tableId: Types.ObjectId,
        excludeOrderId: Types.ObjectId,
    ): Promise<number> {
        return this.orderModel.countDocuments({
            restaurant_id: restaurantId,
            table_id: tableId,
            _id: { $ne: excludeOrderId },
            status: { $nin: TERMINAL_ORDER_STATUSES },
        }).exec();
    }
}
