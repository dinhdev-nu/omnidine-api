import {
    ApiProperty,
    ApiPropertyOptional,
    PartialType,
    PickType,
} from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
    ArrayNotEmpty,
    IsArray,
    IsBoolean,
    IsInt,
    IsMongoId,
    IsNumber,
    IsOptional,
    IsString,
    IsUrl,
    Matches,
    Max,
    MaxLength,
    Min,
    MinLength,
} from "class-validator";
import { Types } from "mongoose";

const IMAGE_URL_REGEX = /^https:\/\/.+\.(jpg|jpeg|png|webp)(\?.*)?$/i;

export class CreateMenuCategoryDto {
    @ApiProperty({
        example: "Mon Viet Truyen Thong",
        description: "Ten danh muc mon an trong menu",
        type: String,
        minLength: 1,
        maxLength: 150,
    })
    @IsString()
    @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
    @MinLength(1, { message: "name khong duoc de trong" })
    @MaxLength(150, { message: "name toi da 150 ky tu" })
    name: string;

    @ApiPropertyOptional({
        example: "Cac mon an truyen thong phuc vu trong bua chinh",
        description: "Mo ta ngan cho danh muc, co the null",
        type: String,
        nullable: true,
    })
    @IsOptional()
    @IsString()
    @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
    description?: string | null;

    @ApiPropertyOptional({
        example: "https://res.cloudinary.com/demo/image/upload/v1/menu/category-viet.jpg",
        description: "Anh dai dien danh muc, bat buoc HTTPS va duoi jpg/jpeg/png/webp",
        type: String,
        nullable: true,
    })
    @IsOptional()
    @IsString()
    @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
    @Matches(IMAGE_URL_REGEX, {
        message: "image_url phai la HTTPS va co extension jpg/jpeg/png/webp",
    })
    image_url?: string | null;

    @ApiPropertyOptional({
        example: 3,
        description: "Thu tu sap xep danh muc, tu 0 tro len",
        type: Number,
        minimum: 0,
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: "sort_order phai la so nguyen" })
    @Min(0, { message: "sort_order phai >= 0" })
    sort_order?: number;
}

export class ListMenuCategoryQueryDto {
    @ApiPropertyOptional({
        example: false,
        description: "true de lay ca danh muc inactive, false chi lay active",
        type: Boolean,
        default: false,
    })
    @IsOptional()
    @Transform(({ value }) => {
        if (value === true || value === "true") return true;
        if (value === false || value === "false") return false;
        return value;
    })
    @IsBoolean({ message: "include_inactive phai la boolean" })
    include_inactive?: boolean;
}

export class UpdateMenuCategoryDto extends PartialType(
    PickType(CreateMenuCategoryDto, ["name", "description", "image_url"] as const),
) {}

export class ToggleMenuCategoryDto {
    @ApiProperty({
        example: true,
        description: "Trang thai hien/anh cua danh muc",
        type: Boolean,
    })
    @IsBoolean({ message: "is_active phai la boolean" })
    is_active: boolean;
}

export class ReorderMenuCategoriesDto {
    @ApiProperty({
        example: [
            "664f1a2b3c4d5e6f7a8b9101",
            "664f1a2b3c4d5e6f7a8b9102",
            "664f1a2b3c4d5e6f7a8b9103",
        ],
        description: "Danh sach category id theo thu tu moi, phai day du tat ca id trong nha hang",
        type: [String],
    })
    @IsArray({ message: "order phai la mang" })
    @ArrayNotEmpty({ message: "order khong duoc rong" })
    @Transform(({ value }) => {
        if (!Array.isArray(value)) return value;
        return value.map((id) => {
            if (id instanceof Types.ObjectId) return id.toString();
            return id;
        });
    })
    @IsMongoId({ each: true, message: "order phai gom cac ObjectId hop le" })
    order: Array<string>;
}

export class CreateMenuItemDto {
    @ApiProperty({
        example: "664f1a2b3c4d5e6f7a8b9101",
        description: "ObjectId danh muc chua mon an",
        type: String,
    })
    @Transform(({ value }) => (value instanceof Types.ObjectId ? value.toString() : value))
    @IsMongoId({ message: "category_id khong hop le" })
    category_id: Types.ObjectId;

