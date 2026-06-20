import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, FilterQuery, Model, Types } from 'mongoose';
import { BaseRepository, IBaseRepository } from 'src/common/repositories/base.repository';
import {
  Payment,
  PaymentDocument,
  PaymentStatus,
  SETTLED_PAYMENT_STATUSES,
} from '../schemas/payment.schema';

export interface IPaymentSettlementSummary {
  total_settled: number;
  total_refunded: number;
  pending_hold: number;
  net_paid: number;
}

export interface IPaymentRepository extends IBaseRepository<PaymentDocument> {
  findByRestaurantAndIdempotencyKey(
    restaurantId: Types.ObjectId,
    idempotencyKey: string,
    options?: { session?: ClientSession },
  ): Promise<PaymentDocument | null>;
  findByIdInOrder(
    restaurantId: Types.ObjectId,
    orderId: Types.ObjectId,
    paymentId: Types.ObjectId,
    options?: { session?: ClientSession },
  ): Promise<PaymentDocument | null>;
  listByOrder(
    restaurantId: Types.ObjectId,
    orderId: Types.ObjectId,
  ): Promise<PaymentDocument[]>;
  createOne(
    data: Partial<Payment>,
    options?: { session?: ClientSession },
  ): Promise<PaymentDocument>;
  aggregateSettlementByOrder(
    orderId: Types.ObjectId,
    options?: { session?: ClientSession },
  ): Promise<IPaymentSettlementSummary>;
  updateByIdInOrder(
    restaurantId: Types.ObjectId,
    orderId: Types.ObjectId,
    paymentId: Types.ObjectId,
    data: Partial<Payment>,
    options?: { session?: ClientSession },
  ): Promise<PaymentDocument | null>;
  updateManyByIds(
    ids: Types.ObjectId[],
    data: Partial<Payment>,
    options?: { session?: ClientSession },
  ): Promise<number>;
}

@Injectable()
export class PaymentRepository
  extends BaseRepository<PaymentDocument>
  implements IPaymentRepository
{
  constructor(
    @InjectModel(Payment.name)
    private readonly paymentModel: Model<PaymentDocument>,
  ) {
    super(paymentModel);
  }

  async updateManyByIds(
    ids: Types.ObjectId[],
    data: Partial<Payment>,
    options?: { session?: ClientSession },
  ): Promise<number> {
    const query = this.paymentModel.updateMany(
      { _id: { $in: ids } },
      { $set: data }
    ).session(options?.session ?? null);

    const result = await query.exec();
    return result.modifiedCount;
  }

  async findByRestaurantAndIdempotencyKey(
    restaurantId: Types.ObjectId,
    idempotencyKey: string,
    options?: { session?: ClientSession },
  ): Promise<PaymentDocument | null> {
    const query = this.paymentModel.findOne({
      restaurant_id: restaurantId,
      idempotency_key: idempotencyKey,
    });

    if (options?.session) {
      query.session(options.session);
    }

    return query.lean().exec() as Promise<PaymentDocument | null>;
  }

  async findByIdInOrder(
    restaurantId: Types.ObjectId,
    orderId: Types.ObjectId,
    paymentId: Types.ObjectId,
    options?: { session?: ClientSession },
  ): Promise<PaymentDocument | null> {
    const query = this.paymentModel.findOne({
      _id: paymentId,
      order_id: orderId,
      restaurant_id: restaurantId,
    });

    if (options?.session) {
      query.session(options.session);
    }

    return query.lean().exec() as Promise<PaymentDocument | null>;
  }

  async listByOrder(
    restaurantId: Types.ObjectId,
    orderId: Types.ObjectId,
  ): Promise<PaymentDocument[]> {
    return this.paymentModel
      .find({
        restaurant_id: restaurantId,
        order_id: orderId,
      })
      .sort({ created_at: 1 })
      .lean()
      .exec() as Promise<PaymentDocument[]>;
  }

  async createOne(
    data: Partial<Payment>,
    options?: { session?: ClientSession },
  ): Promise<PaymentDocument> {
    if (!options?.session) {
      return this.paymentModel.create(data) as Promise<PaymentDocument>;
    }

    const docs = await this.paymentModel.create([data], {
      session: options.session,
    });

    return docs[0] as PaymentDocument;
  }

  async aggregateSettlementByOrder(
    orderId: Types.ObjectId,
    options?: { session?: ClientSession },
  ): Promise<IPaymentSettlementSummary> {
    const match: FilterQuery<PaymentDocument> = {
      order_id: orderId,
    };

    const settledStatuses = SETTLED_PAYMENT_STATUSES;
    const refundedStatuses = [PaymentStatus.REFUNDED, PaymentStatus.PARTIALLY_REFUNDED];

    const query = this.paymentModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          total_settled: {
            $sum: {
              $cond: [{ $in: ['$status', settledStatuses] }, '$amount', 0],
            },
          },
          total_refunded: {
            $sum: {
              $cond: [{ $in: ['$status', refundedStatuses] }, '$refunded_amount', 0],
            },
          },
          pending_hold: {
            $sum: {
              $cond: [{ $eq: ['$status', PaymentStatus.PENDING] }, '$amount', 0],
            },
          },
        },
      },
    ]);

    if (options?.session) {
      query.session(options.session);
    }

    const rows = await query.exec();
    const first = rows?.[0];

    const totalSettled = Number(first?.total_settled ?? 0);
    const totalRefunded = Number(first?.total_refunded ?? 0);
    const pendingHold = Number(first?.pending_hold ?? 0);

    return {
      total_settled: this.round2(totalSettled),
      total_refunded: this.round2(totalRefunded),
      pending_hold: this.round2(pendingHold),
      net_paid: this.round2(totalSettled - totalRefunded),
    };
  }

  async updateByIdInOrder(
    restaurantId: Types.ObjectId,
    orderId: Types.ObjectId,
    paymentId: Types.ObjectId,
    data: Partial<Payment>,
    options?: { session?: ClientSession },
  ): Promise<PaymentDocument | null> {
    return this.paymentModel
      .findOneAndUpdate(
        {
          _id: paymentId,
          order_id: orderId,
          restaurant_id: restaurantId,
        },
        { $set: data },
        { new: true, session: options?.session ?? null },
      )
      .lean()
      .exec() as Promise<PaymentDocument | null>;
  }

  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
