import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types }     from 'mongoose';

export type StaffDocument = HydratedDocument<Staff>;


export enum StaffPosition {
  MANAGER  = 'manager',
  CASHIER  = 'cashier',
  WAITER   = 'waiter',
  KITCHEN  = 'kitchen',
  DELIVERY = 'delivery',
}

export enum StaffStatus {
  ACTIVE     = 'active',
  INACTIVE   = 'inactive',
  ON_LEAVE   = 'on_leave',
  TERMINATED = 'terminated',
}

export enum StaffPermissionKey {
  CAN_DISCOUNT        = 'can_discount',
  CAN_CANCEL_ORDER    = 'can_cancel_order',
  CAN_PROCESS_PAYMENT = 'can_process_payment',
  CAN_REFUND          = 'can_refund',
  CAN_VIEW_REPORTS    = 'can_view_reports',
  CAN_MANAGE_TABLES   = 'can_manage_tables',
  CAN_MANAGE_MENU     = 'can_manage_menu',
}

@Schema({ _id: false, versionKey: false })
export class StaffPermissions {
  @Prop({ type: Boolean, default: false })
  can_discount: boolean;

  @Prop({ type: Boolean, default: false })
  can_cancel_order: boolean;

  @Prop({ type: Boolean, default: false })
  can_process_payment: boolean;

  @Prop({ type: Boolean, default: false })
  can_refund: boolean;

  @Prop({ type: Boolean, default: false })
  can_view_reports: boolean;

  @Prop({ type: Boolean, default: false })
  can_manage_tables: boolean;

  @Prop({ type: Boolean, default: false })
  can_manage_menu: boolean;
}

export const StaffPermissionsSchema = SchemaFactory.createForClass(StaffPermissions);


@Schema({
  collection: 'staff',
  timestamps : { createdAt: 'created_at', updatedAt: 'updated_at' },
  toJSON: {
    virtuals : true,
    transform : (_doc, ret: any) => {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  },
  toObject: { virtuals: true },
})
export class Staff {
  @Prop({
    type    : Types.ObjectId,
    ref     : 'Restaurant',
    required: true,
    index   : true,
  })
  restaurant_id: Types.ObjectId;

  @Prop({
    type    : Types.ObjectId,
    ref     : 'User',
    required: true,
    index   : true,
  })
  user_id: Types.ObjectId;

  @Prop({
    type     : String,
    required : true,
    trim     : true,
    maxlength: 30,
  })
  employee_code: string;

  @Prop({
    type     : String,
    required : true,
    trim     : true,
    maxlength: 150,
  })
  full_name: string;

  @Prop({ type: String, trim: true, maxlength: 20, default: null })
  phone: string | null;

  @Prop({
    type     : String,
    trim     : true,
    maxlength: 255,
    lowercase: true,
    default  : null,
  })
  email: string | null;

  @Prop({
    type    : String,
    enum    : Object.values(StaffPosition),
    required: true,
  })
  position: StaffPosition;

  @Prop({ type: Date, required: true })
  hire_date: Date;

  @Prop({ type: String, default: null })
  avatar_url: string | null;

  @Prop({
    type   : String,
    enum   : Object.values(StaffStatus),
    default: StaffStatus.ACTIVE,
    index  : true,
  })
  status: StaffStatus;

  @Prop({
    type   : StaffPermissionsSchema,
    default: () => ({}),
  })
  permissions: StaffPermissions;

  @Prop({ type: Date, default: null, index: true })
  deleted_at: Date | null;

  created_at: Date;
  updated_at: Date;
}

export const StaffSchema = SchemaFactory.createForClass(Staff);


StaffSchema.index(
  { restaurant_id: 1, employee_code: 1 },
  { unique: true, partialFilterExpression: { deleted_at: null } },
);

StaffSchema.index(
  { restaurant_id: 1, user_id: 1 }, 
  { unique: true },
);
 
StaffSchema.index({ restaurant_id: 1, status: 1 });