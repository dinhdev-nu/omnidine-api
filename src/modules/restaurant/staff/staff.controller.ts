import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    Put,
    Query,
    Req,
} from "@nestjs/common";
import {
    ApiBadRequestResponse,
    ApiBearerAuth,
    ApiBody,
    ApiConflictResponse,
    ApiExtraModels,
    ApiForbiddenResponse,
    ApiInternalServerErrorResponse,
    ApiNotFoundResponse,
    ApiOkResponse,
    ApiOperation,
    ApiParam,
    ApiQuery,
    ApiTags,
    ApiTooManyRequestsResponse,
    ApiUnauthorizedResponse,
    getSchemaPath,
} from "@nestjs/swagger";
import { Request } from "express";
import { Types } from "mongoose";
import { RESTAURANT_ROLE, RestaurantRole } from "src/common/constants/restaurant-role.constant";
import { ROLE } from "src/common/constants/role.constant";
import {
    CurrentUser,
    RequireRestaurant,
    RestaurantRoles,
    Roles,
} from "src/common/decorators";
import { RESTAURANT_ROLE_INJECT } from "src/common/guards/restaurant-auth.guard";
import { ParseObjectIdPipe } from "src/common/pipes/parse-id.pipe";
import { AccessTokenPayload } from "src/modules/auth/auth.service";
import { CreateStaffDto } from "./dto/create-staff.dto";
import {
    CreateStaffPayloadDto,
    DeleteStaffResponseDto,
    LinkStaffAccountResponseDto,
    ListStaffQuery,
    ListStaffResponseDto,
    StaffCreateResponseDto,
    StaffDetailMaskedResponseDto,
    StaffDetailWithPermissionsResponseDto,
    UpdateStaffAvatarDto,
    UpdateStaffAvatarResponseDto,
    UpdateStaffDto,
    UpdateStaffInfoResponseDto,
    UpdateStaffLinkAccountDto,
    UpdateStaffPermissionsDto,
    UpdateStaffPermissionsResponseDto,
    UpdateStaffStatusDto,
    UpdateStaffStatusResponseDto,
} from "./dto/staff.dto";
import { swWrap } from "src/common/swagger/api-response.util";
import { StaffService } from "./staff.service";

@ApiTags("staff")
@ApiBearerAuth()
@ApiExtraModels(
    StaffCreateResponseDto,
    ListStaffResponseDto,
    StaffDetailWithPermissionsResponseDto,
    StaffDetailMaskedResponseDto,
    UpdateStaffInfoResponseDto,
    UpdateStaffStatusResponseDto,
    LinkStaffAccountResponseDto,
    UpdateStaffPermissionsResponseDto,
    UpdateStaffAvatarResponseDto,
    DeleteStaffResponseDto,
)
@Controller("restaurants/:id/staff")
@Roles(ROLE.ADMIN, ROLE.USER)
export class StaffController {

    constructor(
        private readonly staffService: StaffService,
    ) {}

    @ApiOperation({
        summary: "Tạo nhân viên mới",
        description: "Tạo hồ sơ staff mới và liên kết với user_id trong cùng nhà hàng.",
    })
    @ApiParam({
        name: "id",
        type: String,
        example: "664f1a2b3c4d5e6f7a8b9c9a",
        description: "ObjectId của nhà hàng",
    })
    @ApiBody({ type: CreateStaffPayloadDto })
    @ApiOkResponse({
        description: "Tạo staff thành công",
        schema: swWrap({ $ref: getSchemaPath(StaffCreateResponseDto) }),
    })
    @ApiBadRequestResponse({ description: "Payload không hợp lệ, hire_date sai hoặc id không phải ObjectId." })
    @ApiNotFoundResponse({ description: "Không tìm thấy user liên kết hoặc nhà hàng." })
    @ApiConflictResponse({ description: "employee_code trùng hoặc user đã liên kết với staff khác." })
    @ApiTooManyRequestsResponse({ description: "Vượt giới hạn thao tác ghi staff trong 1 phút." })
    @ApiUnauthorizedResponse({ description: "Thiếu hoặc sai Bearer token." })
    @ApiForbiddenResponse({ description: "Không có quyền tạo staff cho nhà hàng này." })
    @ApiInternalServerErrorResponse({ description: "Lỗi nội bộ máy chủ." })
    @Post()
    @RestaurantRoles(RESTAURANT_ROLE.OWNER)
    async createStaff(
        @Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
        @Body() payload: CreateStaffPayloadDto,
    ) {
        const dto: CreateStaffDto = {
            employee_code: payload.employee_code,
            full_name: payload.full_name,
            position: payload.position,
            hire_date: payload.hire_date,
            phone: payload.phone,
            email: payload.email,
            status: payload.status,
            avatar_url: payload.avatar_url,
        };

        return this.staffService.createStaff(
            restaurantId,
            this.toObjectId(payload.user_id),
            dto,
        );
    }

