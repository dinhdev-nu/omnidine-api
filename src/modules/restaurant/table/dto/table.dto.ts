import {
    ApiProperty,
    ApiPropertyOptional,
    OmitType,
    PartialType,
    PickType,
} from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
    IsBoolean,
    IsEnum,
    IsInt,
    IsOptional,
    IsString,
    Max,
    MaxLength,
    Min,
    MinLength,
} from "class-validator";
import { TableStatus } from "../schemas/table.schema";

function toBoolean(value: unknown): unknown {
    if (value === true || value === "true") return true;
    if (value === false || value === "false") return false;
    return value;
}

export class CreateTableDto {
    @ApiProperty({
        example: "A01",
        description: "So ban duy nhat trong pham vi nha hang",
        type: String,
        minLength: 1,
        maxLength: 20,
    })
    @IsString()
    @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
    @MinLength(1, { message: "table_number must not be empty" })
    @MaxLength(20, { message: "table_number must be at most 20 characters" })
    table_number: string;

    @ApiProperty({
        example: 4,
        description: "So luong khach toi da cua ban",
        type: Number,
        minimum: 1,
        maximum: 99,
    })
    @Type(() => Number)
    @IsInt({ message: "capacity must be an integer" })
    @Min(1, { message: "capacity must be at least 1" })
    @Max(99, { message: "capacity must be at most 99" })
    capacity: number;

    @ApiPropertyOptional({
        example: "Ban sat cua so",
        description: "Ten goi nho cua ban, co the null",
        type: String,
        minLength: 1,
        maxLength: 50,
        nullable: true,
    })
    @IsOptional()
    @IsString()
    @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
    @MinLength(1, { message: "name must not be empty" })
    @MaxLength(50, { message: "name must be at most 50 characters" })
    name?: string | null;

    @ApiPropertyOptional({
        example: "Uu tien cho khach dat truoc vao gio cao diem",
        description: "Ghi chu noi bo cho ban, co the null",
        type: String,
        maxLength: 500,
        nullable: true,
    })
    @IsOptional()
    @IsString()
    @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
    @MaxLength(500, { message: "notes must be at most 500 characters" })
    notes?: string | null;
}

export class ListTablesQueryDto {
    @ApiPropertyOptional({
        enum: TableStatus,
        example: TableStatus.AVAILABLE,
        description: "Loc theo trang thai ban",
    })
    @IsOptional()
    @IsEnum(TableStatus, { message: "status must be a valid table status" })
    status?: TableStatus;

    @ApiPropertyOptional({
        example: true,
        description: "Loc theo trang thai kich hoat",
        type: Boolean,
    })
    @IsOptional()
    @Transform(({ value }) => toBoolean(value))
    @IsBoolean({ message: "is_active must be a boolean" })
    is_active?: boolean;

    @ApiPropertyOptional({
        example: 2,
        description: "Loc suc chua toi thieu",
        type: Number,
        minimum: 1,
        maximum: 99,
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: "capacity_min must be an integer" })
    @Min(1, { message: "capacity_min must be at least 1" })
    @Max(99, { message: "capacity_min must be at most 99" })
    capacity_min?: number;

    @ApiPropertyOptional({
        example: 8,
        description: "Loc suc chua toi da",
        type: Number,
        minimum: 1,
        maximum: 99,
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: "capacity_max must be an integer" })
    @Min(1, { message: "capacity_max must be at least 1" })
    @Max(99, { message: "capacity_max must be at most 99" })
    capacity_max?: number;
}

export class UpdateTableDto extends PartialType(
    PickType(CreateTableDto, ["table_number", "capacity", "name", "notes"] as const),
) {}

export class UpdateTableStatusDto {
    @ApiProperty({
        enum: TableStatus,
        example: TableStatus.RESERVED,
        description: "Trang thai moi cua ban",
    })
    @IsEnum(TableStatus, { message: "status must be a valid table status" })
    status: TableStatus;
}

export class TablePersistedResponseDto {
    @ApiProperty({ example: "664f1a2b3c4d5e6f7a8b9401", description: "ObjectId ban", type: String })
    _id: string;

    @ApiProperty({ example: "664f1a2b3c4d5e6f7a8b9001", description: "ObjectId nha hang", type: String })
    restaurant_id: string;

    @ApiProperty({ example: "A01", description: "So ban", type: String })
    table_number: string;

    @ApiPropertyOptional({
        example: "Ban sat cua so",
        description: "Ten goi nho cua ban",
        type: String,
        nullable: true,
    })
    name: string | null;

    @ApiProperty({ example: 4, description: "Suc chua", type: Number })
    capacity: number;

