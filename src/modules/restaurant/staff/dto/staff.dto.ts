import {
    ApiProperty,
    ApiPropertyOptional,
    OmitType,
    PartialType,
    PickType,
} from "@nestjs/swagger";
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
import { StaffPosition, StaffStatus } from "../schemas/staff.schema";

export class ListStaffQuery extends PartialType(
    PickType(CreateStaffDto, ['position', 'status'] as const),
) {
    @ApiPropertyOptional({
        example: 1,
        description: "Trang hiện tại (bắt đầu từ 1)",
        type: Number,
        minimum: 1,
        default: 1,
    })
    @IsInt()
    @Type(() => Number)
    @Min(1, { message: 'Page phải từ 1 trở lên' })
    page: number = 1;

    @ApiPropertyOptional({
        example: 50,
        description: "Số nhân viên trên một trang",
        type: Number,
        minimum: 1,
        maximum: 100,
        default: 50,
    })
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

    @ApiProperty({
        enum: StaffStatus,
        example: StaffStatus.ON_LEAVE,
        description: "Trạng thái mới của nhân viên",
    })
    @IsEnum(StaffStatus, { message: "Trạng thái nhân viên không hợp lệ" })
    status: StaffStatus;

    @ApiPropertyOptional({
        example: "Nghỉ phép theo lịch",
        description: "Lý do thay đổi trạng thái",
        type: String,
    })
    @IsOptional()
    @IsString()
    reason?: string;
}

export class UpdateStaffPermissionsDto {    
    @ApiPropertyOptional({
        example: true,
        description: "Cho phép áp dụng giảm giá",
        type: Boolean,
    })
    @IsOptional()
    @IsBoolean()
    can_discount?: boolean;

    @ApiPropertyOptional({
        example: false,
        description: "Cho phép hủy đơn hàng",
        type: Boolean,
    })
    @IsOptional()
    @IsBoolean()
    can_cancel_order?: boolean;

    @ApiPropertyOptional({
        example: true,
        description: "Cho phép xử lý thanh toán",
        type: Boolean,
    })
    @IsOptional()
    @IsBoolean()
    can_process_payment?: boolean;

    @ApiPropertyOptional({
        example: false,
        description: "Cho phép hoàn tiền",
        type: Boolean,
    })
    @IsOptional()
    @IsBoolean()
    can_refund?: boolean;

    @ApiPropertyOptional({
        example: true,
        description: "Cho phép xem báo cáo",
        type: Boolean,
    })
    @IsOptional()
    @IsBoolean()
    can_view_reports?: boolean;

    @ApiPropertyOptional({
        example: true,
        description: "Cho phép quản lý bàn",
        type: Boolean,
    })
    @IsOptional()
    @IsBoolean()
    can_manage_tables?: boolean;

    @ApiPropertyOptional({
        example: false,
        description: "Cho phép quản lý menu",
        type: Boolean,
    })
    @IsOptional()
    @IsBoolean()
    can_manage_menu?: boolean;
}

export class CreateStaffPayloadDto extends CreateStaffDto {
    @ApiProperty({
        example: "664f1a2b3c4d5e6f7a8b9c0d",
        description: "ObjectId tài khoản user được liên kết với staff",
        type: String,
    })
    @IsMongoId({ message: "user_id phải là ObjectId hợp lệ" })
    user_id: string;
}

export class UpdateStaffLinkAccountDto {
    @ApiProperty({
        example: "664f1a2b3c4d5e6f7a8b9c1e",
        description: "ObjectId user mới cần liên kết",
        type: String,
    })
    @IsMongoId({ message: "user_id phải là ObjectId hợp lệ" })
    user_id: string;
}

