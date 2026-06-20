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
    DeleteResponseDto,
    ListMenuCategoryQueryDto,
    ListMenuCategoriesResponseDto,
    ListMenuItemsResponseDto,
    MenuCategoryResponseDto,
    MenuItemImagesMutationResponseDto,
    MenuItemResponseDto,
    ListMenuItemsQueryDto,
    PublicMenuSearchQueryDto,
    PublicMenuBySlugResponseDto,
    PublicMenuSearchResponseDto,
    ReorderResponseDto,
    ReorderMenuCategoriesDto,
    ReorderMenuItemsDto,
    ToggleMenuCategoryDto,
    ToggleMenuCategoryResponseDto,
    ToggleMenuItemAvailabilityDto,
    ToggleMenuItemAvailabilityResponseDto,
    ToggleMenuItemFeaturedDto,
    ToggleMenuItemFeaturedResponseDto,
    UpdateMenuCategoryDto,
    UpdateMenuCategoryResponseDto,
    UpdateMenuItemDto,
    UpdateMenuItemResponseDto,
} from "./dto/menu.dto";
import { swWrap } from "src/common/swagger/api-response.util";
import { MenuService } from "./menu.service";

@ApiTags("menu")
@ApiBearerAuth()
@ApiExtraModels(
    MenuCategoryResponseDto,
    ListMenuCategoriesResponseDto,
    UpdateMenuCategoryResponseDto,
    ToggleMenuCategoryResponseDto,
    ReorderResponseDto,
    DeleteResponseDto,
    MenuItemResponseDto,
    ListMenuItemsResponseDto,
    UpdateMenuItemResponseDto,
    ToggleMenuItemAvailabilityResponseDto,
    ToggleMenuItemFeaturedResponseDto,
    MenuItemImagesMutationResponseDto,
)
@Controller("restaurants/:id/menu")
@Roles(ROLE.ADMIN, ROLE.USER)
export class MenuController {
    constructor(
        private readonly menuService: MenuService,
    ) {}

    @ApiOperation({
        summary: "Tao danh muc menu",
        description: "Owner tao danh muc menu moi cho nha hang. He thong enforce gioi han danh muc active.",
    })
    @ApiParam({
        name: "id",
        type: String,
        example: "664f1a2b3c4d5e6f7a8b9001",
        description: "ObjectId nha hang",
    })
    @ApiBody({ type: CreateMenuCategoryDto })
    @ApiOkResponse({
        description: "Tao danh muc thanh cong",
        schema: swWrap({ $ref: getSchemaPath(MenuCategoryResponseDto) }),
    })
    @ApiBadRequestResponse({ description: "Payload khong hop le, vuot gioi han danh muc active hoac id khong hop le." })
    @ApiNotFoundResponse({ description: "Khong tim thay nha hang hoac context restaurant khong hop le." })
    @ApiTooManyRequestsResponse({ description: "Vuot gioi han ghi menu trong 1 phut." })
    @ApiUnauthorizedResponse({ description: "Thieu hoac sai Bearer token." })
    @ApiForbiddenResponse({ description: "Khong co quyen tao danh muc menu cho nha hang nay." })
    @ApiInternalServerErrorResponse({ description: "Loi noi bo may chu." })
    @Post("categories")
    @RestaurantRoles(RESTAURANT_ROLE.OWNER)
    async createCategory(
        @Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
        @Body() payload: CreateMenuCategoryDto,
    ) {
        return this.menuService.createCategory(restaurantId, payload);
    }

    @ApiOperation({
        summary: "Lay danh sach danh muc menu",
        description: "Lay danh sach category theo nha hang, co the gom danh muc inactive khi include_inactive=true.",
    })
    @ApiParam({
        name: "id",
        type: String,
        example: "664f1a2b3c4d5e6f7a8b9001",
        description: "ObjectId nha hang",
    })
    @ApiQuery({
        name: "include_inactive",
        required: false,
        type: Boolean,
        example: false,
        description: "true de lay ca category is_active=false",
    })
    @ApiOkResponse({
        description: "Danh sach category menu",
        schema: swWrap({ $ref: getSchemaPath(ListMenuCategoriesResponseDto) }),
    })
    @ApiBadRequestResponse({ description: "Query khong hop le hoac id khong hop le." })
    @ApiNotFoundResponse({ description: "Khong tim thay nha hang." })
    @ApiUnauthorizedResponse({ description: "Thieu hoac sai Bearer token." })
    @ApiForbiddenResponse({ description: "Khong co quyen xem menu nha hang nay." })
    @ApiInternalServerErrorResponse({ description: "Loi noi bo may chu." })
    @Get("categories")
    @RequireRestaurant()
    async listCategories(
        @Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
        @Query() query: ListMenuCategoryQueryDto,
    ) {
        return this.menuService.listCategories(restaurantId, query);
    }

