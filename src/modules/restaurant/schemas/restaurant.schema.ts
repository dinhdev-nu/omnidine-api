// restaurant.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, HydratedDocument, Query, Types } from 'mongoose';

export class DayHours {
  open: string;
  close: string;
  closed: boolean;
}

export class OperatingHours {
  mon?: DayHours;
  tue?: DayHours;
  wed?: DayHours;
  thu?: DayHours;
  fri?: DayHours;
  sat?: DayHours;
  sun?: DayHours;
}

export type RestaurantDocument = HydratedDocument<Restaurant>;

@Schema({
  collection: 'restaurants',
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  versionKey: false,
})
export class Restaurant {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  owner_id: Types.ObjectId;

  @Prop({ type: String, required: true, maxlength: 200 })
  name: string;

  @Prop({ type: String, required: true, maxlength: 100, unique: true })
  slug: string;

  @Prop({ type: String, default: null })
  description: string | null;

  @Prop({ type: String, maxlength: 100, default: null })
  cuisine_type: string | null;

  @Prop({ type: Number, min: 1, max: 4, default: null })
  price_range: number | null;

  @Prop({ type: String, default: null }) 
  logo_url: string | null;

  @Prop({ type: String, default: null })
  cover_image_url: string | null;

  @Prop({ type: [String], default: [] })
  gallery_urls: string[];

  @Prop({ type: String, required: true })
  address: string;

  @Prop({ type: String, required: true, maxlength: 100, index: true })
  city: string;

  @Prop({ type: String, maxlength: 100, default: null })
  district: string | null;

  @Prop({ type: String, maxlength: 100, default: null })
  ward: string | null;

  @Prop({ type: Number, default: null })
  latitude: number | null;

  @Prop({ type: Number, default: null })
  longitude: number | null;

  @Prop({ 
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      default: [0, 0],
    }
   })
  location: {
    type: string;
    coordinates: [number, number];
  };

  @Prop({ type: String, maxlength: 20, default: null })
  phone: string | null;

  @Prop({ type: String, maxlength: 255, default: null })
  email: string | null;

  @Prop({ type: String, maxlength: 255, default: null })
  website: string | null;

  @Prop({
    type: {
      mon: { open: String, close: String, closed: Boolean },
      tue: { open: String, close: String, closed: Boolean },
      wed: { open: String, close: String, closed: Boolean },
      thu: { open: String, close: String, closed: Boolean },
      fri: { open: String, close: String, closed: Boolean },
      sat: { open: String, close: String, closed: Boolean },
      sun: { open: String, close: String, closed: Boolean },
    },
    default: {},
    _id: false,
  })
  operating_hours: OperatingHours;

  @Prop({ type: String, maxlength: 50, default: 'Asia/Ho_Chi_Minh' })
  timezone: string;

  @Prop({ type: String, length: 3, default: 'VND' })
  currency: string;

  @Prop({ type: Number, min: 0, max: 1, default: 0.1 })
  tax_rate: number;

  @Prop({ type: Number, min: 0, max: 0.01, default: 0.01 })
  service_charge_rate: number;

  @Prop({ type: Boolean, default: false, index: true })
  is_published: boolean;

  @Prop({ type: Boolean, default: true })
  accepts_online_orders: boolean;

  @Prop({ type: Object, default: {} })
  settings: Record<string, unknown>;

  @Prop({ type: Date, default: null })
  deleted_at: Date | null;
}

export const RestaurantSchema = SchemaFactory.createForClass(Restaurant);

RestaurantSchema.index({ is_published: 1, deleted_at: 1 });
RestaurantSchema.index({ latitude: 1, longitude: 1 });

RestaurantSchema.index({ location: '2dsphere' });

RestaurantSchema.pre(
  /^find/,
  { document: false, query: true },
  function (this: Query<unknown, RestaurantDocument>, next) {
    this.where({ deleted_at: null });
    next();
  },
);

RestaurantSchema.pre('save', function (next) {
  if (this.latitude !== null && this.longitude !== undefined) {
    this.location = {
      type: 'Point',
      coordinates: [this.longitude || 0, this.latitude || 0], // Lưu ý: [Kinh độ, Vĩ độ]
    };
  }
  next();
});

RestaurantSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate() as any;

  if (update.latitude !== undefined || update.longitude !== undefined) {
    const lat = update.latitude;
    const lon = update.longitude;

    if (lat !== null && lon !== null) {
      update.location = {
        type: 'Point',
        coordinates: [lon, lat],
      };
    }
  }
  next();
});