    @ApiProperty({
        example: "Pho Bo Tai",
        description: "Ten mon an",
        type: String,
        minLength: 1,
        maxLength: 200,
    })
    @IsString()
    @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
    @MinLength(1, { message: "name khong duoc de trong" })
    @MaxLength(200, { message: "name toi da 200 ky tu" })
    name: string;

    @ApiPropertyOptional({
        example: "Nuoc dung trong, banh pho tuoi, thit bo tai",
        description: "Mo ta mon an, co the null",
        type: String,
        nullable: true,
    })
    @IsOptional()
    @IsString()
    @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
    description?: string | null;

    @ApiProperty({
        example: 79000,
        description: "Gia co ban cua mon an, >= 0",
        type: Number,
        minimum: 0,
    })
    @Type(() => Number)
    @IsNumber({}, { message: "base_price phai la so" })
    @Min(0, { message: "base_price phai >= 0" })
    base_price: number;

    @ApiPropertyOptional({
        example: true,
        description: "Trang thai con ban hay tam het hang",
        type: Boolean,
        default: true,
    })
    @IsOptional()
    @Transform(({ value }) => {
        if (value === true || value === "true") return true;
        if (value === false || value === "false") return false;
        return value;
    })
    @IsBoolean({ message: "is_available phai la boolean" })
    is_available?: boolean;

    @ApiPropertyOptional({
        example: false,
        description: "Danh dau mon noi bat de uu tien hien thi",
        type: Boolean,
        default: false,
    })
    @IsOptional()
    @Transform(({ value }) => {
        if (value === true || value === "true") return true;
        if (value === false || value === "false") return false;
        return value;
    })
    @IsBoolean({ message: "is_featured phai la boolean" })
    is_featured?: boolean;

    @ApiPropertyOptional({
        example: 10,
        description: "Thu tu mon an trong danh muc, tu 0 tro len",
        type: Number,
        minimum: 0,
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: "sort_order phai la so nguyen" })
    @Min(0, { message: "sort_order phai >= 0" })
    sort_order?: number;
}

export class ListMenuItemsQueryDto {
    @ApiPropertyOptional({
        example: "664f1a2b3c4d5e6f7a8b9101",
        description: "Loc theo category id",
        type: String,
    })
    @IsOptional()
    @Transform(({ value }) => (value instanceof Types.ObjectId ? value.toString() : value))
    @IsMongoId({ message: "category_id khong hop le" })
    category_id?: string | Types.ObjectId;

    @ApiPropertyOptional({
        example: true,
        description: "Loc theo trang thai ban",
        type: Boolean,
    })
    @IsOptional()
    @Transform(({ value }) => {
        if (value === true || value === "true") return true;
        if (value === false || value === "false") return false;
        return value;
    })
    @IsBoolean({ message: "is_available phai la boolean" })
    is_available?: boolean;

    @ApiPropertyOptional({
        example: false,
        description: "Loc theo trang thai noi bat",
        type: Boolean,
    })
    @IsOptional()
    @Transform(({ value }) => {
        if (value === true || value === "true") return true;
        if (value === false || value === "false") return false;
        return value;
    })
    @IsBoolean({ message: "is_featured phai la boolean" })
    is_featured?: boolean;

    @ApiPropertyOptional({
        example: 1,
        description: "Trang hien tai, >= 1",
        type: Number,
        minimum: 1,
        default: 1,
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: "page phai la so nguyen" })
    @Min(1, { message: "page phai >= 1" })
    page?: number = 1;

    @ApiPropertyOptional({
        example: 50,
        description: "So ban ghi moi trang, 1-100",
        type: Number,
        minimum: 1,
        maximum: 100,
        default: 50,
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: "limit phai la so nguyen" })
    @Min(1, { message: "limit phai >= 1" })
    @Max(100, { message: "limit phai <= 100" })
    limit?: number = 50;
}

export class UpdateMenuItemDto extends PartialType(
    PickType(CreateMenuItemDto, ["category_id", "name", "description", "base_price"] as const),
) {}

export class ToggleMenuItemAvailabilityDto {
    @ApiProperty({
        example: false,
        description: "Trang thai con ban cua mon",
        type: Boolean,
    })
    @Transform(({ value }) => {
        if (value === true || value === "true") return true;
        if (value === false || value === "false") return false;
        return value;
    })
    @IsBoolean({ message: "is_available phai la boolean" })
    is_available: boolean;
}