    @ApiOperation({
        summary: "Sap xep lai danh muc",
        description: "Nhan danh sach category id theo thu tu moi va cap nhat sort_order dong loat.",
    })
    @ApiParam({
        name: "id",
        type: String,
        example: "664f1a2b3c4d5e6f7a8b9001",
        description: "ObjectId nha hang",
    })
    @ApiBody({ type: ReorderMenuCategoriesDto })
    @ApiOkResponse({
        description: "Sap xep danh muc thanh cong",
        schema: swWrap({ $ref: getSchemaPath(ReorderResponseDto) }),
    })
    @ApiBadRequestResponse({ description: "Payload order khong hop le hoac thieu id danh muc." })
    @ApiNotFoundResponse({ description: "Khong tim thay nha hang hoac category." })
    @ApiTooManyRequestsResponse({ description: "Vuot gioi han ghi menu trong 1 phut." })
    @ApiUnauthorizedResponse({ description: "Thieu hoac sai Bearer token." })
    @ApiForbiddenResponse({ description: "Khong co quyen sap xep danh muc." })
    @ApiInternalServerErrorResponse({ description: "Loi noi bo may chu." })
    @Patch("categories/reorder")
    @RestaurantRoles(RESTAURANT_ROLE.OWNER)
    async reorderCategories(
        @Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
        @Body() payload: ReorderMenuCategoriesDto,
    ) {
        return this.menuService.reorderCategories(restaurantId, payload);
    }

    @ApiOperation({
        summary: "Cap nhat thong tin danh muc",
        description: "Cap nhat partial cac truong ten/mo ta/anh dai dien cua category.",
    })
    @ApiParam({
        name: "id",
        type: String,
        example: "664f1a2b3c4d5e6f7a8b9001",
        description: "ObjectId nha hang",
    })
    @ApiParam({
        name: "cat_id",
        type: String,
        example: "664f1a2b3c4d5e6f7a8b9101",
        description: "ObjectId danh muc",
    })
    @ApiBody({ type: UpdateMenuCategoryDto })
    @ApiOkResponse({
        description: "Cap nhat danh muc thanh cong",
        schema: swWrap({ $ref: getSchemaPath(UpdateMenuCategoryResponseDto) }),
    })
    @ApiBadRequestResponse({ description: "Payload cap nhat khong hop le hoac khong co field hop le." })
    @ApiNotFoundResponse({ description: "Khong tim thay danh muc hoac nha hang." })
    @ApiTooManyRequestsResponse({ description: "Vuot gioi han ghi menu trong 1 phut." })
    @ApiUnauthorizedResponse({ description: "Thieu hoac sai Bearer token." })
    @ApiForbiddenResponse({ description: "Khong co quyen cap nhat danh muc." })
    @ApiInternalServerErrorResponse({ description: "Loi noi bo may chu." })
    @Patch("categories/:cat_id")
    @RestaurantRoles(RESTAURANT_ROLE.OWNER)
    async updateCategory(
        @Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
        @Param("cat_id", ParseObjectIdPipe) categoryId: Types.ObjectId,
        @Body() payload: UpdateMenuCategoryDto,
    ) {
        return this.menuService.updateCategory(restaurantId, categoryId, payload);
    }

