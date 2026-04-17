import {
    IsDateString,
    IsEmail,
    IsEnum,
    IsOptional,
    IsString,
    IsUrl,
    IsPhoneNumber,
    Matches,
    MaxLength,
    MinLength,
} from "class-validator";
import { StaffPosition, StaffStatus } from "../schemas/staff.schema.xxx";
import { Transform } from "class-transformer";

export class CreateStaffDto {

    @IsString()
    @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
    @MinLength(1)
    @MaxLength(30)
    employee_code: string;

    @IsString()
    @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
    @MinLength(1)
    @MaxLength(150)
    full_name: string;

    @IsEnum(StaffPosition, { message: "position phải là một vị trí hợp lệ" })
    position: StaffPosition;

    @IsDateString({}, { message: "hire_date phải là một chuỗi ngày tháng hợp lệ" })
    hire_date: string;

    @IsOptional()
    @IsString()
    @MaxLength(20)
    @IsPhoneNumber("VN", { message: "phone phải là một số điện thoại hợp lệ của Việt Nam" })
    phone?: string;

    @IsOptional()
    @IsEmail({}, { message: "email phải là một địa chỉ email hợp lệ" })
    email?: string;

    @IsOptional()
    @IsEnum(StaffStatus, { message: "trạng thái không hợp lệ" })
    status?: StaffStatus;

    @IsOptional()
    @IsString()
    @IsUrl({}, { message: "avatar_url phải là một URL hợp lệ" })
    @Matches(/\.(jpg|jpeg|png|webp)$/i, {
        message: "URL phải trỏ đến một định dạng ảnh hợp lệ (jpg, png, webp...)",
    })
    avatar_url?: string;
}