export class ToggleMenuItemFeaturedDto {
    @ApiProperty({
        example: true,
        description: "Trang thai danh dau noi bat",
        type: Boolean,
    })
    @Transform(({ value }) => {
        if (value === true || value === "true") return true;
        if (value === false || value === "false") return false;
        return value;
    })
    @IsBoolean({ message: "is_featured phai la boolean" })
    is_featured: boolean;
}

export class AddMenuItemImageDto {
    @ApiProperty({
        example: "https://res.cloudinary.com/demo/image/upload/v1/menu/pho-bo.jpg",
        description: "URL anh mon an, bat buoc HTTPS va duoi jpg/jpeg/png/webp",
        type: String,
    })
    @IsString()
    @IsUrl({}, { message: "url phai la URL hop le" })
    @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
    @Matches(IMAGE_URL_REGEX, {
        message: "url phai la HTTPS va co extension jpg/jpeg/png/webp",
    })
    url: string;

    @ApiPropertyOptional({
        example: "To pho bo tai tai nha hang",
        description: "Van ban mo ta thay the cho anh",
        type: String,
        maxLength: 255,
    })
    @IsOptional()
    @IsString()
    @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
    @MaxLength(255, { message: "alt toi da 255 ky tu" })
    alt?: string;
}

export class ReorderMenuItemsDto {
    @ApiProperty({
        example: "664f1a2b3c4d5e6f7a8b9101",
        description: "Category id chua danh sach item can reorder",
        type: String,
    })
    @Transform(({ value }) => (value instanceof Types.ObjectId ? value.toString() : value))
    @IsMongoId({ message: "category_id khong hop le" })
    category_id: string | Types.ObjectId;

    @ApiProperty({
        example: [
            "664f1a2b3c4d5e6f7a8b9201",
            "664f1a2b3c4d5e6f7a8b9202",
            "664f1a2b3c4d5e6f7a8b9203",
        ],
        description: "Danh sach item id theo thu tu moi, phai day du tat ca mon trong category",
        type: [String],
    })
    @IsArray({ message: "order phai la mang" })
    @ArrayNotEmpty({ message: "order khong duoc rong" })
    @Transform(({ value }) => {
        if (!Array.isArray(value)) return value;
        return value.map((id) => {
            if (id instanceof Types.ObjectId) return id.toString();
            return id;
        });
    })
    @IsMongoId({ each: true, message: "order phai gom cac ObjectId hop le" })
    order: Array<string | Types.ObjectId>;
}

export class PublicMenuSearchQueryDto {
    @ApiProperty({
        example: "pho",
        description: "Tu khoa tim kiem full-text tren name va description",
        type: String,
        minLength: 1,
        maxLength: 100,
    })
    @IsString()
    @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
    @MinLength(1, { message: "q khong duoc de trong" })
    @MaxLength(100, { message: "q toi da 100 ky tu" })
    q: string;

    @ApiPropertyOptional({
        example: 1,
        description: "Trang hien tai, >= 1",
        type: Number,
        minimum: 1,
        default: 1,
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: "page phai la so nguyen" })
    @Min(1, { message: "page phai >= 1" })
    page?: number = 1;

    @ApiPropertyOptional({
        example: 20,
        description: "So ket qua moi trang, 1-50",
        type: Number,
        minimum: 1,
        maximum: 50,
        default: 20,
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: "limit phai la so nguyen" })
    @Min(1, { message: "limit phai >= 1" })
    @Max(50, { message: "limit phai <= 50" })
    limit?: number = 20;
}

export class MenuItemImageResponseDto {
    @ApiProperty({
        example: "https://res.cloudinary.com/demo/image/upload/v1/menu/pho-bo.jpg",
        description: "URL anh mon an",
        type: String,
    })
    url: string;

    @ApiProperty({
        example: "To pho bo tai",
        description: "Mo ta thay the cho anh",
        type: String,
    })
    alt: string;
}

export class MenuCategoryResponseDto {
    @ApiProperty({ example: "664f1a2b3c4d5e6f7a8b9101", description: "ObjectId danh muc", type: String })
    _id: string;