    @ApiOperation({
        summary: "Bat/tat danh muc",
        description: "Cap nhat is_active cho category. Khi bat lai category se check gioi han category active.",
    })
    @ApiParam({
        name: "id",
        type: String,
        example: "664f1a2b3c4d5e6f7a8b9001",
        description: "ObjectId nha hang",
    })
    @ApiParam({
        name: "cat_id",
        type: String,
        example: "664f1a2b3c4d5e6f7a8b9101",
        description: "ObjectId danh muc",
    })
    @ApiBody({ type: ToggleMenuCategoryDto })
    @ApiOkResponse({
        description: "Cap nhat trang thai danh muc thanh cong",
        schema: swWrap({ $ref: getSchemaPath(ToggleMenuCategoryResponseDto) }),
    })
    @ApiBadRequestResponse({ description: "Payload is_active khong hop le hoac vuot gioi han category active." })
    @ApiNotFoundResponse({ description: "Khong tim thay danh muc hoac nha hang." })
    @ApiTooManyRequestsResponse({ description: "Vuot gioi han ghi menu trong 1 phut." })
    @ApiUnauthorizedResponse({ description: "Thieu hoac sai Bearer token." })
    @ApiForbiddenResponse({ description: "Khong co quyen cap nhat trang thai danh muc." })
    @ApiInternalServerErrorResponse({ description: "Loi noi bo may chu." })
    @Patch("categories/:cat_id/toggle")
    @RestaurantRoles(RESTAURANT_ROLE.OWNER)
    async toggleCategory(
        @Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
        @Param("cat_id", ParseObjectIdPipe) categoryId: Types.ObjectId,
        @Body() payload: ToggleMenuCategoryDto,
    ) {
        return this.menuService.toggleCategoryActive(restaurantId, categoryId, payload);
    }

    @ApiOperation({
        summary: "Xoa danh muc",
        description: "Xoa hard-delete category. Chi xoa duoc khi khong con mon an trong category.",
    })
    @ApiParam({
        name: "id",
        type: String,
        example: "664f1a2b3c4d5e6f7a8b9001",
        description: "ObjectId nha hang",
    })
    @ApiParam({
        name: "cat_id",
        type: String,
        example: "664f1a2b3c4d5e6f7a8b9101",
        description: "ObjectId danh muc",
    })
    @ApiOkResponse({
        description: "Xoa danh muc thanh cong",
        schema: swWrap({ $ref: getSchemaPath(DeleteResponseDto) }),
    })
    @ApiBadRequestResponse({ description: "id hoac cat_id khong hop le." })
    @ApiNotFoundResponse({ description: "Khong tim thay danh muc hoac nha hang." })
    @ApiConflictResponse({ description: "Danh muc van con mon an nen khong the xoa." })
    @ApiTooManyRequestsResponse({ description: "Vuot gioi han ghi menu trong 1 phut." })
    @ApiUnauthorizedResponse({ description: "Thieu hoac sai Bearer token." })
    @ApiForbiddenResponse({ description: "Khong co quyen xoa danh muc." })
    @ApiInternalServerErrorResponse({ description: "Loi noi bo may chu." })
    @Delete("categories/:cat_id")
    @RestaurantRoles(RESTAURANT_ROLE.OWNER)
    async deleteCategory(
        @Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
        @Param("cat_id", ParseObjectIdPipe) categoryId: Types.ObjectId,
    ) {
        return this.menuService.deleteCategory(restaurantId, categoryId);
    }

    @ApiOperation({
        summary: "Tao mon an",
        description: "Tao mon an moi thuoc 1 category cua nha hang.",
    })
    @ApiParam({
        name: "id",
        type: String,
        example: "664f1a2b3c4d5e6f7a8b9001",
        description: "ObjectId nha hang",
    })
    @ApiBody({ type: CreateMenuItemDto })
    @ApiOkResponse({
        description: "Tao mon an thanh cong",
        schema: swWrap({ $ref: getSchemaPath(MenuItemResponseDto) }),
    })
    @ApiBadRequestResponse({ description: "Payload khong hop le, vuot gioi han mon trong category hoac id khong hop le." })
    @ApiNotFoundResponse({ description: "Khong tim thay category hoac nha hang." })
    @ApiTooManyRequestsResponse({ description: "Vuot gioi han ghi menu trong 1 phut." })
    @ApiUnauthorizedResponse({ description: "Thieu hoac sai Bearer token." })
    @ApiForbiddenResponse({ description: "Khong co quyen tao mon an." })
    @ApiInternalServerErrorResponse({ description: "Loi noi bo may chu." })
    @Post("items")
    @RestaurantRoles(RESTAURANT_ROLE.OWNER)
    async createItem(
        @Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
        @Body() payload: CreateMenuItemDto,
    ) {
        return this.menuService.createItem(restaurantId, payload);
    }

