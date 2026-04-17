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
import { AccessTokenPayload } from "../../auth/auth.service.xxx";
import { CreateStaffDto } from "../dto/create-staff.dto";
import {
    CreateStaffPayloadDto,
    ListStaffQuery,
    UpdateStaffAvatarDto,
    UpdateStaffDto,
    UpdateStaffLinkAccountDto,
    UpdateStaffPermissionsDto,
    UpdateStaffStatusDto,
} from "../dto/staff.dto";
import { StaffService } from "../services";

@Controller("restaurants/:id/staff")
@Roles(ROLE.ADMIN, ROLE.USER)
export class StaffController {

    constructor(
        private readonly staffService: StaffService,
    ) {}

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

    @Get()
    @RequireRestaurant()
    async listStaffs(
        @Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
        @Query() query: ListStaffQuery,
    ) {
        return this.staffService.listStaffs(restaurantId, query);
    }

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

    @Patch(":staff_id")
    @RestaurantRoles(RESTAURANT_ROLE.OWNER)
    async updateStaffInfo(
        @Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
        @Param("staff_id", ParseObjectIdPipe) staffId: Types.ObjectId,
        @Body() dto: UpdateStaffDto,
    ) {
        return this.staffService.updateStaffInfo(restaurantId, staffId, dto);
    }

    @Patch(":staff_id/status")
    @RestaurantRoles(RESTAURANT_ROLE.OWNER)
    async updateStaffStatus(
        @Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
        @Param("staff_id", ParseObjectIdPipe) staffId: Types.ObjectId,
        @Body() dto: UpdateStaffStatusDto,
    ) {
        return this.staffService.updateStaffStatus(restaurantId, staffId, dto);
    }

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

    @Patch(":staff_id/permissions")
    @RestaurantRoles(RESTAURANT_ROLE.OWNER)
    async updateStaffPermissions(
        @Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
        @Param("staff_id", ParseObjectIdPipe) staffId: Types.ObjectId,
        @Body() dto: UpdateStaffPermissionsDto,
    ) {
        return this.staffService.updatePermissions(restaurantId, staffId, dto);
    }

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