    @ApiProperty({ example: "664f1a2b3c4d5e6f7a8b9001", description: "ObjectId nha hang", type: String })
    restaurant_id: string;

    @ApiProperty({ example: "Mon Viet Truyen Thong", description: "Ten danh muc", type: String })
    name: string;

    @ApiPropertyOptional({
        example: "Cac mon an truyen thong",
        description: "Mo ta danh muc",
        type: String,
        nullable: true,
    })
    description: string | null;

    @ApiPropertyOptional({
        example: "https://res.cloudinary.com/demo/image/upload/v1/menu/category-viet.jpg",
        description: "Anh dai dien danh muc",
        type: String,
        nullable: true,
    })
    image_url: string | null;

    @ApiProperty({ example: 0, description: "Thu tu hien thi", type: Number })
    sort_order: number;

    @ApiProperty({ example: true, description: "Trang thai hoat dong", type: Boolean })
    is_active: boolean;

    @ApiProperty({
        example: "2026-04-17T09:00:00.000Z",
        description: "Thoi diem tao",
        type: String,
        format: "date-time",
    })
    created_at: string;

    @ApiProperty({
        example: "2026-04-17T09:30:00.000Z",
        description: "Thoi diem cap nhat",
        type: String,
        format: "date-time",
    })
    updated_at: string;
}

export class MenuCategoryListItemResponseDto extends MenuCategoryResponseDto {
    @ApiProperty({ example: 12, description: "So mon an chua bi soft delete trong danh muc", type: Number })
    item_count: number;
}

export class ListMenuCategoriesResponseDto {
    @ApiProperty({
        type: () => [MenuCategoryListItemResponseDto],
        description: "Danh sach danh muc menu",
    })
    data: MenuCategoryListItemResponseDto[];
}

export class UpdateMenuCategoryResponseDto {
    @ApiProperty({ example: true, description: "Danh dau cap nhat thanh cong", type: Boolean })
    updated: boolean;

    @ApiProperty({ type: () => MenuCategoryResponseDto, description: "Danh muc sau cap nhat" })
    category: MenuCategoryResponseDto;
}

export class ToggleMenuCategoryResponseDto {
    @ApiProperty({ example: false, description: "Trang thai moi cua danh muc", type: Boolean })
    is_active: boolean;

    @ApiProperty({ example: "Da an", description: "Thong diep nghiep vu", type: String })
    message: string;
}

export class ReorderResponseDto {
    @ApiProperty({ example: true, description: "Danh dau sap xep thanh cong", type: Boolean })
    reordered: boolean;
}

export class DeleteResponseDto {
    @ApiProperty({ example: true, description: "Danh dau xoa thanh cong", type: Boolean })
    deleted: boolean;
}

export class MenuItemResponseDto {
    @ApiProperty({ example: "664f1a2b3c4d5e6f7a8b9201", description: "ObjectId mon an", type: String })
    _id: string;

    @ApiProperty({ example: "664f1a2b3c4d5e6f7a8b9001", description: "ObjectId nha hang", type: String })
    restaurant_id: string;

    @ApiProperty({ example: "664f1a2b3c4d5e6f7a8b9101", description: "ObjectId danh muc", type: String })
    category_id: string;

    @ApiProperty({ example: "Pho Bo Tai", description: "Ten mon an", type: String })
    name: string;

    @ApiPropertyOptional({
        example: "Nuoc dung trong, banh pho tuoi",
        description: "Mo ta mon an",
        type: String,
        nullable: true,
    })
    description: string | null;

    @ApiProperty({ example: 79000, description: "Gia co ban", type: Number })
    base_price: number;

    @ApiProperty({ type: () => [MenuItemImageResponseDto], description: "Danh sach anh mon an" })
    images: MenuItemImageResponseDto[];

    @ApiProperty({ example: true, description: "Con ban hay khong", type: Boolean })
    is_available: boolean;

    @ApiProperty({ example: false, description: "Mon noi bat hay khong", type: Boolean })
    is_featured: boolean;

    @ApiProperty({ example: 3, description: "Thu tu hien thi", type: Number })
    sort_order: number;

    @ApiPropertyOptional({
        example: null,
        description: "Thoi diem soft delete, null neu chua xoa",
        type: String,
        nullable: true,
        format: "date-time",
    })
    deleted_at: string | null;

