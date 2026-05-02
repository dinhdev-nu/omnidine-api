import {
    ApiProperty,
    ApiPropertyOptional,
    OmitType,
    PartialType,
} from "@nestjs/swagger";
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
    @ApiProperty({
        example: "664f1a2b3c4d5e6f7a8b9201",
        description: "ObjectId mon an trong menu",
        type: String,
    })
    @Transform(({ value }) => (value instanceof Types.ObjectId ? value.toString() : value))
    @IsMongoId({ message: "menu_item_id must be a valid ObjectId" })
    menu_item_id: string;

    @ApiProperty({
        example: 2,
        description: "So luong mon can them vao don",
        type: Number,
        minimum: 1,
    })
    @Type(() => Number)
    @IsInt({ message: "quantity must be an integer" })
    @Min(1, { message: "quantity must be at least 1" })
    quantity: number;

    @ApiPropertyOptional({
        example: "Less sugar",
        description: "Ghi chu cho tung mon, toi da 500 ky tu",
        type: String,
        nullable: true,
        maxLength: 500,
    })
    @IsOptional()
    @IsString()
    @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
    @MaxLength(500, { message: "notes must be at most 500 characters" })
    notes?: string | null;
}

export class CreatePosOrderDto {
    @ApiProperty({
        enum: OrderType,
        example: OrderType.DINE_IN,
        description: "Loai don hang",
    })
    @IsEnum(OrderType, { message: "order_type is invalid" })
    order_type: OrderType;

    @ApiPropertyOptional({
        enum: OrderSource,
        example: OrderSource.POS,
        description: "Nguon tao don hang",
    })
    @IsOptional()
    @IsEnum(OrderSource, { message: "source is invalid" })
    source?: OrderSource;

    @ApiPropertyOptional({
        example: "664f1a2b3c4d5e6f7a8b9401",
        description: "ObjectId ban, bat buoc khi order_type la dine_in",
        type: String,
    })
    @IsOptional()
    @Transform(({ value }) => (value instanceof Types.ObjectId ? value.toString() : value))
    @IsMongoId({ message: "table_id must be a valid ObjectId" })
    table_id?: string | Types.ObjectId;

    @ApiPropertyOptional({
        example: "Nguyen Van A",
        description: "Ten khach hang",
        type: String,
        nullable: true,
        maxLength: 150,
    })
    @IsOptional()
    @IsString()
    @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
    @MaxLength(150, { message: "customer_name must be at most 150 characters" })
    customer_name?: string | null;

    @ApiPropertyOptional({
        example: "0901234567",
        description: "So dien thoai khach hang",
        type: String,
        nullable: true,
        maxLength: 20,
    })
    @IsOptional()
    @IsString()
    @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
    @MaxLength(20, { message: "customer_phone must be at most 20 characters" })
    customer_phone?: string | null;

    @ApiPropertyOptional({
        example: "No onion",
        description: "Ghi chu chung cua don hang",
        type: String,
        nullable: true,
        maxLength: 1000,
    })
    @IsOptional()
    @IsString()
    @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
    @MaxLength(1000, { message: "notes must be at most 1000 characters" })
    notes?: string | null;

    @ApiPropertyOptional({
        type: () => [OrderItemInputDto],
        description: "Danh sach mon trong don. POS co the tao don rong va them mon sau.",
    })
    @IsOptional()
    @IsArray({ message: "items must be an array" })
    @ValidateNested({ each: true })
    @Type(() => OrderItemInputDto)
    
    items?: OrderItemInputDto[];
}

export class CreatePublicOrderDto {
    @ApiProperty({
        example: "664f1a2b3c4d5e6f7a8b9001",
        description: "ObjectId nha hang",
        type: String,
    })
    @Transform(({ value }) => (value instanceof Types.ObjectId ? value.toString() : value))
    @IsMongoId({ message: "restaurant_id must be a valid ObjectId" })
    restaurant_id: string | Types.ObjectId;