    @ApiProperty({ enum: TableStatus, example: TableStatus.AVAILABLE, description: "Trang thai ban" })
    status: TableStatus;

    @ApiPropertyOptional({
        example: "06d66ff8-7f8d-4df4-97b7-b04b774706f7",
        description: "Ma QR hien tai cua ban",
        type: String,
        nullable: true,
    })
    qr_code: string | null;

    @ApiPropertyOptional({
        example: "Uu tien khach dat truoc",
        description: "Ghi chu noi bo",
        type: String,
        nullable: true,
    })
    notes: string | null;

    @ApiProperty({ example: true, description: "Trang thai kich hoat", type: Boolean })
    is_active: boolean;

    @ApiProperty({
        example: "2026-04-17T09:00:00.000Z",
        description: "Thoi diem tao",
        type: String,
        format: "date-time",
    })
    created_at: string;

    @ApiProperty({
        example: "2026-04-17T10:00:00.000Z",
        description: "Thoi diem cap nhat",
        type: String,
        format: "date-time",
    })
    updated_at: string;
}

export class TableListItemResponseDto {
    @ApiProperty({ example: "664f1a2b3c4d5e6f7a8b9401", description: "Table id", type: String })
    id: string;

    @ApiProperty({ example: "A01", description: "So ban", type: String })
    table_number: string;

    @ApiPropertyOptional({ example: "Ban sat cua so", description: "Ten ban", nullable: true, type: String })
    name: string | null;

    @ApiProperty({ example: 4, description: "Suc chua", type: Number })
    capacity: number;

    @ApiProperty({ enum: TableStatus, example: TableStatus.AVAILABLE, description: "Trang thai ban" })
    status: TableStatus;

    @ApiProperty({ example: true, description: "Trang thai kich hoat", type: Boolean })
    is_active: boolean;

    @ApiProperty({ example: true, description: "Ban da co QR hay chua", type: Boolean })
    has_qr: boolean;

    @ApiPropertyOptional({
        example: "Uu tien khach dat truoc",
        description: "Ghi chu chi hien voi owner/admin",
        nullable: true,
        type: String,
    })
    notes?: string | null;
}

export class ListTablesResponseDto {
    @ApiProperty({ type: () => [TableListItemResponseDto], description: "Danh sach ban" })
    data: TableListItemResponseDto[];

    @ApiProperty({ example: 28, description: "Tong so ban sau khi ap dung bo loc", type: Number })
    total: number;
}

export class TableDetailOwnerResponseDto {
    @ApiProperty({ example: "664f1a2b3c4d5e6f7a8b9401", description: "Table id", type: String })
    id: string;

    @ApiProperty({ example: "664f1a2b3c4d5e6f7a8b9001", description: "ObjectId nha hang", type: String })
    restaurant_id: string;

    @ApiProperty({ example: "A01", description: "So ban", type: String })
    table_number: string;

    @ApiPropertyOptional({ example: "Ban sat cua so", description: "Ten ban", nullable: true, type: String })
    name: string | null;

    @ApiProperty({ example: 4, description: "Suc chua", type: Number })
    capacity: number;

    @ApiProperty({ enum: TableStatus, example: TableStatus.AVAILABLE, description: "Trang thai ban" })
    status: TableStatus;

    @ApiProperty({ example: true, description: "Trang thai kich hoat", type: Boolean })
    is_active: boolean;

    @ApiPropertyOptional({
        example: "06d66ff8-7f8d-4df4-97b7-b04b774706f7",
        description: "QR code hien tai",
        nullable: true,
        type: String,
    })
    qr_code: string | null;

    @ApiPropertyOptional({
        example: "Uu tien khach dat truoc",
        description: "Ghi chu noi bo",
        nullable: true,
        type: String,
    })
    notes: string | null;

    @ApiProperty({
        example: "2026-04-17T09:00:00.000Z",
        description: "Thoi diem tao",
        type: String,
        format: "date-time",
    })
    created_at: string;

    @ApiProperty({
        example: "2026-04-17T10:00:00.000Z",
        description: "Thoi diem cap nhat",
        type: String,
        format: "date-time",
    })
    updated_at: string;
}

export class TableDetailStaffResponseDto extends OmitType(
    TableDetailOwnerResponseDto,
    ["qr_code", "notes"] as const,
) {
    @ApiProperty({ example: true, description: "Ban da co QR hay chua", type: Boolean })
    has_qr: boolean;
}

export class UpdateTableResponseDto {
    @ApiProperty({ example: true, description: "Danh dau cap nhat thanh cong", type: Boolean })
    updated: boolean;