    @ApiProperty({
        example: "2026-04-17T10:00:00.000Z",
        description: "Thoi diem tao",
        type: String,
        format: "date-time",
    })
    created_at: string;

    @ApiProperty({
        example: "2026-04-17T10:15:00.000Z",
        description: "Thoi diem cap nhat",
        type: String,
        format: "date-time",
    })
    updated_at: string;
}

export class MenuPaginationMetaDto {
    @ApiProperty({ example: 1, description: "Trang hien tai", type: Number })
    page: number;

    @ApiProperty({ example: 50, description: "So ban ghi tren trang", type: Number })
    limit: number;

    @ApiProperty({ example: 120, description: "Tong ban ghi", type: Number })
    total: number;

    @ApiProperty({ example: 3, description: "Tong so trang", type: Number })
    total_pages: number;
}

export class ListMenuItemsResponseDto {
    @ApiProperty({ type: () => [MenuItemResponseDto], description: "Danh sach mon an" })
    data: MenuItemResponseDto[];

    @ApiProperty({ type: () => MenuPaginationMetaDto, description: "Thong tin phan trang" })
    pagination: MenuPaginationMetaDto;
}

export class UpdateMenuItemResponseDto {
    @ApiProperty({ example: true, description: "Danh dau cap nhat thanh cong", type: Boolean })
    updated: boolean;

    @ApiProperty({ type: () => MenuItemResponseDto, description: "Mon an sau cap nhat" })
    item: MenuItemResponseDto;
}

export class ToggleMenuItemAvailabilityResponseDto {
    @ApiProperty({ example: false, description: "Trang thai con ban cua mon", type: Boolean })
    is_available: boolean;

    @ApiProperty({ example: "Het hang", description: "Thong diep nghiep vu", type: String })
    message: string;

    @ApiProperty({
        type: [String],
        example: ["Co 2 mon dang duoc xu ly"],
        description: "Canh bao nghiep vu khi tat san pham co tham chieu order active",
    })
    warnings: string[];
}

export class ToggleMenuItemFeaturedResponseDto {
    @ApiProperty({ example: true, description: "Trang thai noi bat", type: Boolean })
    is_featured: boolean;

    @ApiProperty({ example: "Da danh dau noi bat", description: "Thong diep nghiep vu", type: String })
    message: string;
}

export class MenuItemImagesMutationResponseDto {
    @ApiProperty({ type: () => [MenuItemImageResponseDto], description: "Danh sach anh hien tai cua mon" })
    images: MenuItemImageResponseDto[];

    @ApiProperty({ example: 2, description: "Tong so anh hien tai", type: Number })
    count: number;
}

export class PublicRestaurantLocationDto {
    @ApiProperty({ enum: ["Point"], example: "Point", description: "GeoJSON type" })
    type: string;

    @ApiProperty({
        type: [Number],
        example: [106.7009, 10.7769],
        description: "Toa do [longitude, latitude]",
    })
    coordinates: [number, number];
}

export class PublicDayHoursDto {
    @ApiProperty({ example: "08:00", description: "Gio mo cua HH:mm", type: String })
    open: string;

    @ApiProperty({ example: "22:00", description: "Gio dong cua HH:mm", type: String })
    close: string;

    @ApiProperty({ example: false, description: "true neu dong cua ca ngay", type: Boolean })
    closed: boolean;
}

export class PublicOperatingHoursDto {
    @ApiPropertyOptional({ type: () => PublicDayHoursDto, description: "Thu Hai" })
    mon?: PublicDayHoursDto;

    @ApiPropertyOptional({ type: () => PublicDayHoursDto, description: "Thu Ba" })
    tue?: PublicDayHoursDto;

    @ApiPropertyOptional({ type: () => PublicDayHoursDto, description: "Thu Tu" })
    wed?: PublicDayHoursDto;

    @ApiPropertyOptional({ type: () => PublicDayHoursDto, description: "Thu Nam" })
    thu?: PublicDayHoursDto;

    @ApiPropertyOptional({ type: () => PublicDayHoursDto, description: "Thu Sau" })
    fri?: PublicDayHoursDto;

    @ApiPropertyOptional({ type: () => PublicDayHoursDto, description: "Thu Bay" })
    sat?: PublicDayHoursDto;