    @ApiOperation({
        summary: "Lấy danh sách nhân viên",
        description: "Lấy danh sách staff theo nhà hàng, hỗ trợ lọc status, position và phân trang.",
    })
    @ApiParam({
        name: "id",
        type: String,
        example: "664f1a2b3c4d5e6f7a8b9c9a",
        description: "ObjectId của nhà hàng",
    })
    @ApiQuery({ name: "status", required: false, description: "Lọc theo trạng thái", enum: ["active", "inactive", "on_leave", "terminated"] })
    @ApiQuery({ name: "position", required: false, description: "Lọc theo vị trí", enum: ["manager", "cashier", "waiter", "kitchen", "delivery"] })
    @ApiQuery({ name: "page", required: false, type: Number, example: 1, description: "Trang hiện tại, >= 1" })
    @ApiQuery({ name: "limit", required: false, type: Number, example: 50, description: "Số lượng mỗi trang, 1-100" })
    @ApiOkResponse({
        description: "Danh sách staff",
        schema: swWrap({ $ref: getSchemaPath(ListStaffResponseDto) }),
    })
    @ApiBadRequestResponse({ description: "Query không hợp lệ hoặc id không phải ObjectId." })
    @ApiNotFoundResponse({ description: "Không tìm thấy nhà hàng." })
    @ApiUnauthorizedResponse({ description: "Thiếu hoặc sai Bearer token." })
    @ApiForbiddenResponse({ description: "Không có quyền truy cập staff của nhà hàng này." })
    @ApiInternalServerErrorResponse({ description: "Lỗi nội bộ máy chủ." })
    @Get()
    @RequireRestaurant()
    async listStaffs(
        @Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
        @Query() query: ListStaffQuery,
    ) {
        return this.staffService.listStaffs(restaurantId, query);
    }

    @ApiOperation({
        summary: "Lấy chi tiết nhân viên",
        description: "Owner/Admin thấy đầy đủ permissions. Staff chỉ thấy permissions khi xem chính mình.",
    })
    @ApiParam({
        name: "id",
        type: String,
        example: "664f1a2b3c4d5e6f7a8b9c9a",
        description: "ObjectId của nhà hàng",
    })
    @ApiParam({
        name: "staff_id",
        type: String,
        example: "664f1a2b3c4d5e6f7a8b9c2f",
        description: "ObjectId của staff",
    })
    @ApiOkResponse({
        description: "Chi tiết staff theo vai trò requester",
        schema: swWrap({
            oneOf: [
                { $ref: getSchemaPath(StaffDetailWithPermissionsResponseDto) },
                { $ref: getSchemaPath(StaffDetailMaskedResponseDto) },
            ],
        }),
    })
    @ApiBadRequestResponse({ description: "id hoặc staff_id không hợp lệ." })
    @ApiNotFoundResponse({ description: "Không tìm thấy staff hoặc nhà hàng." })
    @ApiUnauthorizedResponse({ description: "Thiếu hoặc sai Bearer token." })
    @ApiForbiddenResponse({ description: "Không có quyền truy cập thông tin staff này." })
    @ApiInternalServerErrorResponse({ description: "Lỗi nội bộ máy chủ." })
    @Get(":staff_id")
    @RequireRestaurant()
    async getStaffDetail(
        @Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
        @Param("staff_id", ParseObjectIdPipe) staffId: Types.ObjectId,
        @CurrentUser() user: AccessTokenPayload,
        @Req() req: Request,
    ) {
        return this.staffService.getStaffDetail(restaurantId, staffId, {
            requesterRole: this.getRequesterRole(req),
            requesterUserId: this.toObjectId(user.sub),
        });
    }

