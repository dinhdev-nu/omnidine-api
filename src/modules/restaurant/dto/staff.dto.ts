import { PartialType, PickType } from "@nestjs/mapped-types";
import { Type } from "class-transformer";
import {
    IsInt,
    Min,
    Max,
    IsOptional,
    IsEnum,
    IsString,
    IsBoolean,
    IsMongoId,
    IsUrl,
    Matches,
} from "class-validator";
import { CreateStaffDto } from "./create-staff.dto";
import { StaffStatus } from "../schemas/staff.schema.xxx";

export class ListStaffQuery extends PartialType(
    PickType(CreateStaffDto, ['position', 'status'] as const),
) {
    @IsInt()
    @Type(() => Number)
    @Min(1, { message: 'Page phải từ 1 trở lên' })
    page: number = 1;
    @IsInt()
    @Type(() => Number)
    @Min(1, { message: 'Limit phải từ 1 trở lên' })
    @Max(100, { message: 'Limit phải nhỏ hơn hoặc bằng 100' })
    limit: number = 50;
}

export class UpdateStaffDto extends PartialType(
    PickType(CreateStaffDto, [
        'full_name',
        'position',
        'hire_date',
        'phone',
        'email',
    ] as const),
) {}

export class UpdateStaffStatusDto {

    @IsEnum(StaffStatus, { message: "Trạng thái nhân viên không hợp lệ" })
    status: StaffStatus;

    @IsOptional()
    @IsString()
    reason?: string;
}

export class UpdateStaffPermissionsDto {    
    @IsOptional()
    @IsBoolean()
    can_discount?: boolean;

    @IsOptional()
    @IsBoolean()
    can_cancel_order?: boolean;

    @IsOptional()
    @IsBoolean()
    can_refund?: boolean;

    @IsOptional()
    @IsBoolean()
    can_view_reports?: boolean;

    @IsOptional()
    @IsBoolean()
    can_manage_tables?: boolean;

    @IsOptional()
    @IsBoolean()
    can_manage_menu?: boolean;
}

export class CreateStaffPayloadDto extends CreateStaffDto {
    @IsMongoId({ message: "user_id phải là ObjectId hợp lệ" })
    user_id: string;
}

export class UpdateStaffLinkAccountDto {
    @IsMongoId({ message: "user_id phải là ObjectId hợp lệ" })
    user_id: string;
}

export class UpdateStaffAvatarDto {
    @IsString()
    @IsUrl({}, { message: "avatar_url phải là một URL hợp lệ" })
    @Matches(/^https:\/\//i, { message: "avatar_url phải sử dụng HTTPS" })
    @Matches(/\.(jpg|jpeg|png|webp)$/i, {
        message: "URL phải trỏ đến một định dạng ảnh hợp lệ (jpg, png, webp...)",
    })
    avatar_url: string;
}
