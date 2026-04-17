import { PartialType, PickType } from "@nestjs/mapped-types";
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
    @IsString()
    @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
    @MinLength(1, { message: "table_number must not be empty" })
    @MaxLength(20, { message: "table_number must be at most 20 characters" })
    table_number: string;

    @Type(() => Number)
    @IsInt({ message: "capacity must be an integer" })
    @Min(1, { message: "capacity must be at least 1" })
    @Max(99, { message: "capacity must be at most 99" })
    capacity: number;

    @IsOptional()
    @IsString()
    @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
    @MinLength(1, { message: "name must not be empty" })
    @MaxLength(50, { message: "name must be at most 50 characters" })
    name?: string | null;

    @IsOptional()
    @IsString()
    @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
    @MaxLength(500, { message: "notes must be at most 500 characters" })
    notes?: string | null;
}

export class ListTablesQueryDto {
    @IsOptional()
    @IsEnum(TableStatus, { message: "status must be a valid table status" })
    status?: TableStatus;

    @IsOptional()
    @Transform(({ value }) => toBoolean(value))
    @IsBoolean({ message: "is_active must be a boolean" })
    is_active?: boolean;

    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: "capacity_min must be an integer" })
    @Min(1, { message: "capacity_min must be at least 1" })
    @Max(99, { message: "capacity_min must be at most 99" })
    capacity_min?: number;

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
    @IsEnum(TableStatus, { message: "status must be a valid table status" })
    status: TableStatus;
}