export class UpdateStaffAvatarDto {
    @ApiProperty({
        example: "https://res.cloudinary.com/demo/image/upload/v1/staff/avatar.webp",
        description: "HTTPS URL ảnh đại diện với đuôi jpg/jpeg/png/webp",
        type: String,
    })
    @IsString()
    @IsUrl({}, { message: "avatar_url phải là một URL hợp lệ" })
    @Matches(/^https:\/\//i, { message: "avatar_url phải sử dụng HTTPS" })
    @Matches(/\.(jpg|jpeg|png|webp)$/i, {
        message: "URL phải trỏ đến một định dạng ảnh hợp lệ (jpg, png, webp...)",
    })
    avatar_url: string;
}

export class StaffPermissionsResponseDto {
    @ApiProperty({ example: false, description: "Cho phép giảm giá", type: Boolean })
    can_discount: boolean;

    @ApiProperty({ example: false, description: "Cho phép hủy đơn", type: Boolean })
    can_cancel_order: boolean;

    @ApiProperty({ example: false, description: "Cho phép xử lý thanh toán", type: Boolean })
    can_process_payment: boolean;

    @ApiProperty({ example: false, description: "Cho phép hoàn tiền", type: Boolean })
    can_refund: boolean;

    @ApiProperty({ example: false, description: "Cho phép xem báo cáo", type: Boolean })
    can_view_reports: boolean;

    @ApiProperty({ example: false, description: "Cho phép quản lý bàn", type: Boolean })
    can_manage_tables: boolean;

    @ApiProperty({ example: false, description: "Cho phép quản lý menu", type: Boolean })
    can_manage_menu: boolean;
}

export class StaffCreateResponseDto {
    @ApiProperty({ example: "664f1a2b3c4d5e6f7a8b9c2f", description: "ID staff", type: String })
    id: string;

    @ApiProperty({ example: "NV001", description: "Mã nhân viên", type: String })
    employee_code: string;

    @ApiProperty({ example: "Nguyen Van A", description: "Tên nhân viên", type: String })
    full_name: string;

    @ApiProperty({ enum: StaffPosition, example: StaffPosition.WAITER, description: "Vị trí nhân viên" })
    position: StaffPosition;

    @ApiProperty({
        example: "2025-12-01T00:00:00.000Z",
        description: "Ngày vào làm",
        type: String,
        format: "date-time",
    })
    hire_date: string;

    @ApiProperty({ enum: StaffStatus, example: StaffStatus.ACTIVE, description: "Trạng thái" })
    status: StaffStatus;

    @ApiProperty({ example: "664f1a2b3c4d5e6f7a8b9c0d", description: "ID user liên kết", type: String })
    user_id: string;

    @ApiProperty({
        example: "2026-04-17T07:15:00.000Z",
        description: "Thời điểm tạo staff",
        type: String,
        format: "date-time",
    })
    created_at: string;
}

export class StaffListItemResponseDto {
    @ApiProperty({ example: "664f1a2b3c4d5e6f7a8b9c2f", description: "ID staff", type: String })
    id: string;

    @ApiProperty({ example: "NV001", description: "Mã nhân viên", type: String })
    employee_code: string;

    @ApiProperty({ example: "Nguyen Van A", description: "Tên nhân viên", type: String })
    full_name: string;

    @ApiProperty({ enum: StaffPosition, example: StaffPosition.WAITER, description: "Vị trí nhân viên" })
    position: StaffPosition;

    @ApiProperty({ enum: StaffStatus, example: StaffStatus.ACTIVE, description: "Trạng thái" })
    status: StaffStatus;

    @ApiProperty({
        example: "2025-12-01T00:00:00.000Z",
        description: "Ngày vào làm",
        type: String,
        format: "date-time",
    })
    hire_date: string;

    @ApiPropertyOptional({
        example: "https://res.cloudinary.com/demo/image/upload/v1/staff/avatar.webp",
        description: "Ảnh đại diện",
        nullable: true,
        type: String,
    })
    avatar_url: string | null;

    @ApiProperty({ example: "664f1a2b3c4d5e6f7a8b9c0d", description: "ID user liên kết", type: String })
    user_id: string;