    @ApiOperation({
        summary: "Lay danh sach mon an",
        description: "Lay danh sach mon an theo nha hang, ho tro loc category/is_available/is_featured va phan trang.",
    })
    @ApiParam({
        name: "id",
        type: String,
        example: "664f1a2b3c4d5e6f7a8b9001",
        description: "ObjectId nha hang",
    })
    @ApiQuery({ name: "category_id", required: false, type: String, example: "664f1a2b3c4d5e6f7a8b9101", description: "Loc theo category id" })
    @ApiQuery({ name: "is_available", required: false, type: Boolean, example: true, description: "Loc theo trang thai con ban" })
    @ApiQuery({ name: "is_featured", required: false, type: Boolean, example: false, description: "Loc theo trang thai noi bat" })
    @ApiQuery({ name: "page", required: false, type: Number, example: 1, description: "Trang hien tai (>=1)" })
    @ApiQuery({ name: "limit", required: false, type: Number, example: 50, description: "So ban ghi moi trang (1-100)" })
    @ApiOkResponse({
        description: "Danh sach mon an",
        schema: swWrap({ $ref: getSchemaPath(ListMenuItemsResponseDto) }),
    })
    @ApiBadRequestResponse({ description: "Query khong hop le hoac id khong hop le." })
    @ApiNotFoundResponse({ description: "Khong tim thay nha hang." })
    @ApiUnauthorizedResponse({ description: "Thieu hoac sai Bearer token." })
    @ApiForbiddenResponse({ description: "Khong co quyen xem menu nha hang nay." })
    @ApiInternalServerErrorResponse({ description: "Loi noi bo may chu." })
    @Get("items")
    @RequireRestaurant()
    async listItems(
        @Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
        @Query() query: ListMenuItemsQueryDto,
    ) {
        return this.menuService.listItems(restaurantId, query);
    }

    @ApiOperation({
        summary: "Sap xep lai mon an trong category",
        description: "Cap nhat sort_order theo danh sach item id moi trong 1 category.",
    })
    @ApiParam({
        name: "id",
        type: String,
        example: "664f1a2b3c4d5e6f7a8b9001",
        description: "ObjectId nha hang",
    })
    @ApiBody({ type: ReorderMenuItemsDto })
    @ApiOkResponse({
        description: "Sap xep mon an thanh cong",
        schema: swWrap({ $ref: getSchemaPath(ReorderResponseDto) }),
    })
    @ApiBadRequestResponse({ description: "Payload order khong hop le hoac thieu item id trong category." })
    @ApiNotFoundResponse({ description: "Khong tim thay nha hang, category hoac item." })
    @ApiTooManyRequestsResponse({ description: "Vuot gioi han ghi menu trong 1 phut." })
    @ApiUnauthorizedResponse({ description: "Thieu hoac sai Bearer token." })
    @ApiForbiddenResponse({ description: "Khong co quyen sap xep mon an." })
    @ApiInternalServerErrorResponse({ description: "Loi noi bo may chu." })
    @Patch("items/reorder")
    @RestaurantRoles(RESTAURANT_ROLE.OWNER)
    async reorderItems(
        @Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
        @Body() payload: ReorderMenuItemsDto,
    ) {
        return this.menuService.reorderItems(restaurantId, payload);
    }

    @ApiOperation({
        summary: "Lay chi tiet mon an",
        description: "Lay chi tiet 1 mon an trong nha hang.",
    })
    @ApiParam({
        name: "id",
        type: String,
        example: "664f1a2b3c4d5e6f7a8b9001",
        description: "ObjectId nha hang",
    })
    @ApiParam({
        name: "item_id",
        type: String,
        example: "664f1a2b3c4d5e6f7a8b9201",
        description: "ObjectId mon an",
    })
    @ApiOkResponse({
        description: "Chi tiet mon an",
        schema: swWrap({ $ref: getSchemaPath(MenuItemResponseDto) }),
    })
    @ApiBadRequestResponse({ description: "id hoac item_id khong hop le." })
    @ApiNotFoundResponse({ description: "Khong tim thay mon an hoac nha hang." })
    @ApiUnauthorizedResponse({ description: "Thieu hoac sai Bearer token." })
    @ApiForbiddenResponse({ description: "Khong co quyen xem mon an nay." })
    @ApiInternalServerErrorResponse({ description: "Loi noi bo may chu." })
    @Get("items/:item_id")
    @RequireRestaurant()
    async getItemDetail(
        @Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
        @Param("item_id", ParseObjectIdPipe) itemId: Types.ObjectId,
    ) {
        return this.menuService.getItemDetail(restaurantId, itemId);
    }

