import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type MenuCategoryDocument = HydratedDocument<MenuCategory>;

@Schema({
  collection: 'menu_categories',
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  toJSON: {
    virtuals: true,
    transform: (_doc, ret: any) => {
      delete ret.__v;
      return ret;
    },
  },
})
export class MenuCategory {
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
    maxlength: 150,
  })
  name: string;

  @Prop({
    type: String,
    default: null,
    trim: true,
  })
  description: string | null;

  @Prop({
    type: String,
    default: null,
    validate: {
      validator: (v: string | null) =>
        v == null || /^https:\/\/.+\.(jpg|jpeg|png|webp)(\?.*)?$/i.test(v),
      message: 'imageUrl phải là HTTPS và có extension jpg/jpeg/png/webp',
    },
  })
  image_url: string | null;

  @Prop({
    type: Number,
    default: 0,
    min: 0,
  })
  sort_order: number;

  @Prop({
    type: Boolean,
    default: true,
  })
  is_active: boolean;

}

export const MenuCategorySchema = SchemaFactory.createForClass(MenuCategory);

MenuCategorySchema.index({ restaurant_id: 1, is_active: 1, sort_order: 1 });