    @ApiProperty({
        example: "2026-04-17T07:15:00.000Z",
        description: "Thời điểm tạo staff",
        type: String,
        format: "date-time",
    })
    created_at: string;
}

export class StaffListPaginationMetaDto {
    @ApiProperty({ example: 1, description: "Trang hiện tại", type: Number })
    page: number;

    @ApiProperty({ example: 50, description: "Số bản ghi trên trang", type: Number })
    limit: number;

    @ApiProperty({ example: 120, description: "Tổng số nhân viên", type: Number })
    total: number;

    @ApiProperty({ example: 3, description: "Tổng số trang", type: Number })
    total_pages: number;
}

export class ListStaffResponseDto {
    @ApiProperty({
        type: () => [StaffListItemResponseDto],
        description: "Danh sách nhân viên",
    })
    data: StaffListItemResponseDto[];

    @ApiProperty({ type: () => StaffListPaginationMetaDto, description: "Thông tin phân trang" })
    pagination: StaffListPaginationMetaDto;
}

export class StaffDetailWithoutPermissionsResponseDto {
    @ApiProperty({ example: "664f1a2b3c4d5e6f7a8b9c2f", description: "ObjectId staff", type: String })
    _id: string;

    @ApiProperty({ example: "664f1a2b3c4d5e6f7a8b9c9a", description: "ObjectId nhà hàng", type: String })
    restaurant_id: string;

    @ApiProperty({ example: "664f1a2b3c4d5e6f7a8b9c0d", description: "ObjectId user liên kết", type: String })
    user_id: string;

    @ApiProperty({ example: "NV001", description: "Mã nhân viên", type: String })
    employee_code: string;

    @ApiProperty({ example: "Nguyen Van A", description: "Tên nhân viên", type: String })
    full_name: string;

    @ApiPropertyOptional({ example: "+84901234567", description: "Số điện thoại", nullable: true, type: String })
    phone: string | null;

    @ApiPropertyOptional({ example: "staff@restaurant.vn", description: "Email", nullable: true, type: String })
    email: string | null;

    @ApiProperty({ enum: StaffPosition, example: StaffPosition.WAITER, description: "Vị trí" })
    position: StaffPosition;

    @ApiProperty({
        example: "2025-12-01T00:00:00.000Z",
        description: "Ngày vào làm",
        type: String,
        format: "date-time",
    })
    hire_date: string;

    @ApiPropertyOptional({
        example: "https://res.cloudinary.com/demo/image/upload/v1/staff/avatar.webp",
        description: "Ảnh đại diện",
        nullable: true,
        type: String,
    })
    avatar_url: string | null;

    @ApiProperty({ enum: StaffStatus, example: StaffStatus.ACTIVE, description: "Trạng thái" })
    status: StaffStatus;

    @ApiPropertyOptional({
        example: null,
        description: "Thời điểm soft delete, null nếu chưa xóa",
        nullable: true,
        type: String,
        format: "date-time",
    })
    deleted_at: string | null;

    @ApiProperty({
        example: "2026-04-17T07:15:00.000Z",
        description: "Thời điểm tạo",
        type: String,
        format: "date-time",
    })
    created_at: string;

    @ApiProperty({
        example: "2026-04-17T07:15:00.000Z",
        description: "Thời điểm cập nhật gần nhất",
        type: String,
        format: "date-time",
    })
    updated_at: string;
}

export class StaffDetailWithPermissionsResponseDto extends StaffDetailWithoutPermissionsResponseDto {
    @ApiProperty({
        type: () => StaffPermissionsResponseDto,
        description: "Bộ quyền của nhân viên",
    })
    permissions: StaffPermissionsResponseDto;
}

export class UpdatedStaffDetailResponseDto {
    @ApiProperty({ example: "664f1a2b3c4d5e6f7a8b9c2f", description: "ID staff", type: String })
    id: string;

    @ApiProperty({ example: "NV001", description: "Mã nhân viên", type: String })
    employee_code: string;

    @ApiProperty({ example: "Nguyen Van A", description: "Tên nhân viên", type: String })
    full_name: string;