    @ApiOperation({
        summary: "Cập nhật thông tin staff",
        description: "Cập nhật partial các trường hồ sơ cơ bản của staff.",
    })
    @ApiParam({
        name: "id",
        type: String,
        example: "664f1a2b3c4d5e6f7a8b9c9a",
        description: "ObjectId của nhà hàng",
    })
    @ApiParam({
        name: "staff_id",
        type: String,
        example: "664f1a2b3c4d5e6f7a8b9c2f",
        description: "ObjectId của staff",
    })
    @ApiBody({ type: UpdateStaffDto })
    @ApiOkResponse({
        description: "Cập nhật staff thành công",
        schema: swWrap({ $ref: getSchemaPath(UpdateStaffInfoResponseDto) }),
    })
    @ApiBadRequestResponse({ description: "Payload cập nhật không hợp lệ hoặc id không hợp lệ." })
    @ApiNotFoundResponse({ description: "Không tìm thấy staff hoặc nhà hàng." })
    @ApiTooManyRequestsResponse({ description: "Vượt giới hạn thao tác ghi staff trong 1 phút." })
    @ApiUnauthorizedResponse({ description: "Thiếu hoặc sai Bearer token." })
    @ApiForbiddenResponse({ description: "Không có quyền cập nhật staff." })
    @ApiInternalServerErrorResponse({ description: "Lỗi nội bộ máy chủ." })
    @Patch(":staff_id")
    @RestaurantRoles(RESTAURANT_ROLE.OWNER)
    async updateStaffInfo(
        @Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
        @Param("staff_id", ParseObjectIdPipe) staffId: Types.ObjectId,
        @Body() dto: UpdateStaffDto,
    ) {
        return this.staffService.updateStaffInfo(restaurantId, staffId, dto);
    }

    @ApiOperation({
        summary: "Cập nhật trạng thái staff",
        description: "Đổi trạng thái làm việc của nhân viên và trả về cảnh báo nếu có đơn active.",
    })
    @ApiParam({
        name: "id",
        type: String,
        example: "664f1a2b3c4d5e6f7a8b9c9a",
        description: "ObjectId của nhà hàng",
    })
    @ApiParam({
        name: "staff_id",
        type: String,
        example: "664f1a2b3c4d5e6f7a8b9c2f",
        description: "ObjectId của staff",
    })
    @ApiBody({ type: UpdateStaffStatusDto })
    @ApiOkResponse({
        description: "Cập nhật trạng thái thành công",
        schema: swWrap({ $ref: getSchemaPath(UpdateStaffStatusResponseDto) }),
    })
    @ApiBadRequestResponse({ description: "Payload trạng thái không hợp lệ hoặc id không hợp lệ." })
    @ApiNotFoundResponse({ description: "Không tìm thấy staff hoặc nhà hàng." })
    @ApiTooManyRequestsResponse({ description: "Vượt giới hạn thao tác ghi staff trong 1 phút." })
    @ApiUnauthorizedResponse({ description: "Thiếu hoặc sai Bearer token." })
    @ApiForbiddenResponse({ description: "Không có quyền cập nhật trạng thái staff." })
    @ApiInternalServerErrorResponse({ description: "Lỗi nội bộ máy chủ." })
    @Patch(":staff_id/status")
    @RestaurantRoles(RESTAURANT_ROLE.OWNER)
    async updateStaffStatus(
        @Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
        @Param("staff_id", ParseObjectIdPipe) staffId: Types.ObjectId,
        @Body() dto: UpdateStaffStatusDto,
    ) {
        return this.staffService.updateStaffStatus(restaurantId, staffId, dto);
    }