    @ApiOperation({
        summary: "Cap nhat thong tin mon an",
        description: "Cap nhat partial mon an: category_id, name, description, base_price.",
    })
    @ApiParam({
        name: "id",
        type: String,
        example: "664f1a2b3c4d5e6f7a8b9001",
        description: "ObjectId nha hang",
    })
    @ApiParam({
        name: "item_id",
        type: String,
        example: "664f1a2b3c4d5e6f7a8b9201",
        description: "ObjectId mon an",
    })
    @ApiBody({ type: UpdateMenuItemDto })
    @ApiOkResponse({
        description: "Cap nhat mon an thanh cong",
        schema: swWrap({ $ref: getSchemaPath(UpdateMenuItemResponseDto) }),
    })
    @ApiBadRequestResponse({ description: "Payload khong hop le hoac khong co field hop le de cap nhat." })
    @ApiNotFoundResponse({ description: "Khong tim thay mon an, category hoac nha hang." })
    @ApiTooManyRequestsResponse({ description: "Vuot gioi han ghi menu trong 1 phut." })
    @ApiUnauthorizedResponse({ description: "Thieu hoac sai Bearer token." })
    @ApiForbiddenResponse({ description: "Khong co quyen cap nhat mon an." })
    @ApiInternalServerErrorResponse({ description: "Loi noi bo may chu." })
    @Patch("items/:item_id")
    @RestaurantRoles(RESTAURANT_ROLE.OWNER)
    async updateItem(
        @Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
        @Param("item_id", ParseObjectIdPipe) itemId: Types.ObjectId,
        @Body() payload: UpdateMenuItemDto,
    ) {
        return this.menuService.updateItem(restaurantId, itemId, payload);
    }

    @ApiOperation({
        summary: "Bat/tat kha dung mon an",
        description: "Cap nhat is_available cho mon an. Khi tat mon, he thong co the tra warnings neu mon dang trong order active.",
    })
    @ApiParam({
        name: "id",
        type: String,
        example: "664f1a2b3c4d5e6f7a8b9001",
        description: "ObjectId nha hang",
    })
    @ApiParam({
        name: "item_id",
        type: String,
        example: "664f1a2b3c4d5e6f7a8b9201",
        description: "ObjectId mon an",
    })
    @ApiBody({ type: ToggleMenuItemAvailabilityDto })
    @ApiOkResponse({
        description: "Cap nhat trang thai kha dung thanh cong",
        schema: swWrap({ $ref: getSchemaPath(ToggleMenuItemAvailabilityResponseDto) }),
    })
    @ApiBadRequestResponse({ description: "Payload is_available khong hop le." })
    @ApiNotFoundResponse({ description: "Khong tim thay mon an hoac nha hang." })
    @ApiTooManyRequestsResponse({ description: "Vuot gioi han ghi menu trong 1 phut." })
    @ApiUnauthorizedResponse({ description: "Thieu hoac sai Bearer token." })
    @ApiForbiddenResponse({ description: "Khong co quyen cap nhat mon an." })
    @ApiInternalServerErrorResponse({ description: "Loi noi bo may chu." })
    @Patch("items/:item_id/availability")
    @RestaurantRoles(RESTAURANT_ROLE.OWNER)
    async toggleItemAvailability(
        @Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
        @Param("item_id", ParseObjectIdPipe) itemId: Types.ObjectId,
        @Body() payload: ToggleMenuItemAvailabilityDto,
    ) {
        return this.menuService.toggleItemAvailability(restaurantId, itemId, payload);
    }

