import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    ParseIntPipe,
    Patch,
    Post,
    Query,
} from "@nestjs/common";
import { Types } from "mongoose";
import { RESTAURANT_ROLE } from "src/common/constants/restaurant-role.constant";
import { ROLE } from "src/common/constants/role.constant";
import {
    Public,
    RequireRestaurant,
    RestaurantRoles,
    Roles,
    ThrottleCustom,
} from "src/common/decorators";
import { ParseObjectIdPipe } from "src/common/pipes/parse-id.pipe";
import { SlugValidationPipe } from "src/common/pipes/slug.pipe";
import {
    AddMenuItemImageDto,
    CreateMenuCategoryDto,
    CreateMenuItemDto,
    ListMenuCategoryQueryDto,
    ListMenuItemsQueryDto,
    PublicMenuSearchQueryDto,
    ReorderMenuCategoriesDto,
    ReorderMenuItemsDto,
    ToggleMenuCategoryDto,
    ToggleMenuItemAvailabilityDto,
    ToggleMenuItemFeaturedDto,
    UpdateMenuCategoryDto,
    UpdateMenuItemDto,
} from "../dto/menu.dto";
import { MenuService } from "../services";

@Controller("restaurants/:id/menu")
@Roles(ROLE.ADMIN, ROLE.USER)
export class MenuController {
    constructor(
        private readonly menuService: MenuService,
    ) {}

    @Post("categories")
    @RestaurantRoles(RESTAURANT_ROLE.OWNER)
    async createCategory(
        @Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
        @Body() payload: CreateMenuCategoryDto,
    ) {
        return this.menuService.createCategory(restaurantId, payload);
    }

    @Get("categories")
    @RequireRestaurant()
    async listCategories(
        @Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
        @Query() query: ListMenuCategoryQueryDto,
    ) {
        return this.menuService.listCategories(restaurantId, query);
    }

    @Patch("categories/reorder")
    @RestaurantRoles(RESTAURANT_ROLE.OWNER)
    async reorderCategories(
        @Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
        @Body() payload: ReorderMenuCategoriesDto,
    ) {
        return this.menuService.reorderCategories(restaurantId, payload);
    }

    @Patch("categories/:cat_id")
    @RestaurantRoles(RESTAURANT_ROLE.OWNER)
    async updateCategory(
        @Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
        @Param("cat_id", ParseObjectIdPipe) categoryId: Types.ObjectId,
        @Body() payload: UpdateMenuCategoryDto,
    ) {
        return this.menuService.updateCategory(restaurantId, categoryId, payload);
    }

    @Patch("categories/:cat_id/toggle")
    @RestaurantRoles(RESTAURANT_ROLE.OWNER)
    async toggleCategory(
        @Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
        @Param("cat_id", ParseObjectIdPipe) categoryId: Types.ObjectId,
        @Body() payload: ToggleMenuCategoryDto,
    ) {
        return this.menuService.toggleCategoryActive(restaurantId, categoryId, payload);
    }

    @Delete("categories/:cat_id")
    @RestaurantRoles(RESTAURANT_ROLE.OWNER)
    async deleteCategory(
        @Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
        @Param("cat_id", ParseObjectIdPipe) categoryId: Types.ObjectId,
    ) {
        return this.menuService.deleteCategory(restaurantId, categoryId);
    }

    @Post("items")
    @RestaurantRoles(RESTAURANT_ROLE.OWNER)
    async createItem(
        @Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
        @Body() payload: CreateMenuItemDto,
    ) {
        return this.menuService.createItem(restaurantId, payload);
    }

    @Get("items")
    @RequireRestaurant()
    async listItems(
        @Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
        @Query() query: ListMenuItemsQueryDto,
    ) {
        return this.menuService.listItems(restaurantId, query);
    }

    @Patch("items/reorder")
    @RestaurantRoles(RESTAURANT_ROLE.OWNER)
    async reorderItems(
        @Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
        @Body() payload: ReorderMenuItemsDto,
    ) {
        return this.menuService.reorderItems(restaurantId, payload);
    }

    @Get("items/:item_id")
    @RequireRestaurant()
    async getItemDetail(
        @Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
        @Param("item_id", ParseObjectIdPipe) itemId: Types.ObjectId,
    ) {
        return this.menuService.getItemDetail(restaurantId, itemId);
    }

    @Patch("items/:item_id")
    @RestaurantRoles(RESTAURANT_ROLE.OWNER)
    async updateItem(
        @Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
        @Param("item_id", ParseObjectIdPipe) itemId: Types.ObjectId,
        @Body() payload: UpdateMenuItemDto,
    ) {
        return this.menuService.updateItem(restaurantId, itemId, payload);
    }

    @Patch("items/:item_id/availability")
    @RestaurantRoles(RESTAURANT_ROLE.OWNER)
    async toggleItemAvailability(
        @Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
        @Param("item_id", ParseObjectIdPipe) itemId: Types.ObjectId,
        @Body() payload: ToggleMenuItemAvailabilityDto,
    ) {
        return this.menuService.toggleItemAvailability(restaurantId, itemId, payload);
    }

    @Patch("items/:item_id/featured")
    @RestaurantRoles(RESTAURANT_ROLE.OWNER)
    async toggleItemFeatured(
        @Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
        @Param("item_id", ParseObjectIdPipe) itemId: Types.ObjectId,
        @Body() payload: ToggleMenuItemFeaturedDto,
    ) {
        return this.menuService.toggleItemFeatured(restaurantId, itemId, payload);
    }

    @Post("items/:item_id/images")
    @RestaurantRoles(RESTAURANT_ROLE.OWNER)
    async addItemImage(
        @Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
        @Param("item_id", ParseObjectIdPipe) itemId: Types.ObjectId,
        @Body() payload: AddMenuItemImageDto,
    ) {
        return this.menuService.addItemImage(restaurantId, itemId, payload);
    }

    @Delete("items/:item_id/images/:index")
    @RestaurantRoles(RESTAURANT_ROLE.OWNER)
    async removeItemImage(
        @Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
        @Param("item_id", ParseObjectIdPipe) itemId: Types.ObjectId,
        @Param("index", ParseIntPipe) index: number,
    ) {
        return this.menuService.removeItemImage(restaurantId, itemId, index);
    }

    @Delete("items/:item_id")
    @RestaurantRoles(RESTAURANT_ROLE.OWNER)
    async softDeleteItem(
        @Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
        @Param("item_id", ParseObjectIdPipe) itemId: Types.ObjectId,
    ) {
        return this.menuService.softDeleteItem(restaurantId, itemId);
    }

}

@Controller("public/restaurants/:slug/menu")
export class PublicMenuController {
    constructor(
        private readonly menuService: MenuService,
    ) {}

    @Get()
    @Public()
    async getPublicMenuBySlug(
        @Param("slug", SlugValidationPipe) slug: string,
    ) {
        return this.menuService.getPublicMenuBySlug(slug);
    }

    @Get("search")
    @Public()
    @ThrottleCustom("public-menu-search", { ttl: 60_000, limit: 60 })
    async searchPublicMenuItem(
        @Param("slug", SlugValidationPipe) slug: string,
        @Query() query: PublicMenuSearchQueryDto,
    ) {
        return this.menuService.searchPublicMenuItem(slug, query);
    }
}