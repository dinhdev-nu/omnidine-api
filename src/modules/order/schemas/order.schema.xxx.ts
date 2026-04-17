import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { OrderItem, OrderItemSchema } from './order-item.schema.xxx';

export type OrderDocument = HydratedDocument<Order>;

export enum OrderType {
  DINE_IN  = 'dine_in',
  TAKEAWAY = 'takeaway',
  DELIVERY = 'delivery',
  ONLINE   = 'online', // Có thể bỏ qua
}

export enum OrderStatus {
  PENDING    = 'pending',
  CONFIRMED  = 'confirmed',
  PREPARING  = 'preparing',
  READY      = 'ready',
  DELIVERING = 'delivering',
  COMPLETED  = 'completed',
  CANCELLED  = 'cancelled',
  REFUNDED   = 'refunded',
}

export enum OrderPaymentStatus {
  UNPAID   = 'unpaid',
  PARTIAL  = 'partial',
  PAID     = 'paid',
  PARTIALLY_REFUNDED = 'partially_refunded',
  REFUNDED = 'refunded',
}

export enum OrderDiscountType {
  NONE    = 'none',
  PERCENT = 'percent',
  FIXED   = 'fixed',
  COUPON  = 'coupon',
}

export enum OrderSource {
  POS    = 'pos', // Point of Sale
  ONLINE = 'online', // Find, link, search
  QR     = 'qr', // QR code 
  APP    = 'app',
  PHONE  = 'phone', // Customers call restaurant to order by pos
}

@Schema({
  collection: 'orders',
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  toJSON: {
    virtuals: true,
    transform: (_doc, ret: any) => {
      ret.id = ret._id.toString();
      delete ret.__v;
      return ret;
    },
  },
})
export class Order {
  @Prop({ type: String, required: true, maxlength: 30 })
  order_number: string;

  @Prop({ type: Types.ObjectId, ref: 'Restaurant', required: true })
  restaurant_id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Table', default: null })
  table_id: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  user_id: Types.ObjectId | null;

  @Prop({ type: String, maxlength: 150, default: null })
  customer_name: string | null;

  @Prop({ type: String, maxlength: 20, default: null })
  customer_phone: string | null;

  @Prop({ type: Types.ObjectId, ref: 'Staff', default: null })
  staff_id: Types.ObjectId | null;

  @Prop({ type: String, enum: OrderType, required: true })
  order_type: OrderType;

  @Prop({ type: String, enum: OrderStatus, default: OrderStatus.PENDING })
  status: OrderStatus;

  @Prop({ type: String, enum: OrderPaymentStatus, default: OrderPaymentStatus.UNPAID })
  payment_status: OrderPaymentStatus;

  @Prop({ type: [OrderItemSchema], default: [] })
  items: OrderItem[];

  @Prop({ type: Number, default: 0, min: 0 })
  subtotal: number;

  @Prop({ type: String, enum: OrderDiscountType, default: OrderDiscountType.NONE })
  discount_type: OrderDiscountType;

  @Prop({ type: String, maxlength: 50, default: null })
  discount_ref: string | null;

  @Prop({ type: Number, default: 0, min: 0 })
  discount_value: number;

  @Prop({ type: Number, default: 0, min: 0 })
  discount_amount: number;

  @Prop({ type: Number, default: 0, min: 0 })
  tax_rate: number;

  @Prop({ type: Number, default: 0, min: 0 })
  tax_amount: number;

  @Prop({ type: Number, default: 0.01, min: 0 })
  service_charge_rate: number;

  @Prop({ type: Number, default: 0, min: 0 })
  service_charge_amount: number;

  @Prop({ type: Number, default: 0, min: 0 })
  total_amount: number;

  @Prop({ type: String, maxlength: 3, default: 'VND' })
  currency: string;

  @Prop({ type: String, enum: OrderSource, default: OrderSource.POS })
  source: OrderSource;

  @Prop({ type: String, default: null })
  notes: string | null;

  @Prop({ type: Date, default: null })
  completed_at: Date | null;

  @Prop({ type: Date, default: null })
  cancelled_at: Date | null;

  @Prop({ type: String, default: null })
  cancel_reason: string | null;
}

export const OrderSchema = SchemaFactory.createForClass(Order);

OrderSchema.index({ restaurant_id: 1, order_number: 1 }, { unique: true });
OrderSchema.index({ restaurant_id: 1, created_at: -1 });
OrderSchema.index({ restaurant_id: 1, status: 1 });
OrderSchema.index({ restaurant_id: 1, payment_status: 1 });

OrderSchema.index({ restaurant_id: 1, table_id: 1 });
OrderSchema.index({ restaurant_id: 1, staff_id: 1 });
OrderSchema.index({ restaurant_id: 1, user_id: 1 });