export const RESTAURANT_ROLE = {
    OWNER: "owner",
    STAFF: "staff",
    ADMIN: "admin" // Admin của system
} as const;

export type RestaurantRole = typeof RESTAURANT_ROLE[keyof typeof RESTAURANT_ROLE];