    @ApiProperty({ type: () => TablePersistedResponseDto, description: "Du lieu ban sau cap nhat" })
    table: TablePersistedResponseDto;
}

export class UpdateTableStatusTableResponseDto {
    @ApiProperty({ example: "664f1a2b3c4d5e6f7a8b9001", description: "ObjectId nha hang", type: String })
    restaurant_id: string;

    @ApiProperty({ example: "A01", description: "So ban", type: String })
    table_number: string;

    @ApiProperty({ enum: TableStatus, example: TableStatus.RESERVED, description: "Trang thai ban" })
    status: TableStatus;

    @ApiProperty({
        example: "2026-04-17T10:05:00.000Z",
        description: "Thoi diem cap nhat",
        type: String,
        format: "date-time",
    })
    updated_at: string;
}

export class UpdateTableStatusResponseDto {
    @ApiProperty({
        example: false,
        description: "true neu status khong thay doi vi trung voi gia tri hien tai",
        type: Boolean,
    })
    unchanged: boolean;

    @ApiPropertyOptional({
        type: () => UpdateTableStatusTableResponseDto,
        description: "Thong tin toi gian cua ban sau khi doi status",
    })
    table?: UpdateTableStatusTableResponseDto;
}

export class ToggleTableActiveResponseDto {
    @ApiProperty({ example: "664f1a2b3c4d5e6f7a8b9001", description: "ObjectId nha hang", type: String })
    restaurant_id: string;

    @ApiProperty({ example: "A01", description: "So ban", type: String })
    table_number: string;

    @ApiProperty({ example: false, description: "Trang thai active moi cua ban", type: Boolean })
    is_active: boolean;

    @ApiProperty({
        example: "2026-04-17T10:10:00.000Z",
        description: "Thoi diem cap nhat",
        type: String,
        format: "date-time",
    })
    updated_at: string;
}

export class RegenerateTableQrResponseDto {
    @ApiProperty({ example: "664f1a2b3c4d5e6f7a8b9401", description: "Table id", type: String })
    table_id: string;

    @ApiProperty({
        example: "06d66ff8-7f8d-4df4-97b7-b04b774706f7",
        description: "QR code moi",
        type: String,
    })
    qr_code: string;

    @ApiProperty({
        example: "https://api.example.com/public/tables/06d66ff8-7f8d-4df4-97b7-b04b774706f7",
        description: "URL scan QR public",
        type: String,
    })
    qr_url: string;

    @ApiProperty({
        example: "2026-04-17T10:12:00.000Z",
        description: "Thoi diem cap nhat",
        type: String,
        format: "date-time",
    })
    updated_at: string;
}

export class DeleteTableResponseDto {
    @ApiProperty({ example: "Deleted table A01", description: "Thong diep xoa ban", type: String })
    message: string;
}

export class PublicTableRestaurantSummaryDto {
    @ApiPropertyOptional({
        example: "664f1a2b3c4d5e6f7a8b9001",
        description: "Id nha hang (co the khong co tuy vao cach serialize)",
        type: String,
    })
    id?: string;

    @ApiProperty({ example: "Bep Nha Viet", description: "Ten nha hang", type: String })
    name: string;

    @ApiProperty({ example: "bep-nha-viet", description: "Slug nha hang", type: String })
    slug: string;

    @ApiPropertyOptional({
        example: "https://res.cloudinary.com/demo/image/upload/v1/restaurants/logo.jpg",
        description: "Logo nha hang",
        nullable: true,
        type: String,
    })
    logo_url: string | null;
}

export class PublicTableScanResponseDto {
    @ApiProperty({ example: "664f1a2b3c4d5e6f7a8b9401", description: "Table id", type: String })
    table_id: string;

    @ApiProperty({ example: "A01", description: "So ban", type: String })
    table_number: string;

    @ApiPropertyOptional({ example: "Ban sat cua so", description: "Ten ban", nullable: true, type: String })
    name: string | null;

    @ApiProperty({ example: 4, description: "Suc chua", type: Number })
    capacity: number;

    @ApiProperty({ enum: TableStatus, example: TableStatus.AVAILABLE, description: "Trang thai ban" })
    status: TableStatus;

    @ApiProperty({ type: () => PublicTableRestaurantSummaryDto, description: "Thong tin nha hang" })
    restaurant: PublicTableRestaurantSummaryDto;

    @ApiProperty({
        example: "/public/restaurants/bep-nha-viet/menu",
        description: "Duong dan menu public cua nha hang",
        type: String,
    })
    menu_url: string;
}
