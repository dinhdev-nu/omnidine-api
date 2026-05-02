import { applyDecorators, SetMetadata } from "@nestjs/common";
import { IS_REQUIRE_RESTAURANT_KEY } from "./require-restaurant.decorator";
import { RestaurantRole } from "src/common/constants/restaurant-role.constant";

export const RESTAURANT_ROLES_KEY = "restaurantRoles";
export const RestaurantRoles = (...roles: RestaurantRole[]) => applyDecorators(
    SetMetadata(IS_REQUIRE_RESTAURANT_KEY, true),
    SetMetadata(RESTAURANT_ROLES_KEY, roles)
)