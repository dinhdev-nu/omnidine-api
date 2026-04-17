import {
	ParseIntPipe,
	Body,
	Controller,
	Delete,
	Get,
	Param,
	Patch,
	Post,
	Put,
	Query,
} from "@nestjs/common";
import { Types } from "mongoose";
import { RESTAURANT_ROLE } from "src/common/constants/restaurant-role.constant";
import { ROLE } from "src/common/constants/role.constant";
import {
	CurrentUser,
	Public,
	RestaurantRoles,
	Roles,
	ThrottleCustom,
} from "src/common/decorators";
import { ParseObjectIdPipe } from "src/common/pipes/parse-id.pipe";
import { SlugValidationPipe } from "src/common/pipes/slug.pipe";
import { AccessTokenPayload } from "../auth/auth.service.xxx";
import {
	AddRestaurantGalleryImageDto,
	CreateRestaurantDto,
	OwnerRestaurantListQueryDto,
	SearchRestaurantDto,
	UpdateOnlineOrdersDto,
	UpdateRestaurantCoverDto,
	UpdateOperatingHoursDto,
	UpdateRestaurantLogoDto,
	UpdateRestaurantSettingsDto,
	UpdatePublishStatusDto,
	UpdateRestaurantDto,
	UpdateRestaurantfinancialDto,
} from "./dto/restaurant.dto";
import { RestaurantService } from "./services";

@Controller("restaurants")
@Roles(ROLE.ADMIN, ROLE.USER)
export class RestaurantController {

	constructor(
		private readonly restaurantService: RestaurantService,
	) {}

	@Post("check-slug")
	@Public()
	@ThrottleCustom("restaurant-check-slug", { ttl: 60_000, limit: 30 })
	async checkSlug(
		@Body("slug", SlugValidationPipe) slug: string,
	): Promise<{ available: boolean }> {
		return this.restaurantService.checkRestaurantSlug(slug);
	}

	@Post()
	async createRestaurant(
		@Body() dto: CreateRestaurantDto,
		@CurrentUser("sub") ownerId: Types.ObjectId,
	) {
		return this.restaurantService.create(dto, ownerId);
	}

	@Get()
    @RestaurantRoles(RESTAURANT_ROLE.OWNER)
	async getRestaurantsByOwner(
		@CurrentUser() user: AccessTokenPayload,
		@Query() query: OwnerRestaurantListQueryDto,
	) {
		const ownerId = user.system_role === ROLE.ADMIN && query.owner_id
			? new Types.ObjectId(query.owner_id)
			: new Types.ObjectId(user.sub);

		return this.restaurantService.getRestaurantsByOwner(ownerId, {
			page: query.page,
			limit: query.limit,
			status: query.status,
		});
	}

	@Get(":id")
	@RestaurantRoles(RESTAURANT_ROLE.OWNER, RESTAURANT_ROLE.STAFF)
	async getRestaurantDetail(
		@Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
		@CurrentUser("sub") userId: Types.ObjectId,
	) {
		return this.restaurantService.getRestaurantDetails(restaurantId, userId);
	}

	@Patch(":id")
	@RestaurantRoles(RESTAURANT_ROLE.OWNER)
	async updateRestaurant(
		@Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
		@CurrentUser("sub") userId: Types.ObjectId,
		@Body() dto: UpdateRestaurantDto,
	) {
		await this.restaurantService.updateRestaurant(dto, restaurantId, userId);
		return { updated: true };
	}

	@Patch(":id/hours")
	@RestaurantRoles(RESTAURANT_ROLE.OWNER)
	async updateOperatingHours(
		@Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
		@Body() dto: UpdateOperatingHoursDto,
	) {
		await this.restaurantService.updateOperatingHours(dto, restaurantId);
		return { updated: true };
	}

	@Patch(":id/financial")
	@RestaurantRoles(RESTAURANT_ROLE.OWNER)
	async updateFinancial(
		@Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
		@Body() dto: UpdateRestaurantfinancialDto,
	) {
		await this.restaurantService.updateFinancialSettings(dto, restaurantId);
		return { updated: true };
	}

	@Patch(":id/settings")
	@RestaurantRoles(RESTAURANT_ROLE.OWNER)
	async updateSettings(
		@Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
		@Body() dto: UpdateRestaurantSettingsDto,
	) {
		return this.restaurantService.updateRestaurantSettings(dto, restaurantId);
	}

	@Patch(":id/publish")
	@RestaurantRoles(RESTAURANT_ROLE.OWNER)
	async updatePublishStatus(
		@Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
		@Body() dto: UpdatePublishStatusDto,
	): Promise<{ is_published: boolean; message: string }> {
		return this.restaurantService.updatePublishStatus(dto.is_published, restaurantId);
	}

	@Patch(":id/online-orders")
	@RestaurantRoles(RESTAURANT_ROLE.OWNER)
	async updateOnlineOrders(
		@Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
		@Body() dto: UpdateOnlineOrdersDto,
	): Promise<{ accepts_online_orders: boolean; message: string }> {
		return this.restaurantService.updateAcceptOnlineOrders(dto.accepts_online_orders, restaurantId);
	}

	@Put(":id/logo")
	@RestaurantRoles(RESTAURANT_ROLE.OWNER)
	async updateRestaurantLogo(
		@Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
		@Body() dto: UpdateRestaurantLogoDto,
	): Promise<{ logo_url: string }> {
		return this.restaurantService.updateRestaurantLogo(dto, restaurantId);
	}

	@Put(":id/cover")
	@RestaurantRoles(RESTAURANT_ROLE.OWNER)
	async updateRestaurantCover(
		@Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
		@Body() dto: UpdateRestaurantCoverDto,
	): Promise<{ cover_image_url: string }> {
		return this.restaurantService.updateRestaurantCover(dto, restaurantId);
	}

	@Post(":id/gallery")
	@RestaurantRoles(RESTAURANT_ROLE.OWNER)
	async addRestaurantGalleryImage(
		@Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
		@Body() dto: AddRestaurantGalleryImageDto,
	): Promise<{ gallery_urls: string[]; count: number }> {
		return this.restaurantService.addRestaurantGalleryImage(dto, restaurantId);
	}

	@Delete(":id/gallery/:index")
	@RestaurantRoles(RESTAURANT_ROLE.OWNER)
	async removeRestaurantGalleryImage(
		@Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
		@Param("index", ParseIntPipe) index: number,
	): Promise<{ gallery_urls: string[]; count: number }> {
		return this.restaurantService.removeRestaurantGalleryImage(index, restaurantId);
	}

	@Delete(":id")
	@RestaurantRoles(RESTAURANT_ROLE.OWNER)
	async deleteRestaurant(
		@Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
	): Promise<{ deleted: boolean; message: string }> {
		return this.restaurantService.deleteRestaurant(restaurantId);
	}

}

@Controller("public/restaurants")
export class PublicRestaurantController {

	constructor(
		private readonly restaurantService: RestaurantService,
	) {}

	@Get()
	@Public()
	@ThrottleCustom("public-restaurant-search", { ttl: 60_000, limit: 60 })
	async searchPublicRestaurants(
		@Query() dto: SearchRestaurantDto,
	) {
		return this.restaurantService.searchRestaurants(dto);
	}

	@Get(":slug")
	@Public()
	async getPublicRestaurantBySlug(
		@Param("slug", SlugValidationPipe) slug: string,
	) {
		return this.restaurantService.getRestaurantDetailsBySlug(slug);
	}

}