import { SetMetadata } from "@nestjs/common";

// Decorator làm trigger cho RestaurantAuthGuard
export const IS_REQUIRE_RESTAURANT_KEY = "isRequireRestaurant";
export const RequireRestaurant = () => SetMetadata(IS_REQUIRE_RESTAURANT_KEY, true);
