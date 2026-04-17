import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { ERROR_CODE } from "src/common/constants/error-code.constant";
import { RestaurantRole } from "src/common/constants/restaurant-role.constant";
import { ForbiddenException } from "src/common/exceptions";
import { RESTAURANT_ROLE_INJECT, STAFF_INJECT } from "src/common/guards/restaurant-auth.guard";
import { IActor } from "src/modules/order/order.service";

type ACTOR_TYPE = keyof IActor;


/**
 * Decorator để lấy thông tin actor (vai trò và quyền hạn nếu là staff) đã được xác minh bởi RestaurantAuthGuard.
 * Lưu ý: decorator chỉ sử dụng được khi có @RequireRestaurant()
 */
export const CurrentActor = createParamDecorator(
    (data: ACTOR_TYPE | undefined, ctx: ExecutionContext) => {
        const req = ctx.switchToHttp().getRequest();

        const role = req[RESTAURANT_ROLE_INJECT] as RestaurantRole | undefined;
        if (!role) throw new ForbiddenException( ERROR_CODE.FORBIDDEN, "Chưa xác minh" )

        const actor: IActor = { role: role };
        if (actor.role === 'staff') {
            const staff = req[STAFF_INJECT];
            actor.staff_id = staff._id;
            actor.permissions = staff.permissions || {};
        }

        return data ? actor[data] : actor;
    }
)