    @ApiOperation({
        summary: "Đổi tài khoản user liên kết",
        description: "Liên kết staff hiện tại với user_id mới trong cùng nhà hàng.",
    })
    @ApiParam({
        name: "id",
        type: String,
        example: "664f1a2b3c4d5e6f7a8b9c9a",
        description: "ObjectId của nhà hàng",
    })
    @ApiParam({
        name: "staff_id",
        type: String,
        example: "664f1a2b3c4d5e6f7a8b9c2f",
        description: "ObjectId của staff",
    })
    @ApiBody({ type: UpdateStaffLinkAccountDto })
    @ApiOkResponse({
        description: "Liên kết tài khoản thành công",
        schema: swWrap({ $ref: getSchemaPath(LinkStaffAccountResponseDto) }),
    })
    @ApiBadRequestResponse({ description: "Payload không hợp lệ hoặc id không hợp lệ." })
    @ApiNotFoundResponse({ description: "Không tìm thấy staff, nhà hàng hoặc user mới." })
    @ApiConflictResponse({ description: "User mới đã được liên kết với staff khác trong nhà hàng." })
    @ApiTooManyRequestsResponse({ description: "Vượt giới hạn thao tác ghi staff trong 1 phút." })
    @ApiUnauthorizedResponse({ description: "Thiếu hoặc sai Bearer token." })
    @ApiForbiddenResponse({ description: "Không có quyền đổi tài khoản staff." })
    @ApiInternalServerErrorResponse({ description: "Lỗi nội bộ máy chủ." })
    @Patch(":staff_id/link-account")
    @RestaurantRoles(RESTAURANT_ROLE.OWNER)
    async linkStaffAccount(
        @Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
        @Param("staff_id", ParseObjectIdPipe) staffId: Types.ObjectId,
        @Body() dto: UpdateStaffLinkAccountDto,
    ) {
        return this.staffService.linkAccount(
            restaurantId,
            staffId,
            this.toObjectId(dto.user_id),
        );
    }

    @ApiOperation({
        summary: "Cập nhật permissions staff",
        description: "Merge patch permissions cho staff theo danh sách key cho phép.",
    })
    @ApiParam({
        name: "id",
        type: String,
        example: "664f1a2b3c4d5e6f7a8b9c9a",
        description: "ObjectId của nhà hàng",
    })
    @ApiParam({
        name: "staff_id",
        type: String,
        example: "664f1a2b3c4d5e6f7a8b9c2f",
        description: "ObjectId của staff",
    })
    @ApiBody({ type: UpdateStaffPermissionsDto })
    @ApiOkResponse({
        description: "Cập nhật permissions thành công",
        schema: swWrap({ $ref: getSchemaPath(UpdateStaffPermissionsResponseDto) }),
    })
    @ApiBadRequestResponse({ description: "Payload permissions không hợp lệ hoặc không có key nào để cập nhật." })
    @ApiNotFoundResponse({ description: "Không tìm thấy staff hoặc nhà hàng." })
    @ApiTooManyRequestsResponse({ description: "Vượt giới hạn thao tác ghi staff trong 1 phút." })
    @ApiUnauthorizedResponse({ description: "Thiếu hoặc sai Bearer token." })
    @ApiForbiddenResponse({ description: "Không có quyền cập nhật permissions staff." })
    @ApiInternalServerErrorResponse({ description: "Lỗi nội bộ máy chủ." })
    @Patch(":staff_id/permissions")
    @RestaurantRoles(RESTAURANT_ROLE.OWNER)
    async updateStaffPermissions(
        @Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
        @Param("staff_id", ParseObjectIdPipe) staffId: Types.ObjectId,
        @Body() dto: UpdateStaffPermissionsDto,
    ) {
        return this.staffService.updatePermissions(restaurantId, staffId, dto);
    }

