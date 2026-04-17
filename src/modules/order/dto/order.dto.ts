import { PartialType } from "@nestjs/mapped-types";
import { Transform, Type } from "class-transformer";
import {
    ArrayMinSize,
    IsArray,
    IsDateString,
    IsEnum,
    IsIn,
    IsInt,
    IsMongoId,
    IsNumber,
    IsOptional,
    IsString,
    Max,
    MaxLength,
    Min,
    MinLength,
    ValidateNested,
} from "class-validator";
import { Types } from "mongoose";
import {
    OrderDiscountType,
    OrderPaymentStatus,
    OrderSource,
    OrderStatus,
    OrderType,
} from "../schemas/order.schema.xxx";
import { OrderItemStatus } from "../schemas/order-item.schema.xxx";

const PUBLIC_ORDER_TYPES = [
    OrderType.DINE_IN,
    OrderType.TAKEAWAY,
    OrderType.DELIVERY,
] as const;

const ORDER_STATUS_UPDATE_ALLOWED = [
    OrderStatus.CONFIRMED,
    OrderStatus.PREPARING,
    OrderStatus.READY,
    OrderStatus.DELIVERING,
    OrderStatus.COMPLETED,
] as const;

const ORDER_ITEM_STATUS_UPDATE_ALLOWED = [
    OrderItemStatus.PREPARING,
    OrderItemStatus.READY,
    OrderItemStatus.SERVED,
    OrderItemStatus.CANCELLED,
] as const;

export class OrderItemInputDto {
    @Transform(({ value }) => (value instanceof Types.ObjectId ? value.toString() : value))
    @IsMongoId({ message: "menu_item_id must be a valid ObjectId" })
    menu_item_id: string;

    @Type(() => Number)
    @IsInt({ message: "quantity must be an integer" })
    @Min(1, { message: "quantity must be at least 1" })
    quantity: number;

    @IsOptional()
    @IsString()
    @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
    @MaxLength(500, { message: "notes must be at most 500 characters" })
    notes?: string | null;
}

export class CreatePosOrderDto {
    @IsEnum(OrderType, { message: "order_type is invalid" })
    order_type: OrderType;

    @IsOptional()
    @IsEnum(OrderSource, { message: "source is invalid" })
    source?: OrderSource;

    @IsOptional()
    @Transform(({ value }) => (value instanceof Types.ObjectId ? value.toString() : value))
    @IsMongoId({ message: "table_id must be a valid ObjectId" })
    table_id?: string | Types.ObjectId;

    @IsOptional()
    @IsString()
    @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
    @MaxLength(150, { message: "customer_name must be at most 150 characters" })
    customer_name?: string | null;

    @IsOptional()
    @IsString()
    @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
    @MaxLength(20, { message: "customer_phone must be at most 20 characters" })
    customer_phone?: string | null;

    @IsOptional()
    @IsString()
    @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
    @MaxLength(1000, { message: "notes must be at most 1000 characters" })
    notes?: string | null;

    @IsOptional()
    @IsArray({ message: "items must be an array" })
    @ValidateNested({ each: true })
    @Type(() => OrderItemInputDto)
    
    items?: OrderItemInputDto[];
}

export class CreatePublicOrderDto {
    @Transform(({ value }) => (value instanceof Types.ObjectId ? value.toString() : value))
    @IsMongoId({ message: "restaurant_id must be a valid ObjectId" })
    restaurant_id: string | Types.ObjectId;

    @IsIn(PUBLIC_ORDER_TYPES, { message: "order_type is invalid for public order" })
    order_type: OrderType;

    @IsOptional()
    @Transform(({ value }) => (value instanceof Types.ObjectId ? value.toString() : value))
    @IsMongoId({ message: "table_id must be a valid ObjectId" })
    table_id?: string | Types.ObjectId;

    @IsOptional()
    @IsEnum(OrderSource, { message: "source is invalid" })
    source?: OrderSource;

    @IsOptional()
    @IsString()
    @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
    @MaxLength(150, { message: "customer_name must be at most 150 characters" })
    customer_name?: string | null;

    @IsOptional()
    @IsString()
    @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
    @MaxLength(20, { message: "customer_phone must be at most 20 characters" })
    customer_phone?: string | null;

    @IsOptional()
    @IsString()
    @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
    @MaxLength(1000, { message: "notes must be at most 1000 characters" })
    notes?: string | null;

    @IsArray({ message: "items must be an array" })
    @ArrayMinSize(1, { message: "items must contain at least 1 item" })
    @ValidateNested({ each: true })
    @Type(() => OrderItemInputDto)
    items: OrderItemInputDto[];
}

