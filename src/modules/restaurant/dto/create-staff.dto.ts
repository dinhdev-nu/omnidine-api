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
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateStaffDto {

    @ApiProperty({
        example: "NV001",
        description: "Mã nhân viên duy nhất trong phạm vi nhà hàng",
        type: String,
        minLength: 1,
        maxLength: 30,
    })
    @IsString()
    @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
    @MinLength(1)
    @MaxLength(30)
    employee_code: string;

    @ApiProperty({
        example: "Nguyen Van A",
        description: "Họ và tên đầy đủ của nhân viên",
        type: String,
        minLength: 1,
        maxLength: 150,
    })
    @IsString()
    @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
    @MinLength(1)
    @MaxLength(150)
    full_name: string;

    @ApiProperty({
        enum: StaffPosition,
        example: StaffPosition.WAITER,
        description: "Vị trí công việc của nhân viên",
    })
    @IsEnum(StaffPosition, { message: "position phải là một vị trí hợp lệ" })
    position: StaffPosition;

    @ApiProperty({
        example: "2025-12-01",
        description: "Ngày bắt đầu làm việc, định dạng ISO 8601",
        type: String,
        format: "date",
    })
    @IsDateString({}, { message: "hire_date phải là một chuỗi ngày tháng hợp lệ" })
    hire_date: string;

    @ApiPropertyOptional({
        example: "+84901234567",
        description: "Số điện thoại nhân viên (chuẩn VN)",
        type: String,
        maxLength: 20,
    })
    @IsOptional()
    @IsString()
    @MaxLength(20)
    @IsPhoneNumber("VN", { message: "phone phải là một số điện thoại hợp lệ của Việt Nam" })
    phone?: string;

    @ApiPropertyOptional({
        example: "staff@restaurant.vn",
        description: "Email liên hệ của nhân viên",
        type: String,
    })
    @IsOptional()
    @IsEmail({}, { message: "email phải là một địa chỉ email hợp lệ" })
    email?: string;

    @ApiPropertyOptional({
        enum: StaffStatus,
        example: StaffStatus.ACTIVE,
        description: "Trạng thái làm việc của nhân viên",
    })
    @IsOptional()
    @IsEnum(StaffStatus, { message: "trạng thái không hợp lệ" })
    status?: StaffStatus;

    @ApiPropertyOptional({
        example: "https://res.cloudinary.com/demo/image/upload/v1/staff/avatar.webp",
        description: "Đường dẫn ảnh đại diện của nhân viên",
        type: String,
    })
    @IsOptional()
    @IsString()
    @IsUrl({}, { message: "avatar_url phải là một URL hợp lệ" })
    @Matches(/\.(jpg|jpeg|png|webp)$/i, {
        message: "URL phải trỏ đến một định dạng ảnh hợp lệ (jpg, png, webp...)",
    })
    avatar_url?: string;
}