    @ApiProperty({
        enum: PUBLIC_ORDER_TYPES,
        example: OrderType.DELIVERY,
        description: "Loai don public cho phep",
    })
    @IsIn(PUBLIC_ORDER_TYPES, { message: "order_type is invalid for public order" })
    order_type: OrderType;

    @ApiPropertyOptional({
        example: "664f1a2b3c4d5e6f7a8b9401",
        description: "ObjectId ban neu dat dine_in qua QR",
        type: String,
    })
    @IsOptional()
    @Transform(({ value }) => (value instanceof Types.ObjectId ? value.toString() : value))
    @IsMongoId({ message: "table_id must be a valid ObjectId" })
    table_id?: string | Types.ObjectId;

    @ApiPropertyOptional({
        enum: OrderSource,
        example: OrderSource.QR,
        description: "Nguon don public. Neu khong gui, service tu suy ra qr hoac online.",
    })
    @IsOptional()
    @IsEnum(OrderSource, { message: "source is invalid" })
    source?: OrderSource;

    @ApiPropertyOptional({
        example: "Tran Thi B",
        description: "Ten khach dat don",
        type: String,
        nullable: true,
        maxLength: 150,
    })
    @IsOptional()
    @IsString()
    @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
    @MaxLength(150, { message: "customer_name must be at most 150 characters" })
    customer_name?: string | null;

    @ApiPropertyOptional({
        example: "0911222333",
        description: "So dien thoai khach dat don",
        type: String,
        nullable: true,
        maxLength: 20,
    })
    @IsOptional()
    @IsString()
    @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
    @MaxLength(20, { message: "customer_phone must be at most 20 characters" })
    customer_phone?: string | null;

    @ApiPropertyOptional({
        example: "Call before delivery",
        description: "Ghi chu giao don",
        type: String,
        nullable: true,
        maxLength: 1000,
    })
    @IsOptional()
    @IsString()
    @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
    @MaxLength(1000, { message: "notes must be at most 1000 characters" })
    notes?: string | null;

    @ApiProperty({
        type: () => [OrderItemInputDto],
        description: "Danh sach mon can dat, bat buoc toi thieu 1 mon",
    })
    @IsArray({ message: "items must be an array" })
    @ArrayMinSize(1, { message: "items must contain at least 1 item" })
    @ValidateNested({ each: true })
    @Type(() => OrderItemInputDto)
    items: OrderItemInputDto[];
}

export class ListOrdersQueryDto {
    @ApiPropertyOptional({
        enum: OrderStatus,
        example: OrderStatus.PENDING,
        description: "Loc theo trang thai don",
    })
    @IsOptional()
    @IsEnum(OrderStatus, { message: "status is invalid" })
    status?: OrderStatus;

    @ApiPropertyOptional({
        example: "2026-04-17",
        description: "Ngay loc du lieu, chap nhan ISO date string",
        type: String,
    })
    @IsOptional()
    @IsDateString({}, { message: "date must be ISO date string" })
    date?: string;

    @ApiPropertyOptional({
        example: "664f1a2b3c4d5e6f7a8b9401",
        description: "Loc theo table id",
        type: String,
    })
    @IsOptional()
    @Transform(({ value }) => (value instanceof Types.ObjectId ? value.toString() : value))
    @IsMongoId({ message: "table_id must be a valid ObjectId" })
    table_id?: string | Types.ObjectId;
 
    @ApiPropertyOptional({
        enum: OrderType,
        example: OrderType.TAKEAWAY,
        description: "Loc theo loai don",
    })
    @IsOptional()
    @IsEnum(OrderType, { message: "order_type is invalid" })
    order_type?: OrderType;

    @ApiPropertyOptional({
        enum: OrderSource,
        example: OrderSource.POS,
        description: "Loc theo nguon tao don",
    })
    @IsOptional()
    @IsEnum(OrderSource, { message: "source is invalid" })
    source?: OrderSource;

    @ApiPropertyOptional({
        enum: OrderPaymentStatus,
        example: OrderPaymentStatus.UNPAID,
        description: "Loc theo trang thai thanh toan",
    })
    @IsOptional()
    @IsEnum(OrderPaymentStatus, { message: "payment_status is invalid" })
    payment_status?: OrderPaymentStatus;

