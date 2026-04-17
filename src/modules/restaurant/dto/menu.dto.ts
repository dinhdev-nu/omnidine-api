import { PartialType, PickType } from "@nestjs/mapped-types";
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
    @IsString()
    @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
    @MinLength(1, { message: "name khong duoc de trong" })
    @MaxLength(150, { message: "name toi da 150 ky tu" })
    name: string;

    @IsOptional()
    @IsString()
    @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
    description?: string | null;

    @IsOptional()
    @IsString()
    @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
    @Matches(IMAGE_URL_REGEX, {
        message: "image_url phai la HTTPS va co extension jpg/jpeg/png/webp",
    })
    image_url?: string | null;

    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: "sort_order phai la so nguyen" })
    @Min(0, { message: "sort_order phai >= 0" })
    sort_order?: number;
}

export class ListMenuCategoryQueryDto {
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
    @IsBoolean({ message: "is_active phai la boolean" })
    is_active: boolean;
}

export class ReorderMenuCategoriesDto {
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
    @Transform(({ value }) => (value instanceof Types.ObjectId ? value.toString() : value))
    @IsMongoId({ message: "category_id khong hop le" })
    category_id: Types.ObjectId;

    @IsString()
    @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
    @MinLength(1, { message: "name khong duoc de trong" })
    @MaxLength(200, { message: "name toi da 200 ky tu" })
    name: string;

    @IsOptional()
    @IsString()
    @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
    description?: string | null;

    @Type(() => Number)
    @IsNumber({}, { message: "base_price phai la so" })
    @Min(0, { message: "base_price phai >= 0" })
    base_price: number;

    @IsOptional()
    @Transform(({ value }) => {
        if (value === true || value === "true") return true;
        if (value === false || value === "false") return false;
        return value;
    })
    @IsBoolean({ message: "is_available phai la boolean" })
    is_available?: boolean;

    @IsOptional()
    @Transform(({ value }) => {
        if (value === true || value === "true") return true;
        if (value === false || value === "false") return false;
        return value;
    })
    @IsBoolean({ message: "is_featured phai la boolean" })
    is_featured?: boolean;

    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: "sort_order phai la so nguyen" })
    @Min(0, { message: "sort_order phai >= 0" })
    sort_order?: number;
}

export class ListMenuItemsQueryDto {
    @IsOptional()
    @Transform(({ value }) => (value instanceof Types.ObjectId ? value.toString() : value))
    @IsMongoId({ message: "category_id khong hop le" })
    category_id?: string | Types.ObjectId;

    @IsOptional()
    @Transform(({ value }) => {
        if (value === true || value === "true") return true;
        if (value === false || value === "false") return false;
        return value;
    })
    @IsBoolean({ message: "is_available phai la boolean" })
    is_available?: boolean;

    @IsOptional()
    @Transform(({ value }) => {
        if (value === true || value === "true") return true;
        if (value === false || value === "false") return false;
        return value;
    })
    @IsBoolean({ message: "is_featured phai la boolean" })
    is_featured?: boolean;

    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: "page phai la so nguyen" })
    @Min(1, { message: "page phai >= 1" })
    page?: number = 1;

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
    @Transform(({ value }) => {
        if (value === true || value === "true") return true;
        if (value === false || value === "false") return false;
        return value;
    })
    @IsBoolean({ message: "is_available phai la boolean" })
    is_available: boolean;
}

export class ToggleMenuItemFeaturedDto {
    @Transform(({ value }) => {
        if (value === true || value === "true") return true;
        if (value === false || value === "false") return false;
        return value;
    })
    @IsBoolean({ message: "is_featured phai la boolean" })
    is_featured: boolean;
}

export class AddMenuItemImageDto {
    @IsString()
    @IsUrl({}, { message: "url phai la URL hop le" })
    @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
    @Matches(IMAGE_URL_REGEX, {
        message: "url phai la HTTPS va co extension jpg/jpeg/png/webp",
    })
    url: string;

    @IsOptional()
    @IsString()
    @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
    @MaxLength(255, { message: "alt toi da 255 ky tu" })
    alt?: string;
}

export class ReorderMenuItemsDto {
    @Transform(({ value }) => (value instanceof Types.ObjectId ? value.toString() : value))
    @IsMongoId({ message: "category_id khong hop le" })
    category_id: string | Types.ObjectId;

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
    @IsString()
    @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
    @MinLength(1, { message: "q khong duoc de trong" })
    @MaxLength(100, { message: "q toi da 100 ky tu" })
    q: string;

    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: "page phai la so nguyen" })
    @Min(1, { message: "page phai >= 1" })
    page?: number = 1;

    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: "limit phai la so nguyen" })
    @Min(1, { message: "limit phai >= 1" })
    @Max(50, { message: "limit phai <= 50" })
    limit?: number = 20;
}
