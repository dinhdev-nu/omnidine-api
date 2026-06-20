import { Inject, Injectable } from "@nestjs/common";
import { Types } from "mongoose";
import { ERROR_CODE } from "src/common/constants/error-code.constant";
import { INJECTION_TOKEN } from "src/common/constants/injection-token.constant";
import { ForbiddenException, NotFoundException } from "src/common/exceptions";
import { IRestaurantRepository } from "../repositories/restaurant.repository";
import { IStaffRepository } from "../staff/repositories/staff.repository";
import { ITableRepository } from "../table/repositories/table.repository";
import { ObjectUtil } from "src/common/utils/object.util";
import { AccessTokenPayload } from "src/modules/auth/auth.service";


@Injectable()
export class PosService {
    constructor(
        @Inject(INJECTION_TOKEN.RESTAURANT_REPOSITORY)
        private readonly restaurantRepository: IRestaurantRepository,

        @Inject(INJECTION_TOKEN.STAFF_REPOSITORY)
        private readonly staffRepository: IStaffRepository,

        @Inject(INJECTION_TOKEN.TABLE_REPOSITORY)
        private readonly tableRepository: ITableRepository,
    ) {}

    async init(
        slug: string,
        user: AccessTokenPayload,
    ): Promise<Record<string, unknown>> {
        const restaurant = await this.restaurantRepository.getBySlug(slug);

        if (!restaurant || restaurant.deleted_at !== null) {
            throw new NotFoundException( ERROR_CODE.RESTAURANT_NOT_FOUND, "Khong tim thay nha hang");
        }

        const isOwner = restaurant.owner_id.toString() === user.sub.toString();
        const isAdmin = user.system_role === "admin";

        let staff: Record<string, unknown> | null = null;
        if (!isOwner && !isAdmin) {
            const staffRecord = await this.staffRepository.findByUserInRestaurant(restaurant._id, new Types.ObjectId(user.sub));
            if (!staffRecord || staffRecord.deleted_at !== null || staffRecord.status !== "active") {
                throw new ForbiddenException(ERROR_CODE.FORBIDDEN, "Ban khong co quyen truy cap POS cua nha hang nay");
            }
            staff = ObjectUtil.pick(staffRecord, [ "_id", "employee_code", "full_name", "phone", "email", 'permissions', 'position' ]);
        }

        return {
            user: {
                id: user.sub,
                system_role: user.system_role,
            },
            business_role: isOwner ? "owner" : (isAdmin ? "admin" : "staff"),
            current_staff: staff,
            restaurant: ObjectUtil.pick(restaurant, [ "_id", "name",'logo_url', "slug", "address", "phone", "timezone", "currency", "tax_rate", "service_charge_rate", "accepts_online_orders" ]),
        }; 
    }
}
