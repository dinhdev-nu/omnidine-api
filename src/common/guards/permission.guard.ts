import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RestaurantRole } from "../constants/restaurant-role.constant";
import { IS_PUBLIC_KEY, IS_REQUIRE_RESTAURANT_KEY, REQUIRE_PERMISSION_KEY } from "../decorators";
import { RESTAURANT_ROLE_INJECT, STAFF_INJECT } from "./restaurant-auth.guard";
import { ForbiddenException } from "../exceptions";
import { ERROR_CODE } from "../constants/error-code.constant";
import { Request } from "express";
import { StaffPermissionKey } from "src/modules/restaurant/schemas/staff.schema.xxx";

@Injectable()
export class PermissionGuard implements CanActivate {
    constructor(
        private readonly reflector: Reflector,
    ) {}

    async canActivate(ctx: ExecutionContext): Promise<boolean> {
        if(this.hasMetadata(ctx, IS_PUBLIC_KEY)) return true;
        const isRquire = this.hasMetadata(ctx, IS_REQUIRE_RESTAURANT_KEY);
        if(!isRquire) return true;
        const requiredPermissions = this.requiredPermissions(ctx);
        if(requiredPermissions.length === 0) return true;

        const req = ctx.switchToHttp().getRequest<Request>();
        const role = req[RESTAURANT_ROLE_INJECT] as RestaurantRole | undefined;
        if(!role) {
            throw new ForbiddenException(
                ERROR_CODE.FORBIDDEN,
                "Không tìm thấy vai trò của người dùng trong nhà hàng"
            )
        };
        if(role === 'admin' || role === 'owner') return true;
        
        const staff = req[STAFF_INJECT];
        if (!staff) {
            throw new ForbiddenException( ERROR_CODE.FORBIDDEN, "Bạn không phải là nhân viên của nhà hàng này");
        }
        const staffPerms: Record<StaffPermissionKey, boolean> = staff.permissions || {};

        const missingPerms = requiredPermissions.filter(perm => staffPerms[perm] !== true);
        if(missingPerms.length > 0) {
            throw new ForbiddenException(
                ERROR_CODE.FORBIDDEN,
                `Thiếu quyền: ${missingPerms.join(', ')}`
            );
        }

        return true;
    }

    private requiredPermissions(ctx: ExecutionContext): StaffPermissionKey[] {
        return this.reflector.getAllAndOverride<StaffPermissionKey[]>(REQUIRE_PERMISSION_KEY, [
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