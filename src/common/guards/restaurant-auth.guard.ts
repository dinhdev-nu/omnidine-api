import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_KEY, IS_REQUIRE_RESTAURANT_KEY, RESTAURANT_ROLES_KEY } from "../decorators";
import { Request } from "express";
import { ForbiddenException, UnauthorizedException } from "../exceptions";
import { ERROR_CODE } from "../constants/error-code.constant";
import { USER_PAYLOAD } from "./jwt-auth.guard";
import { AccessTokenPayload } from "src/modules/auth/auth.service.xxx";
import { RestaurantService, StaffService } from "src/modules/restaurant/services";
import { Types } from "mongoose";
import { RestaurantRole } from "../constants/restaurant-role.constant";
import { ObjectUtil } from "../utils/object.ultil";

export const RESTAURANT_ROLE_INJECT = "x-restaurant-role";
export const STAFF_INJECT = "x-restaurant-staff";
export const RESTAURANT_ID_PARAM = "id";

@Injectable()
export class RestaurantAuthGuard implements CanActivate {

    constructor(
        private readonly reflector: Reflector,

        private readonly restaurantService: RestaurantService,
        private readonly staffService: StaffService,
    ) {}

    async canActivate(ctx: ExecutionContext): Promise<boolean> {
        if(this.hasMetadata(ctx, IS_PUBLIC_KEY)) return true;
        const isRquire = this.hasMetadata(ctx, IS_REQUIRE_RESTAURANT_KEY);
        if(!isRquire) return true;

        const req = ctx.switchToHttp().getRequest<Request>();
        const resId = req.params?.[RESTAURANT_ID_PARAM] as string;
        if(!resId) {
            throw new ForbiddenException(ERROR_CODE.RESOURCE_NOT_FOUND, "Không tìm thấy nhà hàng");
        }

        const user = req[USER_PAYLOAD] as AccessTokenPayload | undefined;
        if(!user) {
            throw new UnauthorizedException(ERROR_CODE.UNAUTHORIZED, "Vui lòng đăng nhập để tiếp tục");
        }
        
        const isObjId = Types.ObjectId.isValid(resId);
        if(!isObjId) {
            throw new ForbiddenException(ERROR_CODE.RESOURCE_NOT_FOUND, "Không tìm thấy nhà hàng");
        }
        const res = await this.restaurantService.handleGetResAndThrow(new Types.ObjectId(resId));

        let role: RestaurantRole
        if(user.system_role === "admin") role = 'admin';
        else if(res.owner_id.toString() === user.sub.toString()) role = 'owner';
        else {
            const staff = await this.staffService.getStaffByUserOrThrow(
                new Types.ObjectId(resId),
                new Types.ObjectId(user.sub)
            )

            req[STAFF_INJECT] = ObjectUtil.pick(staff, ["_id", "permissions", "user_id"]);
            role = 'staff'
        }

        req[RESTAURANT_ROLE_INJECT] = role;

        const requiredRoles = this.requiredRestaurantRoles(ctx);
        if(requiredRoles.length === 0) return true;
        if(role === 'admin') return true;

        if(!requiredRoles.includes(role)) {
            throw new ForbiddenException(ERROR_CODE.FORBIDDEN, "Bạn không có quyền truy cập nhà hàng này");
        };

        return true;
    }   

    private requiredRestaurantRoles(ctx: ExecutionContext): RestaurantRole[] {
        return this.reflector.getAllAndOverride<RestaurantRole[]>(RESTAURANT_ROLES_KEY, [
            ctx.getHandler(),
            ctx.getClass(),
        ]) || [];
    }

    private hasMetadata(ctx: ExecutionContext, key: string): boolean {
        return this.reflector.getAllAndOverride<boolean>(key, [
        ctx.getHandler(),
        ctx.getClass(),
        ]) === true;
    }
}