    @ApiOperation({
        summary: "Cập nhật avatar staff",
        description: "Owner/Admin cập nhật cho mọi staff; Staff chỉ cập nhật avatar của chính mình.",
    })
    @ApiParam({
        name: "id",
        type: String,
        example: "664f1a2b3c4d5e6f7a8b9c9a",
        description: "ObjectId của nhà hàng",
    })
    @ApiParam({
        name: "staff_id",
        type: String,
        example: "664f1a2b3c4d5e6f7a8b9c2f",
        description: "ObjectId của staff",
    })
    @ApiBody({ type: UpdateStaffAvatarDto })
    @ApiOkResponse({
        description: "Cập nhật avatar thành công",
        schema: swWrap({ $ref: getSchemaPath(UpdateStaffAvatarResponseDto) }),
    })
    @ApiBadRequestResponse({ description: "Payload avatar không hợp lệ hoặc id không hợp lệ." })
    @ApiNotFoundResponse({ description: "Không tìm thấy staff hoặc nhà hàng." })
    @ApiTooManyRequestsResponse({ description: "Vượt giới hạn thao tác ghi staff trong 1 phút." })
    @ApiUnauthorizedResponse({ description: "Thiếu hoặc sai Bearer token." })
    @ApiForbiddenResponse({ description: "Bạn chỉ được cập nhật avatar của chính mình." })
    @ApiInternalServerErrorResponse({ description: "Lỗi nội bộ máy chủ." })
    @Put(":staff_id/avatar")
    @RequireRestaurant()
    async updateStaffAvatar(
        @Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
        @Param("staff_id", ParseObjectIdPipe) staffId: Types.ObjectId,
        @CurrentUser() user: AccessTokenPayload,
        @Body() dto: UpdateStaffAvatarDto,
        @Req() req: Request,
    ) {
        const requesterRole = this.getRequesterRole(req);
        const isBypassCheck =
            requesterRole === RESTAURANT_ROLE.ADMIN ||
            requesterRole === RESTAURANT_ROLE.OWNER;

        return this.staffService.updateAvatar(
            restaurantId,
            staffId,
            this.toObjectId(user.sub),
            dto.avatar_url,
            isBypassCheck,
        );
    }

    @ApiOperation({
        summary: "Xóa mềm staff",
        description: "Soft delete staff và chuyển status về terminated nếu không còn đơn active phụ trách.",
    })
    @ApiParam({
        name: "id",
        type: String,
        example: "664f1a2b3c4d5e6f7a8b9c9a",
        description: "ObjectId của nhà hàng",
    })
    @ApiParam({
        name: "staff_id",
        type: String,
        example: "664f1a2b3c4d5e6f7a8b9c2f",
        description: "ObjectId của staff",
    })
    @ApiOkResponse({
        description: "Xóa mềm staff thành công",
        schema: swWrap({ $ref: getSchemaPath(DeleteStaffResponseDto) }),
    })
    @ApiBadRequestResponse({ description: "id hoặc staff_id không hợp lệ." })
    @ApiNotFoundResponse({ description: "Không tìm thấy staff hoặc nhà hàng." })
    @ApiConflictResponse({ description: "Staff đang phụ trách đơn active nên không thể xóa." })
    @ApiTooManyRequestsResponse({ description: "Vượt giới hạn thao tác ghi staff trong 1 phút." })
    @ApiUnauthorizedResponse({ description: "Thiếu hoặc sai Bearer token." })
    @ApiForbiddenResponse({ description: "Không có quyền xóa staff." })
    @ApiInternalServerErrorResponse({ description: "Lỗi nội bộ máy chủ." })
    @Delete(":staff_id")
    @RestaurantRoles(RESTAURANT_ROLE.OWNER)
    async softDeleteStaff(
        @Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
        @Param("staff_id", ParseObjectIdPipe) staffId: Types.ObjectId,
    ) {
        return this.staffService.softDeleteStaff(restaurantId, staffId);
    }

    private getRequesterRole(req: Request): RestaurantRole | undefined {
        return req[RESTAURANT_ROLE_INJECT] as RestaurantRole | undefined;
    }

    private toObjectId(value: string | Types.ObjectId): Types.ObjectId {
        if (value instanceof Types.ObjectId) {
            return value;
        }

        return new Types.ObjectId(value);
    }
}