    @ApiPropertyOptional({ type: () => PublicDayHoursDto, description: "Chu Nhat" })
    sun?: PublicDayHoursDto;
}

export class PublicMenuRestaurantDto {
    @ApiProperty({ example: "Bep Nha Viet", description: "Ten nha hang", type: String })
    name: string;

    @ApiPropertyOptional({
        example: "Nha hang chuyen mon Viet",
        description: "Mo ta nha hang",
        type: String,
        nullable: true,
    })
    description: string | null;

    @ApiPropertyOptional({
        example: "Vietnamese",
        description: "Loai hinh am thuc",
        type: String,
        nullable: true,
    })
    cuisine_type: string | null;

    @ApiPropertyOptional({
        example: 2,
        description: "Muc gia trung binh 1-4",
        type: Number,
        nullable: true,
    })
    price_range: number | null;

    @ApiPropertyOptional({
        example: "https://res.cloudinary.com/demo/image/upload/v1/restaurants/logo.jpg",
        description: "URL logo",
        type: String,
        nullable: true,
    })
    logo_url: string | null;

    @ApiPropertyOptional({
        example: "https://res.cloudinary.com/demo/image/upload/v1/restaurants/cover.jpg",
        description: "URL anh bia",
        type: String,
        nullable: true,
    })
    cover_image_url: string | null;

    @ApiProperty({
        type: [String],
        example: [
            "https://res.cloudinary.com/demo/image/upload/v1/restaurants/gallery-1.jpg",
            "https://res.cloudinary.com/demo/image/upload/v1/restaurants/gallery-2.jpg",
        ],
        description: "Danh sach anh gallery",
    })
    gallery_urls: string[];

    @ApiProperty({ example: "123 Nguyen Hue, Quan 1", description: "Dia chi", type: String })
    address: string;

    @ApiProperty({ example: "Ho Chi Minh", description: "Thanh pho", type: String })
    city: string;

    @ApiPropertyOptional({ example: "Quan 1", description: "Quan/Huyen", type: String, nullable: true })
    district: string | null;

    @ApiPropertyOptional({ example: "Ben Nghe", description: "Phuong/Xa", type: String, nullable: true })
    ward: string | null;

    @ApiPropertyOptional({ example: 10.7769, description: "Vi do", type: Number, nullable: true })
    latitude: number | null;

    @ApiPropertyOptional({ example: 106.7009, description: "Kinh do", type: Number, nullable: true })
    longitude: number | null;

    @ApiProperty({ type: () => PublicRestaurantLocationDto, description: "Du lieu vi tri GeoJSON" })
    location: PublicRestaurantLocationDto;

    @ApiPropertyOptional({
        example: "+84901234567",
        description: "So dien thoai lien he",
        type: String,
        nullable: true,
    })
    phone: string | null;

    @ApiPropertyOptional({
        example: "contact@bepnhaviet.vn",
        description: "Email lien he",
        type: String,
        nullable: true,
    })
    email: string | null;

    @ApiPropertyOptional({
        example: "https://bepnhaviet.vn",
        description: "Website nha hang",
        type: String,
        nullable: true,
    })
    website: string | null;

    @ApiProperty({ type: () => PublicOperatingHoursDto, description: "Gio hoat dong theo ngay" })
    operating_hours: PublicOperatingHoursDto;

    @ApiProperty({ example: "Asia/Ho_Chi_Minh", description: "Mui gio", type: String })
    timezone: string;

    @ApiProperty({ example: "VND", description: "Don vi tien te", type: String })
    currency: string;

    @ApiProperty({ example: 0.1, description: "Thue suat", type: Number })
    tax_rate: number;

    @ApiProperty({ example: 0.01, description: "Ti le phu thu dich vu", type: Number })
    service_charge_rate: number;

    @ApiProperty({ example: true, description: "Trang thai xuat ban", type: Boolean })
    is_published: boolean;

    @ApiProperty({ example: true, description: "Nha hang co nhan don online", type: Boolean })
    accepts_online_orders: boolean;

    @ApiPropertyOptional({
        example: null,
        description: "Thoi diem soft delete",
        type: String,
        nullable: true,
        format: "date-time",
    })
    deleted_at: string | null;
}

