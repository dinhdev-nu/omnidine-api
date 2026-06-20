import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export enum TableStatus {
  AVAILABLE = 'available',
  OCCUPIED  = 'occupied',
  RESERVED  = 'reserved',
  CLEANING  = 'cleaning',
  INACTIVE  = 'inactive',
}

export type TableDocument = HydratedDocument<Table>;

@Schema({
  collection: 'tables',
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  toJSON: {
    virtuals: true,
    transform: (_doc, ret: any) => {
        delete ret.__v;
        return ret;
    }
  }
})
export class Table {
  @Prop({
    type: Types.ObjectId,
    ref: 'Restaurant',
    required: true,
    index: true,
  })
  restaurant_id: Types.ObjectId;

  @Prop({
    type: String,
    required: true,
    trim: true,
    maxlength: 20,
  })
  table_number: string;

  @Prop({
    type: String,
    default: null,
    trim: true,
    maxlength: 50,
  })
  name: string | null;

  @Prop({
    type: Number,
    required: true,
    min: 1,
    max: 99,
  })
  capacity: number;

  @Prop({
    type: String,
    enum: Object.values(TableStatus),
    default: TableStatus.AVAILABLE,
  })
  status: TableStatus;

  @Prop({
    type: String,
    default: null,
    maxlength: 255,
    sparse: true,   // cho phép nhiều document có null nhưng unique với giá trị thực
    unique: true,
  })
  qr_code: string | null;

  @Prop({
    type: String,
    default: null,
    maxlength: 500,
  })
  notes: string | null;

  @Prop({
    type: Boolean,
    default: true,
  })
  is_active: boolean;

  created_at: Date;
  updated_at: Date;
}

export const TableSchema = SchemaFactory.createForClass(Table);

TableSchema.index(
  { restaurant_id: 1, table_number: 1 },{ unique: true, partialFilterExpression: { table_number: { $type: 'string' } } }, 
);

TableSchema.index({ restaurant_id: 1, status: 1 });

TableSchema.virtual('id').get(function () {
  return (this._id as Types.ObjectId).toHexString();
});