    @ApiPropertyOptional({
        example: 1,
        description: "Trang hien tai",
        type: Number,
        minimum: 1,
        default: 1,
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: "page must be an integer" })
    @Min(1, { message: "page must be at least 1" })
    page?: number = 1;

    @ApiPropertyOptional({
        example: 50,
        description: "So ban ghi moi trang",
        type: Number,
        minimum: 1,
        maximum: 100,
        default: 50,
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: "limit must be an integer" })
    @Min(1, { message: "limit must be at least 1" })
    @Max(100, { message: "limit must be at most 100" })
    limit?: number = 50;
}

export class AddOrderItemsDto {
    @ApiProperty({
        type: () => [OrderItemInputDto],
        description: "Danh sach mon moi can them vao don",
    })
    @IsArray({ message: "items must be an array" })
    @ArrayMinSize(1, { message: "items must contain at least 1 item" })
    @ValidateNested({ each: true })
    @Type(() => OrderItemInputDto)
    items: OrderItemInputDto[];
}

export class CancelOrderItemDto {
    @ApiPropertyOptional({
        example: "Kitchen out of stock",
        description: "Ly do huy mon. Neu bo trong service se gan thong diep mac dinh.",
        type: String,
        minLength: 1,
        maxLength: 500,
    })
    @IsOptional()
    @IsString()
    @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
    @MinLength(1, { message: "cancel_reason must not be empty" })
    @MaxLength(500, { message: "cancel_reason must be at most 500 characters" })
    cancel_reason?: string;
}

export class UpdateOrderItemDto {
    @ApiPropertyOptional({
        example: 3,
        description: "So luong moi cua mon",
        type: Number,
        minimum: 1,
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: "quantity must be an integer" })
    @Min(1, { message: "quantity must be at least 1" })
    quantity?: number;

    @ApiPropertyOptional({
        example: "No spicy",
        description: "Ghi chu moi cua mon",
        type: String,
        nullable: true,
        maxLength: 500,
    })
    @IsOptional()
    @IsString()
    @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
    @MaxLength(500, { message: "notes must be at most 500 characters" })
    notes?: string | null;
}

export class UpdateOrderStatusDto {
    @ApiProperty({
        enum: ORDER_STATUS_UPDATE_ALLOWED,
        example: OrderStatus.CONFIRMED,
        description: "Trang thai don moi cho endpoint update status",
    })
    @IsIn(ORDER_STATUS_UPDATE_ALLOWED, { message: "status is invalid for update endpoint" })
    status: OrderStatus;

    @ApiPropertyOptional({
        example: "664f1a2b3c4d5e6f7a8b9301",
        description: "Staff id duoc gan khi confirm don",
        type: String,
    })
    @IsOptional()
    @Transform(({ value }) => (value instanceof Types.ObjectId ? value.toString() : value))
    @IsMongoId({ message: "staff_id must be a valid ObjectId" })
    staff_id?: string | Types.ObjectId;
}

export class UpdateOrderItemStatusDto {
    @ApiProperty({
        enum: ORDER_ITEM_STATUS_UPDATE_ALLOWED,
        example: OrderItemStatus.PREPARING,
        description: "Trang thai moi cua item",
    })
    @IsIn(ORDER_ITEM_STATUS_UPDATE_ALLOWED, { message: "item status is invalid for update endpoint" })
    status: OrderItemStatus;
}

export class UpdateOrderDiscountDto {
    @ApiProperty({
        enum: OrderDiscountType,
        example: OrderDiscountType.PERCENT,
        description: "Loai giam gia ap dung cho don",
    })
    @IsEnum(OrderDiscountType, { message: "discount_type is invalid" })
    discount_type: OrderDiscountType;