export class ListOrdersQueryDto {
    @IsOptional()
    @IsEnum(OrderStatus, { message: "status is invalid" })
    status?: OrderStatus;

    @IsOptional()
    @IsDateString({}, { message: "date must be ISO date string" })
    date?: string;

    @IsOptional()
    @Transform(({ value }) => (value instanceof Types.ObjectId ? value.toString() : value))
    @IsMongoId({ message: "table_id must be a valid ObjectId" })
    table_id?: string | Types.ObjectId;

    @IsOptional()
    @IsEnum(OrderType, { message: "order_type is invalid" })
    order_type?: OrderType;

    @IsOptional()
    @IsEnum(OrderSource, { message: "source is invalid" })
    source?: OrderSource;

    @IsOptional()
    @IsEnum(OrderPaymentStatus, { message: "payment_status is invalid" })
    payment_status?: OrderPaymentStatus;

    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: "page must be an integer" })
    @Min(1, { message: "page must be at least 1" })
    page?: number = 1;

    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: "limit must be an integer" })
    @Min(1, { message: "limit must be at least 1" })
    @Max(100, { message: "limit must be at most 100" })
    limit?: number = 50;
}

export class AddOrderItemsDto {
    @IsArray({ message: "items must be an array" })
    @ArrayMinSize(1, { message: "items must contain at least 1 item" })
    @ValidateNested({ each: true })
    @Type(() => OrderItemInputDto)
    items: OrderItemInputDto[];
}

export class CancelOrderItemDto {
    @IsOptional()
    @IsString()
    @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
    @MinLength(1, { message: "cancel_reason must not be empty" })
    @MaxLength(500, { message: "cancel_reason must be at most 500 characters" })
    cancel_reason?: string;
}

export class UpdateOrderItemDto {
    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: "quantity must be an integer" })
    @Min(1, { message: "quantity must be at least 1" })
    quantity?: number;

    @IsOptional()
    @IsString()
    @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
    @MaxLength(500, { message: "notes must be at most 500 characters" })
    notes?: string | null;
}

export class UpdateOrderStatusDto {
    @IsIn(ORDER_STATUS_UPDATE_ALLOWED, { message: "status is invalid for update endpoint" })
    status: OrderStatus;

    @IsOptional()
    @Transform(({ value }) => (value instanceof Types.ObjectId ? value.toString() : value))
    @IsMongoId({ message: "staff_id must be a valid ObjectId" })
    staff_id?: string | Types.ObjectId;
}

export class UpdateOrderItemStatusDto {
    @IsIn(ORDER_ITEM_STATUS_UPDATE_ALLOWED, { message: "item status is invalid for update endpoint" })
    status: OrderItemStatus;
}

export class UpdateOrderDiscountDto {
    @IsEnum(OrderDiscountType, { message: "discount_type is invalid" })
    discount_type: OrderDiscountType;

    @IsOptional()
    @Type(() => Number)
    @IsNumber({}, { message: "discount_value must be a number" })
    @Min(0, { message: "discount_value must be >= 0" })
    discount_value?: number;

    @IsOptional()
    @IsString()
    @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
    @MaxLength(50, { message: "discount_ref must be at most 50 characters" })
    discount_ref?: string | null;
}

export class CancelOrderDto {
    @IsString()
    @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
    @MinLength(1, { message: "cancel_reason must not be empty" })
    @MaxLength(500, { message: "cancel_reason must be at most 500 characters" })
    cancel_reason: string;
}

export class CreateOrderDto extends CreatePosOrderDto {
    @Transform(({ value }) => (value instanceof Types.ObjectId ? value.toString() : value))
    @IsMongoId({ message: "restaurant_id must be a valid ObjectId" })
    restaurant_id: string | Types.ObjectId;
}

export class ChangeOrderStatusDto {
    @Transform(({ value }) => (value instanceof Types.ObjectId ? value.toString() : value))
    @IsMongoId({ message: "order_id must be a valid ObjectId" })
    order_id: string | Types.ObjectId;

    @IsOptional()
    @Transform(({ value }) => (value instanceof Types.ObjectId ? value.toString() : value))
    @IsMongoId({ message: "orderId must be a valid ObjectId" })
    orderId?: string | Types.ObjectId;

    @IsIn(ORDER_STATUS_UPDATE_ALLOWED, { message: "status is invalid for update endpoint" })
    status: OrderStatus;

    @IsOptional()
    @Transform(({ value }) => (value instanceof Types.ObjectId ? value.toString() : value))
    @IsMongoId({ message: "restaurant_id must be a valid ObjectId" })
    restaurant_id?: string | Types.ObjectId;
}

export class UpdateOrderDto extends PartialType(CreateOrderDto) {}