    @ApiOperation({
        summary: "Bat/tat mon noi bat",
        description: "Cap nhat is_featured cho mon an.",
    })
    @ApiParam({
        name: "id",
        type: String,
        example: "664f1a2b3c4d5e6f7a8b9001",
        description: "ObjectId nha hang",
    })
    @ApiParam({
        name: "item_id",
        type: String,
        example: "664f1a2b3c4d5e6f7a8b9201",
        description: "ObjectId mon an",
    })
    @ApiBody({ type: ToggleMenuItemFeaturedDto })
    @ApiOkResponse({
        description: "Cap nhat mon noi bat thanh cong",
        schema: swWrap({ $ref: getSchemaPath(ToggleMenuItemFeaturedResponseDto) }),
    })
    @ApiBadRequestResponse({ description: "Payload is_featured khong hop le." })
    @ApiNotFoundResponse({ description: "Khong tim thay mon an hoac nha hang." })
    @ApiTooManyRequestsResponse({ description: "Vuot gioi han ghi menu trong 1 phut." })
    @ApiUnauthorizedResponse({ description: "Thieu hoac sai Bearer token." })
    @ApiForbiddenResponse({ description: "Khong co quyen cap nhat mon an." })
    @ApiInternalServerErrorResponse({ description: "Loi noi bo may chu." })
    @Patch("items/:item_id/featured")
    @RestaurantRoles(RESTAURANT_ROLE.OWNER)
    async toggleItemFeatured(
        @Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
        @Param("item_id", ParseObjectIdPipe) itemId: Types.ObjectId,
        @Body() payload: ToggleMenuItemFeaturedDto,
    ) {
        return this.menuService.toggleItemFeatured(restaurantId, itemId, payload);
    }

    @ApiOperation({
        summary: "Them anh cho mon an",
        description: "Them 1 anh moi vao danh sach images cua mon an, toi da 10 anh/mon.",
    })
    @ApiParam({
        name: "id",
        type: String,
        example: "664f1a2b3c4d5e6f7a8b9001",
        description: "ObjectId nha hang",
    })
    @ApiParam({
        name: "item_id",
        type: String,
        example: "664f1a2b3c4d5e6f7a8b9201",
        description: "ObjectId mon an",
    })
    @ApiBody({ type: AddMenuItemImageDto })
    @ApiOkResponse({
        description: "Them anh mon an thanh cong",
        schema: swWrap({ $ref: getSchemaPath(MenuItemImagesMutationResponseDto) }),
    })
    @ApiBadRequestResponse({ description: "Payload anh khong hop le hoac da dat toi da anh/mon." })
    @ApiNotFoundResponse({ description: "Khong tim thay mon an hoac nha hang." })
    @ApiTooManyRequestsResponse({ description: "Vuot gioi han ghi menu hoac gioi han upload anh." })
    @ApiUnauthorizedResponse({ description: "Thieu hoac sai Bearer token." })
    @ApiForbiddenResponse({ description: "Khong co quyen cap nhat anh mon an." })
    @ApiInternalServerErrorResponse({ description: "Loi noi bo may chu." })
    @Post("items/:item_id/images")
    @RestaurantRoles(RESTAURANT_ROLE.OWNER)
    async addItemImage(
        @Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
        @Param("item_id", ParseObjectIdPipe) itemId: Types.ObjectId,
        @Body() payload: AddMenuItemImageDto,
    ) {
        return this.menuService.addItemImage(restaurantId, itemId, payload);
    }

    @ApiOperation({
        summary: "Xoa anh mon an theo index",
        description: "Xoa 1 anh trong mang images theo vi tri index.",
    })
    @ApiParam({
        name: "id",
        type: String,
        example: "664f1a2b3c4d5e6f7a8b9001",
        description: "ObjectId nha hang",
    })
    @ApiParam({
        name: "item_id",
        type: String,
        example: "664f1a2b3c4d5e6f7a8b9201",
        description: "ObjectId mon an",
    })
    @ApiParam({
        name: "index",
        type: Number,
        example: 0,
        description: "Vi tri anh can xoa trong mang images (>=0)",
    })
    @ApiOkResponse({
        description: "Xoa anh mon an thanh cong",
        schema: swWrap({ $ref: getSchemaPath(MenuItemImagesMutationResponseDto) }),
    })
    @ApiBadRequestResponse({ description: "index khong hop le hoac id khong hop le." })
    @ApiNotFoundResponse({ description: "Khong tim thay mon an, nha hang hoac anh tai vi tri index." })
    @ApiTooManyRequestsResponse({ description: "Vuot gioi han ghi menu trong 1 phut." })
    @ApiUnauthorizedResponse({ description: "Thieu hoac sai Bearer token." })
    @ApiForbiddenResponse({ description: "Khong co quyen cap nhat anh mon an." })
    @ApiInternalServerErrorResponse({ description: "Loi noi bo may chu." })
    @Delete("items/:item_id/images/:index")
    @RestaurantRoles(RESTAURANT_ROLE.OWNER)
    async removeItemImage(
        @Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
        @Param("item_id", ParseObjectIdPipe) itemId: Types.ObjectId,
        @Param("index", ParseIntPipe) index: number,
    ) {
        return this.menuService.removeItemImage(restaurantId, itemId, index);
    }

