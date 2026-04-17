import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

export enum OrderItemStatus {
  PENDING   = 'pending',
  PREPARING = 'preparing',
  READY     = 'ready',
  SERVED    = 'served',
  CANCELLED = 'cancelled',
}

@Schema({ 
    _id: true, 
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    versionKey: false
})
export class OrderItem {
  @Prop({ type: Types.ObjectId, ref: 'MenuItem', required: true })
  menu_item_id: Types.ObjectId;

  @Prop({ type: String, required: true, maxlength: 200 })
  item_name: string;

  @Prop({ type: Number, required: true, min: 1 })
  quantity: number;

  @Prop({ type: Number, required: true, min: 0 })
  unit_price: number;

  @Prop({ type: Number, required: true, min: 0 })
  total_price: number;

  @Prop({ type: String, enum: OrderItemStatus, default: OrderItemStatus.PENDING })
  status: OrderItemStatus;

  @Prop({ type: String, default: null })
  notes: string | null;

  @Prop({ type: Date, default: () => new Date() })
  created_at: Date;
}

export const OrderItemSchema = SchemaFactory.createForClass(OrderItem);
