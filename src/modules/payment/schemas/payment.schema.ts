import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PaymentDocument = HydratedDocument<Payment>;

export enum PaymentMethod {
  CASH = 'cash',
  CREDIT_CARD = 'credit_card',
  DEBIT_CARD = 'debit_card',
  MOMO = 'momo',
  ZALOPAY = 'zalopay',
  VNPAY = 'vnpay',
  SHOPEEPAY = 'shopeepay',
  BANKING_TRANSFER = 'banking_transfer',
  QR_CODE = 'qr_code',
}

export enum PaymentStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
  PARTIALLY_REFUNDED = 'partially_refunded',
}

export enum OrderPaymentStatus {
  UNPAID = 'unpaid',
  PARTIAL = 'partial',
  PAID = 'paid',
  PARTIALLY_REFUNDED = 'partially_refunded',
  REFUNDED = 'refunded',
}

export const GATEWAY_METHODS: PaymentMethod[] = [
  PaymentMethod.MOMO,
  PaymentMethod.ZALOPAY,
  PaymentMethod.VNPAY,
  PaymentMethod.SHOPEEPAY,
];

export const INSTANT_COMPLETE_METHODS: PaymentMethod[] = [
  PaymentMethod.CASH,
  PaymentMethod.CREDIT_CARD,
  PaymentMethod.DEBIT_CARD,
  PaymentMethod.BANKING_TRANSFER,
  PaymentMethod.QR_CODE,
];

export const REFERENCE_NUMBER_REQUIRED_METHODS: PaymentMethod[] = [
  PaymentMethod.CREDIT_CARD,
  PaymentMethod.DEBIT_CARD,
  PaymentMethod.BANKING_TRANSFER,
];

export const REFUNDABLE_PAYMENT_STATUSES: PaymentStatus[] = [
  PaymentStatus.COMPLETED,
  PaymentStatus.PARTIALLY_REFUNDED,
];

export const SETTLED_PAYMENT_STATUSES: PaymentStatus[] = [
  PaymentStatus.COMPLETED,
  PaymentStatus.PARTIALLY_REFUNDED,
];

export const BLOCKING_PAYMENT_STATUSES: PaymentStatus[] = [
  PaymentStatus.PENDING,
  PaymentStatus.COMPLETED,
  PaymentStatus.PARTIALLY_REFUNDED,
];

export const PAYMENT_NUMBER_PREFIX = 'PAY';
export const PAYMENT_NUMBER_SEQ_PADDING = 4;

@Schema({
  collection: 'payments',
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  toJSON: {
    virtuals: true,
    transform: (_doc, ret: any) => {
        ret.id = ret._id.toString();
        delete ret.__v;
        return ret;
    }
  }
})
export class Payment {
  @Prop({
    type: Types.ObjectId,
    ref: 'Order',
    required: true,
  })
  order_id: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Restaurant',
    required: true,
  })
  restaurant_id: Types.ObjectId;

  @Prop({
    type: String,
    required: true,
    maxlength: 30,
  })
  payment_number: string;

  @Prop({
    type: Number,
    required: true,
    min: 0.01,
  })
  amount: number;

  @Prop({
    type: Number,
    default: null,
    min: 0,
  })
  cash_tendered: number | null;

  @Prop({
    type: String,
    required: true,
    default: 'VND',
    minlength: 3,
    maxlength: 3,
    uppercase: true,
  })
  currency: string;

  @Prop({
    type: String,
    enum: Object.values(PaymentMethod),
    required: true,
  })
  method: PaymentMethod;

  @Prop({
    type: String,
    enum: Object.values(PaymentStatus),
    required: true,
    default: PaymentStatus.PENDING,
  })
  status: PaymentStatus;

  @Prop({
    type: String,
    default: null,
    maxlength: 100,
  })
  reference_number: string | null;

  @Prop({
    type: String,
    required: true,
    maxlength: 100,
  })
  idempotency_key: string;

  @Prop({
    type: Number,
    required: true,
    default: 0,
    min: 0,
  })
  change_amount: number;

  @Prop({
    type: Types.ObjectId,
    ref: 'Staff',
    default: null,
  })
  processed_by: Types.ObjectId | null;

  @Prop({
    type: Date,
    default: null,
  })
  processed_at: Date | null;

  @Prop({
    type: Date,
    default: null,
  })
  expires_at: Date | null;

  @Prop({
    type: String,
    default: null,
  })
  failed_reason: string | null;

  @Prop({
    type: Object,
    default: null,
  })
  gateway_response: Record<string, unknown> | null;

  @Prop({
    type: Number,
    required: true,
    default: 0,
    min: 0,
  })
  refunded_amount: number;

  @Prop({
    type: Date,
    default: null,
  })
  refunded_at: Date | null;

  @Prop({
    type: String,
    default: null,
  })
  refund_reason: string | null;

  @Prop({
    type: String,
    default: null,
  })
  notes: string | null;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);

PaymentSchema.index(
  { restaurant_id: 1, payment_number: 1 },
  { unique: true, name: 'uq_payment_number' },
);

PaymentSchema.index(
  { restaurant_id: 1, idempotency_key: 1 },
  { unique: true, name: 'uq_idempotency_key' },
);

PaymentSchema.index(
  { status: 1, expires_at: 1 },
  { name: 'idx_payment_expires' },
);

PaymentSchema.index(
  { order_id: 1 },
  { name: 'idx_payment_order' },
);

PaymentSchema.index(
  { restaurant_id: 1, status: 1 },
  { name: 'idx_payment_status' },
);

PaymentSchema.index(
  { restaurant_id: 1, method: 1 },
  { name: 'idx_payment_method' },
);

PaymentSchema.index(
  { restaurant_id: 1, created_at: 1 },
  { name: 'idx_payment_date' },
);