    @ApiPropertyOptional({ example: "+84901234567", description: "Số điện thoại", nullable: true, type: String })
    phone: string | null;

    @ApiPropertyOptional({ example: "staff@restaurant.vn", description: "Email", nullable: true, type: String })
    email: string | null;

    @ApiProperty({ enum: StaffPosition, example: StaffPosition.WAITER, description: "Vị trí" })
    position: StaffPosition;

    @ApiProperty({
        example: "2025-12-01T00:00:00.000Z",
        description: "Ngày vào làm",
        type: String,
        format: "date-time",
    })
    hire_date: string;

    @ApiPropertyOptional({
        example: "https://res.cloudinary.com/demo/image/upload/v1/staff/avatar.webp",
        description: "Ảnh đại diện",
        nullable: true,
        type: String,
    })
    avatar_url: string | null;

    @ApiProperty({ enum: StaffStatus, example: StaffStatus.ACTIVE, description: "Trạng thái" })
    status: StaffStatus;

    @ApiProperty({ example: "664f1a2b3c4d5e6f7a8b9c0d", description: "ID user liên kết", type: String })
    user_id: string;

    @ApiProperty({
        example: "2026-04-17T07:15:00.000Z",
        description: "Thời điểm tạo",
        type: String,
        format: "date-time",
    })
    created_at: string;

    @ApiProperty({
        example: "2026-04-17T07:15:00.000Z",
        description: "Thời điểm cập nhật",
        type: String,
        format: "date-time",
    })
    updated_at: string;

    @ApiProperty({
        type: () => StaffPermissionsResponseDto,
        description: "Bộ quyền của nhân viên",
    })
    permissions: StaffPermissionsResponseDto;
}

export class UpdateStaffInfoResponseDto {
    @ApiProperty({ example: true, description: "Đánh dấu cập nhật thành công", type: Boolean })
    updated: boolean;

    @ApiProperty({ type: () => UpdatedStaffDetailResponseDto, description: "Thông tin staff sau cập nhật" })
    staff: UpdatedStaffDetailResponseDto;
}

export class UpdateStaffStatusResponseDto {
    @ApiProperty({
        example: false,
        description: "true nếu trạng thái không đổi so với hiện tại",
        type: Boolean,
    })
    unchanged: boolean;

    @ApiProperty({ enum: StaffStatus, example: StaffStatus.INACTIVE, description: "Trạng thái hiện tại" })
    status: StaffStatus;

    @ApiProperty({
        type: [String],
        example: ["Đang phụ trách 2 đơn hàng active"],
        description: "Danh sách cảnh báo nghiệp vụ",
    })
    warnings: string[];
}

export class LinkStaffAccountResponseDto {
    @ApiProperty({ example: true, description: "Đánh dấu liên kết thành công", type: Boolean })
    linked: boolean;

    @ApiProperty({ example: "664f1a2b3c4d5e6f7a8b9c1e", description: "User id đã liên kết", type: String })
    user_id: string;
}

export class UpdateStaffPermissionsResponseDto {
    @ApiProperty({ example: true, description: "Đánh dấu cập nhật quyền thành công", type: Boolean })
    updated: boolean;

    @ApiProperty({ type: () => StaffPermissionsResponseDto, description: "Bộ quyền sau cập nhật" })
    permissions: StaffPermissionsResponseDto;
}

export class UpdateStaffAvatarResponseDto {
    @ApiPropertyOptional({
        example: "https://res.cloudinary.com/demo/image/upload/v1/staff/avatar.webp",
        description: "Avatar hiện tại sau cập nhật",
        nullable: true,
        type: String,
    })
    avatar_url: string | null;
}

export class DeleteStaffResponseDto {
    @ApiProperty({ example: true, description: "Đánh dấu xóa mềm thành công", type: Boolean })
    deleted: boolean;
}

export class StaffDetailMaskedResponseDto extends OmitType(
    StaffDetailWithPermissionsResponseDto,
    ["permissions"] as const,
) {}
