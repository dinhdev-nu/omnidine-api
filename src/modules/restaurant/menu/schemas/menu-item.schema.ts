import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ _id: false })
export class MenuItemImage {
  @Prop({
    type: String,
    required: true,
    validate: {
      validator: (v: string) =>
        /^https:\/\/.+\.(jpg|jpeg|png|webp)(\?.*)?$/i.test(v),
      message: 'imageUrl phải là HTTPS và có extension jpg/jpeg/png/webp',
    },
  })
  url: string;

  @Prop({ type: String, default: '' })
  alt: string;
}

export const MenuItemImageSchema = SchemaFactory.createForClass(MenuItemImage);

export type MenuItemDocument = MenuItem & Document;

@Schema({
  collection: 'menu_items',
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  toJSON: {
    virtuals: true,
    transform: (_doc, ret: any) => {
      delete ret.__v;
      return ret;
    },
  },
})
export class MenuItem {
  @Prop({
    type: Types.ObjectId,
    ref: 'Restaurant',
    required: true,
    index: true,
  })
  restaurant_id: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'MenuCategory',
    default: null,
  })
  category_id: Types.ObjectId | null;

  @Prop({
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
  })
  name: string;

  @Prop({
    type: String,
    default: null,
    trim: true,
  })
  description: string | null;

  @Prop({
    type: Number,
    required: true,
    min: [0, 'base_price không được âm'],
  })
  base_price: number;

  @Prop({
    type: [MenuItemImageSchema],
    default: [],
    validate: {
      validator: (arr: MenuItemImage[]) => arr.length <= 10,
      message: 'Mỗi món tối đa 10 ảnh',
    },
  })
  images: MenuItemImage[];

  @Prop({
    type: Boolean,
    default: true,
  })
  is_available: boolean;

  @Prop({
    type: Boolean,
    default: false,
  })
  is_featured: boolean;

  @Prop({
    type: Number,
    default: 0,
    min: 0,
  })
  sort_order: number;

  @Prop({
    type: Date,
    default: null,
  })
  deleted_at: Date | null;
}

export const MenuItemSchema = SchemaFactory.createForClass(MenuItem);
MenuItemSchema.index({ restaurant_id: 1, category_id: 1, sort_order: 1 });
MenuItemSchema.index({ restaurant_id: 1, is_available: 1, deleted_at: 1 });
MenuItemSchema.index({ restaurant_id: 1, is_featured: 1, deleted_at: 1 });
MenuItemSchema.index({ name: 'text', description: 'text' });