    @ApiOperation({
        summary: "Xoa mem mon an",
        description: "Soft delete mon an bang cach set deleted_at va is_available=false.",
    })
    @ApiParam({
        name: "id",
        type: String,
        example: "664f1a2b3c4d5e6f7a8b9001",
        description: "ObjectId nha hang",
    })
    @ApiParam({
        name: "item_id",
        type: String,
        example: "664f1a2b3c4d5e6f7a8b9201",
        description: "ObjectId mon an",
    })
    @ApiOkResponse({
        description: "Xoa mem mon an thanh cong",
        schema: swWrap({ $ref: getSchemaPath(DeleteResponseDto) }),
    })
    @ApiBadRequestResponse({ description: "id hoac item_id khong hop le." })
    @ApiNotFoundResponse({ description: "Khong tim thay mon an hoac nha hang." })
    @ApiTooManyRequestsResponse({ description: "Vuot gioi han ghi menu trong 1 phut." })
    @ApiUnauthorizedResponse({ description: "Thieu hoac sai Bearer token." })
    @ApiForbiddenResponse({ description: "Khong co quyen xoa mon an." })
    @ApiInternalServerErrorResponse({ description: "Loi noi bo may chu." })
    @Delete("items/:item_id")
    @RestaurantRoles(RESTAURANT_ROLE.OWNER)
    async softDeleteItem(
        @Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
        @Param("item_id", ParseObjectIdPipe) itemId: Types.ObjectId,
    ) {
        return this.menuService.softDeleteItem(restaurantId, itemId);
    }

}

@ApiTags("public-menu")
@ApiExtraModels(PublicMenuBySlugResponseDto, PublicMenuSearchResponseDto)
@Controller("public/restaurants/:slug/menu")
export class PublicMenuController {
    constructor(
        private readonly menuService: MenuService,
    ) {}

    @ApiOperation({
        summary: "Lay menu public theo slug",
        description: "Tra ve thong tin nha hang va danh sach category active + item available cho client public.",
    })
    @ApiParam({
        name: "slug",
        type: String,
        example: "bep-nha-viet",
        description: "Slug nha hang",
    })
    @ApiOkResponse({
        description: "Menu public theo nha hang",
        schema: swWrap({ $ref: getSchemaPath(PublicMenuBySlugResponseDto) }),
    })
    @ApiBadRequestResponse({ description: "Slug khong hop le." })
    @ApiNotFoundResponse({ description: "Khong tim thay nha hang hoac nha hang chua publish." })
    @ApiInternalServerErrorResponse({ description: "Loi noi bo may chu." })
    @Get()
    @Public()
    async getPublicMenuBySlug(
        @Param("slug", SlugValidationPipe) slug: string,
    ) {
        return this.menuService.getPublicMenuBySlug(slug);
    }

    @ApiOperation({
        summary: "Tim kiem mon an public",
        description: "Tim kiem full-text tren mon available cua nha hang da publish.",
    })
    @ApiParam({
        name: "slug",
        type: String,
        example: "bep-nha-viet",
        description: "Slug nha hang",
    })
    @ApiQuery({ name: "q", required: true, type: String, example: "pho", description: "Tu khoa tim kiem" })
    @ApiQuery({ name: "page", required: false, type: Number, example: 1, description: "Trang hien tai (>=1)" })
    @ApiQuery({ name: "limit", required: false, type: Number, example: 20, description: "So ket qua moi trang (1-50)" })
    @ApiOkResponse({
        description: "Ket qua tim kiem mon an public",
        schema: swWrap({ $ref: getSchemaPath(PublicMenuSearchResponseDto) }),
    })
    @ApiBadRequestResponse({ description: "Slug/query khong hop le." })
    @ApiNotFoundResponse({ description: "Khong tim thay nha hang hoac nha hang chua publish." })
    @ApiTooManyRequestsResponse({ description: "Vuot gioi han tim kiem public menu (60 lan/phut/IP)." })
    @ApiInternalServerErrorResponse({ description: "Loi noi bo may chu." })
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