    @ApiPropertyOptional({
        example: 0.1,
        description: "Gia tri giam gia. Percent su dung 0.01..1.00",
        type: Number,
        minimum: 0,
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber({}, { message: "discount_value must be a number" })
    @Min(0, { message: "discount_value must be >= 0" })
    discount_value?: number;

    @ApiPropertyOptional({
        example: "PROMO-APR",
        description: "Ma giam gia hoac tham chieu coupon",
        type: String,
        nullable: true,
        maxLength: 50,
    })
    @IsOptional()
    @IsString()
    @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
    @MaxLength(50, { message: "discount_ref must be at most 50 characters" })
    discount_ref?: string | null;
}

export class CancelOrderDto {
    @ApiProperty({
        example: "Customer requested cancellation",
        description: "Ly do huy don",
        type: String,
        minLength: 1,
        maxLength: 500,
    })
    @IsString()
    @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
    @MinLength(1, { message: "cancel_reason must not be empty" })
    @MaxLength(500, { message: "cancel_reason must be at most 500 characters" })
    cancel_reason: string;
}

export class CreateOrderDto extends CreatePosOrderDto {
    @ApiProperty({
        example: "664f1a2b3c4d5e6f7a8b9001",
        description: "ObjectId nha hang",
        type: String,
    })
    @Transform(({ value }) => (value instanceof Types.ObjectId ? value.toString() : value))
    @IsMongoId({ message: "restaurant_id must be a valid ObjectId" })
    restaurant_id: string | Types.ObjectId;
}

export class ChangeOrderStatusDto {
    @ApiProperty({
        example: "664f1a2b3c4d5e6f7a8b9501",
        description: "ObjectId don hang",
        type: String,
    })
    @Transform(({ value }) => (value instanceof Types.ObjectId ? value.toString() : value))
    @IsMongoId({ message: "order_id must be a valid ObjectId" })
    order_id: string | Types.ObjectId;

    @ApiPropertyOptional({
        example: "664f1a2b3c4d5e6f7a8b9501",
        description: "Alias legacy cua order_id",
        type: String,
    })
    @IsOptional()
    @Transform(({ value }) => (value instanceof Types.ObjectId ? value.toString() : value))
    @IsMongoId({ message: "orderId must be a valid ObjectId" })
    orderId?: string | Types.ObjectId;

    @ApiProperty({
        enum: ORDER_STATUS_UPDATE_ALLOWED,
        example: OrderStatus.READY,
        description: "Trang thai don moi",
    })
    @IsIn(ORDER_STATUS_UPDATE_ALLOWED, { message: "status is invalid for update endpoint" })
    status: OrderStatus;

    @ApiPropertyOptional({
        example: "664f1a2b3c4d5e6f7a8b9001",
        description: "ObjectId nha hang",
        type: String,
    })
    @IsOptional()
    @Transform(({ value }) => (value instanceof Types.ObjectId ? value.toString() : value))
    @IsMongoId({ message: "restaurant_id must be a valid ObjectId" })
    restaurant_id?: string | Types.ObjectId;
}

export class UpdateOrderDto extends PartialType(CreateOrderDto) {}

export class OrderItemSnapshotResponseDto {
    @ApiPropertyOptional({
        example: "664f1a2b3c4d5e6f7a8b9601",
        description: "ObjectId item trong mang items",
        type: String,
    })
    _id?: string;

    @ApiProperty({
        example: "664f1a2b3c4d5e6f7a8b9201",
        description: "ObjectId mon an trong menu",
        type: String,
    })
    menu_item_id: string;

    @ApiProperty({
        example: "Pho Bo Tai",
        description: "Ten mon snapshot tai thoi diem dat",
        type: String,
    })
    item_name: string;

    @ApiProperty({
        example: 2,
        description: "So luong",
        type: Number,
    })
    quantity: number;

    @ApiProperty({
        example: 79000,
        description: "Don gia snapshot",
        type: Number,
    })
    unit_price: number;

    @ApiProperty({
        example: 158000,
        description: "Thanh tien item",
        type: Number,
    })
    total_price: number;

    @ApiProperty({
        enum: OrderItemStatus,
        example: OrderItemStatus.PENDING,
        description: "Trang thai item",
    })
    status: OrderItemStatus;

    @ApiPropertyOptional({
        example: "Less spicy",
        description: "Ghi chu item",
        type: String,
        nullable: true,
    })
    notes: string | null;

    @ApiProperty({
        example: "2026-04-17T09:00:00.000Z",
        description: "Thoi diem tao item",
        type: String,
        format: "date-time",
    })
    created_at: string;

    @ApiPropertyOptional({
        example: "2026-04-17T09:05:00.000Z",
        description: "Thoi diem cap nhat item",
        type: String,
        format: "date-time",
    })
    updated_at?: string;
}

export class OrderPersistedResponseDto {
    @ApiPropertyOptional({
        example: "664f1a2b3c4d5e6f7a8b9501",
        description: "Id derive tu _id neu du lieu duoc serialize co virtual",
        type: String,
    })
    id?: string;

    @ApiProperty({
        example: "664f1a2b3c4d5e6f7a8b9501",
        description: "ObjectId don hang",
        type: String,
    })
    _id: string;

    @ApiProperty({
        example: "20260417-0001",
        description: "Ma don tu sinh theo ngay va sequence",
        type: String,
    })
    order_number: string;

    @ApiProperty({
        example: "664f1a2b3c4d5e6f7a8b9001",
        description: "ObjectId nha hang",
        type: String,
    })
    restaurant_id: string;

    @ApiPropertyOptional({
        example: "664f1a2b3c4d5e6f7a8b9401",
        description: "ObjectId ban, null neu khong phai dine-in",
        type: String,
        nullable: true,
    })
    table_id: string | null;

    @ApiPropertyOptional({
        example: "664f1a2b3c4d5e6f7a8b9701",
        description: "ObjectId user dat don online",
        type: String,
        nullable: true,
    })
    user_id: string | null;

    @ApiPropertyOptional({
        example: "Nguyen Van A",
        description: "Ten khach",
        type: String,
        nullable: true,
    })
    customer_name: string | null;

    @ApiPropertyOptional({
        example: "0901234567",
        description: "SDT khach",
        type: String,
        nullable: true,
    })
    customer_phone: string | null;

    @ApiPropertyOptional({
        example: "664f1a2b3c4d5e6f7a8b9301",
        description: "ObjectId staff xu ly don",
        type: String,
        nullable: true,
    })
    staff_id: string | null;

    @ApiProperty({
        enum: OrderType,
        example: OrderType.DINE_IN,
        description: "Loai don",
    })
    order_type: OrderType;

    @ApiProperty({
        enum: OrderStatus,
        example: OrderStatus.PENDING,
        description: "Trang thai don",
    })
    status: OrderStatus;

    @ApiProperty({
        enum: OrderPaymentStatus,
        example: OrderPaymentStatus.UNPAID,
        description: "Trang thai thanh toan",
    })
    payment_status: OrderPaymentStatus;

    @ApiProperty({
        type: () => [OrderItemSnapshotResponseDto],
        description: "Danh sach item snapshot cua don",
    })
    items: OrderItemSnapshotResponseDto[];

    @ApiProperty({
        example: 158000,
        description: "Tong tien truoc discount va phi/thue",
        type: Number,
    })
    subtotal: number;

    @ApiProperty({
        enum: OrderDiscountType,
        example: OrderDiscountType.NONE,
        description: "Loai giam gia",
    })
    discount_type: OrderDiscountType;

    @ApiPropertyOptional({
        example: "PROMO-APR",
        description: "Ma tham chieu discount/coupon",
        type: String,
        nullable: true,
    })
    discount_ref: string | null;

    @ApiProperty({
        example: 0,
        description: "Gia tri discount dau vao",
        type: Number,
    })
    discount_value: number;

    @ApiProperty({
        example: 0,
        description: "So tien giam gia quy doi",
        type: Number,
    })
    discount_amount: number;

    @ApiProperty({
        example: 0.08,
        description: "Ty le thue",
        type: Number,
    })
    tax_rate: number;

    @ApiProperty({
        example: 12640,
        description: "Tien thue",
        type: Number,
    })
    tax_amount: number;

    @ApiProperty({
        example: 0.01,
        description: "Ty le service charge",
        type: Number,
    })
    service_charge_rate: number;

    @ApiProperty({
        example: 1580,
        description: "Tien service charge",
        type: Number,
    })
    service_charge_amount: number;

    @ApiProperty({
        example: 172220,
        description: "Tong thanh toan cuoi cung",
        type: Number,
    })
    total_amount: number;

    @ApiProperty({
        example: "VND",
        description: "Don vi tien te",
        type: String,
    })
    currency: string;

    @ApiProperty({
        enum: OrderSource,
        example: OrderSource.POS,
        description: "Nguon tao don",
    })
    source: OrderSource;

    @ApiPropertyOptional({
        example: "No sugar",
        description: "Ghi chu chung cua don",
        type: String,
        nullable: true,
    })
    notes: string | null;

    @ApiPropertyOptional({
        example: "2026-04-17T10:20:00.000Z",
        description: "Thoi diem hoan tat don",
        type: String,
        format: "date-time",
        nullable: true,
    })
    completed_at: string | null;

    @ApiPropertyOptional({
        example: "2026-04-17T10:30:00.000Z",
        description: "Thoi diem huy don",
        type: String,
        format: "date-time",
        nullable: true,
    })
    cancelled_at: string | null;

    @ApiPropertyOptional({
        example: "Customer changed plan",
        description: "Ly do huy don",
        type: String,
        nullable: true,
    })
    cancel_reason: string | null;

    @ApiProperty({
        example: "2026-04-17T09:00:00.000Z",
        description: "Thoi diem tao don",
        type: String,
        format: "date-time",
    })
    created_at: string;

    @ApiProperty({
        example: "2026-04-17T09:05:00.000Z",
        description: "Thoi diem cap nhat don",
        type: String,
        format: "date-time",
    })
    updated_at: string;
}

export class CreatePublicOrderResponseDto extends OrderPersistedResponseDto {
    @ApiProperty({
        example: "Order has been placed successfully",
        description: "Thong diep bo sung cho luong public order",
        type: String,
    })
    message: string;
}

export class OrderListItemResponseDto {
    @ApiProperty({
        example: "664f1a2b3c4d5e6f7a8b9501",
        description: "Id string cua don",
        type: String,
    })
    id: string;

    @ApiProperty({
        example: "664f1a2b3c4d5e6f7a8b9501",
        description: "ObjectId goc cua don",
        type: String,
    })
    _id: string;

    @ApiProperty({
        example: "20260417-0001",
        description: "Ma don",
        type: String,
    })
    order_number: string;

    @ApiProperty({
        enum: OrderType,
        example: OrderType.TAKEAWAY,
        description: "Loai don",
    })
    order_type: OrderType;

    @ApiProperty({
        enum: OrderSource,
        example: OrderSource.POS,
        description: "Nguon don",
    })
    source: OrderSource;

    @ApiProperty({
        enum: OrderStatus,
        example: OrderStatus.CONFIRMED,
        description: "Trang thai don",
    })
    status: OrderStatus;

    @ApiProperty({
        enum: OrderPaymentStatus,
        example: OrderPaymentStatus.UNPAID,
        description: "Trang thai thanh toan",
    })
    payment_status: OrderPaymentStatus;

    @ApiPropertyOptional({
        example: "664f1a2b3c4d5e6f7a8b9401",
        description: "Table id neu la dine-in",
        type: String,
        nullable: true,
    })
    table_id: string | null;

    @ApiPropertyOptional({
        example: "Nguyen Van A",
        description: "Ten khach",
        type: String,
        nullable: true,
    })
    customer_name: string | null;

    @ApiProperty({
        example: 172220,
        description: "Tong thanh toan",
        type: Number,
    })
    total_amount: number;

    @ApiProperty({
        example: "VND",
        description: "Tien te",
        type: String,
    })
    currency: string;

    @ApiProperty({
        example: 3,
        description: "So item trong don",
        type: Number,
    })
    item_count: number;

    @ApiProperty({
        example: "2026-04-17T09:00:00.000Z",
        description: "Thoi diem tao",
        type: String,
        format: "date-time",
    })
    created_at: string;
}

export class OrderListPaginationResponseDto {
    @ApiProperty({ example: 1, description: "Trang hien tai", type: Number })
    page: number;

    @ApiProperty({ example: 50, description: "So ban ghi moi trang", type: Number })
    limit: number;

    @ApiProperty({ example: 125, description: "Tong so don", type: Number })
    total: number;

    @ApiProperty({ example: 3, description: "Tong so trang", type: Number })
    total_pages: number;
}

export class OrderListSummaryResponseDto {
    @ApiProperty({ example: 125, description: "Tong so don theo bo loc", type: Number })
    total_orders: number;

    @ApiProperty({ example: 9823450, description: "Tong doanh thu paid/partial theo bo loc", type: Number })
    total_revenue: number;
}

export class ListOrdersResponseDto {
    @ApiProperty({ type: () => [OrderListItemResponseDto], description: "Danh sach don" })
    data: OrderListItemResponseDto[];

    @ApiProperty({
        type: () => OrderListPaginationResponseDto,
        description: "Thong tin phan trang",
    })
    pagination: OrderListPaginationResponseDto;

    @ApiProperty({
        type: () => OrderListSummaryResponseDto,
        description: "Thong ke tong hop",
    })
    summary: OrderListSummaryResponseDto;
}

export class ActiveOrderByTableResponseDto {
    @ApiPropertyOptional({
        type: () => OrderPersistedResponseDto,
        description: "Don active cua ban. Null neu khong ton tai.",
        nullable: true,
    })
    order: OrderPersistedResponseDto | null;
}

export class OrderItemAddedResponseDto extends OmitType(
    OrderItemSnapshotResponseDto,
    ["_id", "updated_at"] as const,
) {}

export class AddOrderItemsResponseDto {
    @ApiProperty({
        example: "664f1a2b3c4d5e6f7a8b9501",
        description: "Order id vua duoc cap nhat",
        type: String,
    })
    order_id: string;

    @ApiProperty({
        type: () => [OrderItemAddedResponseDto],
        description: "Danh sach item moi da append vao don",
    })
    new_items: OrderItemAddedResponseDto[];

    @ApiProperty({ example: 220000, description: "Subtotal moi", type: Number })
    subtotal: number;

    @ApiProperty({ example: 17600, description: "Tien thue moi", type: Number })
    tax_amount: number;

    @ApiProperty({ example: 2200, description: "Tien service charge moi", type: Number })
    service_charge_amount: number;

    @ApiProperty({ example: 239800, description: "Tong thanh toan moi", type: Number })
    total_amount: number;
}

export class UpdateOrderItemResponseDto {
    @ApiPropertyOptional({
        example: true,
        description: "True neu payload khong tao thay doi thuc te",
        type: Boolean,
    })
    unchanged?: boolean;

    @ApiProperty({
        type: () => OrderItemSnapshotResponseDto,
        description: "Item sau khi update trong runtime response",
    })
    item: OrderItemSnapshotResponseDto;

    @ApiProperty({ example: 220000, description: "Subtotal hien tai", type: Number })
    subtotal: number;

    @ApiProperty({ example: 17600, description: "Tien thue hien tai", type: Number })
    tax_amount: number;

    @ApiProperty({ example: 2200, description: "Tien service charge hien tai", type: Number })
    service_charge_amount: number;

    @ApiProperty({ example: 239800, description: "Tong thanh toan hien tai", type: Number })
    total_amount: number;
}

export class CancelOrderItemResponseDto {
    @ApiProperty({
        example: "664f1a2b3c4d5e6f7a8b9601",
        description: "Item id duoc yeu cau huy",
        type: String,
    })
    item_id: string;

    @ApiProperty({
        enum: OrderItemStatus,
        example: OrderItemStatus.CANCELLED,
        description: "Trang thai item trong runtime response",
    })
    status: OrderItemStatus;

    @ApiProperty({ example: 150000, description: "Subtotal sau huy item", type: Number })
    subtotal: number;

    @ApiProperty({ example: 12000, description: "Tien thue sau huy item", type: Number })
    tax_amount: number;

    @ApiProperty({ example: 1500, description: "Tien service charge sau huy item", type: Number })
    service_charge_amount: number;

    @ApiProperty({ example: 163500, description: "Tong thanh toan sau huy item", type: Number })
    total_amount: number;
}

export class UpdateOrderStatusResponseDto {
    @ApiPropertyOptional({
        example: true,
        description: "True neu status moi giong status hien tai",
        type: Boolean,
    })
    unchanged?: boolean;

    @ApiProperty({
        example: "664f1a2b3c4d5e6f7a8b9501",
        description: "Order id",
        type: String,
    })
    id: string;

    @ApiProperty({
        example: "20260417-0001",
        description: "Ma don",
        type: String,
    })
    order_number: string;

    @ApiProperty({
        enum: OrderStatus,
        example: OrderStatus.CONFIRMED,
        description: "Trang thai don sau update",
    })
    status: OrderStatus;

    @ApiProperty({
        example: "2026-04-17T09:10:00.000Z",
        description: "Thoi diem cap nhat",
        type: String,
        format: "date-time",
    })
    updated_at: string;
}

export class UpdateOrderItemStatusResponseDto {
    @ApiProperty({
        example: "664f1a2b3c4d5e6f7a8b9601",
        description: "Item id",
        type: String,
    })
    item_id: string;

    @ApiProperty({
        enum: OrderItemStatus,
        example: OrderItemStatus.READY,
        description: "Trang thai item trong runtime response",
    })
    status: OrderItemStatus;

    @ApiProperty({
        example: "2026-04-17T09:15:00.000Z",
        description: "Thoi diem cap nhat don",
        type: String,
        format: "date-time",
    })
    updated_at: string;
}

export class UpdateOrderDiscountResponseDto {
    @ApiProperty({
        enum: OrderDiscountType,
        example: OrderDiscountType.PERCENT,
        description: "Loai giam gia",
    })
    discount_type: OrderDiscountType;

    @ApiPropertyOptional({
        example: "PROMO-APR",
        description: "Ma giam gia/coupon",
        type: String,
        nullable: true,
    })
    discount_ref: string | null;

    @ApiProperty({
        example: 15000,
        description: "So tien giam gia sau quy doi",
        type: Number,
    })
    discount_amount: number;

    @ApiProperty({ example: 150000, description: "Subtotal hien tai", type: Number })
    subtotal: number;

    @ApiProperty({ example: 12000, description: "Tien thue hien tai", type: Number })
    tax_amount: number;

    @ApiProperty({ example: 1500, description: "Tien service charge hien tai", type: Number })
    service_charge_amount: number;

    @ApiProperty({ example: 148500, description: "Tong thanh toan hien tai", type: Number })
    total_amount: number;
}

export class CancelOrderResponseDto {
    @ApiProperty({
        example: "664f1a2b3c4d5e6f7a8b9501",
        description: "Order id",
        type: String,
    })
    id: string;

    @ApiProperty({
        example: "20260417-0001",
        description: "Ma don",
        type: String,
    })
    order_number: string;

    @ApiProperty({
        enum: OrderStatus,
        example: OrderStatus.CANCELLED,
        description: "Trang thai don trong runtime response",
    })
    status: OrderStatus;

    @ApiPropertyOptional({
        example: "Customer changed plan",
        description: "Ly do huy trong runtime response",
        type: String,
        nullable: true,
    })
    cancel_reason: string | null;

    @ApiPropertyOptional({
        example: "2026-04-17T09:20:00.000Z",
        description: "Thoi diem huy don",
        type: String,
        format: "date-time",
        nullable: true,
    })
    cancelled_at: string | null;
}