export class PublicMenuCategoryItemDto {
    @ApiProperty({ example: "664f1a2b3c4d5e6f7a8b9201", description: "ObjectId mon an", type: String })
    _id: string;

    @ApiProperty({ example: "Pho Bo Tai", description: "Ten mon an", type: String })
    name: string;

    @ApiPropertyOptional({
        example: "Nuoc dung trong, banh pho tuoi",
        description: "Mo ta mon an",
        type: String,
        nullable: true,
    })
    description: string | null;

    @ApiProperty({ example: 79000, description: "Gia co ban", type: Number })
    base_price: number;

    @ApiProperty({ type: () => [MenuItemImageResponseDto], description: "Danh sach anh" })
    images: MenuItemImageResponseDto[];

    @ApiProperty({ example: false, description: "Mon noi bat hay khong", type: Boolean })
    is_featured: boolean;

    @ApiProperty({ example: 0, description: "Thu tu hien thi mon trong danh muc", type: Number })
    sort_order: number;
}

export class PublicMenuCategoryDto {
    @ApiProperty({ example: "Mon Viet Truyen Thong", description: "Ten danh muc", type: String })
    name: string;

    @ApiPropertyOptional({
        example: "Cac mon an truyen thong",
        description: "Mo ta danh muc",
        type: String,
        nullable: true,
    })
    description: string | null;

    @ApiPropertyOptional({
        example: "https://res.cloudinary.com/demo/image/upload/v1/menu/category-viet.jpg",
        description: "Anh dai dien danh muc",
        type: String,
        nullable: true,
    })
    image_url: string | null;

    @ApiProperty({ example: true, description: "Trang thai hien thi danh muc", type: Boolean })
    is_active: boolean;

    @ApiProperty({ type: () => [PublicMenuCategoryItemDto], description: "Danh sach mon trong danh muc" })
    items: PublicMenuCategoryItemDto[];
}

export class PublicMenuBySlugResponseDto {
    @ApiProperty({ type: () => PublicMenuRestaurantDto, description: "Thong tin nha hang" })
    restaurant: PublicMenuRestaurantDto;

    @ApiProperty({ type: () => [PublicMenuCategoryDto], description: "Danh sach danh muc va mon an public" })
    categories: PublicMenuCategoryDto[];
}

export class PublicMenuSearchCategoryDto {
    @ApiProperty({ example: "664f1a2b3c4d5e6f7a8b9101", description: "ObjectId danh muc", type: String })
    _id: string;

    @ApiProperty({ example: "Mon Nuoc", description: "Ten danh muc", type: String })
    name: string;
}

export class PublicMenuSearchItemDto {
    @ApiProperty({ example: "664f1a2b3c4d5e6f7a8b9201", description: "ObjectId mon an", type: String })
    _id: string;

    @ApiProperty({ example: "Pho Bo Tai", description: "Ten mon an", type: String })
    name: string;

    @ApiPropertyOptional({
        example: "Nuoc dung trong, banh pho tuoi",
        description: "Mo ta mon an",
        type: String,
        nullable: true,
    })
    description: string | null;

    @ApiProperty({ example: 79000, description: "Gia co ban", type: Number })
    base_price: number;

    @ApiProperty({ example: false, description: "Danh dau mon noi bat", type: Boolean })
    is_featured: boolean;

    @ApiProperty({ type: () => [MenuItemImageResponseDto], description: "Danh sach anh mon an" })
    images: MenuItemImageResponseDto[];

    @ApiProperty({ type: () => PublicMenuSearchCategoryDto, description: "Thong tin danh muc cua mon" })
    category: PublicMenuSearchCategoryDto;

    @ApiProperty({ example: 12.843, description: "Diem text score cua full-text search", type: Number })
    score: number;
}

export class PublicMenuSearchResponseDto {
    @ApiProperty({ example: "pho", description: "Tu khoa tim kiem", type: String })
    query: string;

    @ApiProperty({ type: () => [PublicMenuSearchItemDto], description: "Danh sach mon an khop ket qua" })
    data: PublicMenuSearchItemDto[];

    @ApiProperty({ type: () => MenuPaginationMetaDto, description: "Thong tin phan trang" })
    pagination: MenuPaginationMetaDto;
}
