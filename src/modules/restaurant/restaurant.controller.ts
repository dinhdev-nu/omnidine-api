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
	CurrentUser,
	Public,
	RestaurantRoles,
	Roles,
	ThrottleCustom,
} from "src/common/decorators";
import { ParseObjectIdPipe } from "src/common/pipes/parse-id.pipe";
import { SlugValidationPipe } from "src/common/pipes/slug.pipe";
import { AccessTokenPayload } from "../auth/auth.service";
import {
	AddRestaurantGalleryImageDto,
	CreateRestaurantDto,
	DeleteRestaurantResponseDto,
	GalleryMutationResponseDto,
	OwnerRestaurantListQueryDto,
	OwnerRestaurantListResponseDto,
	RestaurantDocumentResponseDto,
	RestaurantPublicDetailResponseDto,
	RestaurantSettingsUpdateResponseDto,
	RestaurantStaffDetailResponseDto,
	SearchRestaurantDto,
	SearchRestaurantResponseDto,
	SlugAvailabilityResponseDto,
	UpdateOnlineOrdersDto,
	UpdateOnlineOrdersResponseDto,
	UpdatePublishStatusResponseDto,
	UpdateRestaurantCoverDto,
	UpdateRestaurantCoverResponseDto,
	UpdatedResponseDto,
	UpdateOperatingHoursDto,
	UpdateRestaurantLogoDto,
	UpdateRestaurantLogoResponseDto,
	UpdateRestaurantSettingsDto,
	UpdatePublishStatusDto,
	UpdateRestaurantDto,
	UpdateRestaurantfinancialDto,
} from "./dto/restaurant.dto";
import { swWrap } from "src/common/swagger/api-response.util";
import { RestaurantService } from "./restaurant.service";

@ApiTags("restaurants")
@ApiExtraModels(
	SlugAvailabilityResponseDto,
	RestaurantDocumentResponseDto,
	RestaurantStaffDetailResponseDto,
	OwnerRestaurantListResponseDto,
	UpdatedResponseDto,
	RestaurantSettingsUpdateResponseDto,
	UpdatePublishStatusResponseDto,
	UpdateOnlineOrdersResponseDto,
	UpdateRestaurantLogoResponseDto,
	UpdateRestaurantCoverResponseDto,
	GalleryMutationResponseDto,
	DeleteRestaurantResponseDto,
)
@Controller("restaurants")
@Roles(ROLE.ADMIN, ROLE.USER)
export class RestaurantController {

	constructor(
		private readonly restaurantService: RestaurantService,
	) {}

	@ApiOperation({
		summary: "Kiểm tra slug khả dụng",
		description: "Kiểm tra slug đã tồn tại trong hệ thống hay chưa trước khi tạo nhà hàng.",
	})
	@ApiBody({
		schema: {
			type: "object",
			required: ["slug"],
			properties: {
				slug: {
					type: "string",
					example: "bep-nha-viet",
					description: "Slug cần kiểm tra",
					pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
				},
			},
		},
	})
	@ApiOkResponse({
		description: "Kết quả kiểm tra slug",
		schema: swWrap({ $ref: getSchemaPath(SlugAvailabilityResponseDto) }),
	})
	@ApiBadRequestResponse({ description: "Slug không hợp lệ." })
	@ApiTooManyRequestsResponse({ description: "Vượt giới hạn kiểm tra slug (30 lần/phút/IP)." })
	@ApiInternalServerErrorResponse({ description: "Lỗi nội bộ máy chủ." })
	@Post("check-slug")
	@Public()
	@ThrottleCustom("restaurant-check-slug", { ttl: 60_000, limit: 30 })
	async checkSlug(
		@Body("slug", SlugValidationPipe) slug: string,
	): Promise<SlugAvailabilityResponseDto> {
		return this.restaurantService.checkRestaurantSlug(slug);
	}

	@ApiBearerAuth()
	@ApiOperation({
		summary: "Tạo nhà hàng mới",
		description: "Tạo nhà hàng cho owner hiện tại. Owner tối đa 10 nhà hàng.",
	})
	@ApiBody({ type: CreateRestaurantDto })
	@ApiOkResponse({
		description: "Tạo nhà hàng thành công",
		schema: swWrap({ $ref: getSchemaPath(RestaurantDocumentResponseDto) }),
	})
	@ApiBadRequestResponse({ description: "Dữ liệu đầu vào không hợp lệ hoặc operating_hours không hợp lệ." })
	@ApiConflictResponse({ description: "Slug đã tồn tại hoặc xung đột dữ liệu." })
	@ApiForbiddenResponse({ description: "Owner đã đạt giới hạn số lượng nhà hàng cho phép." })
	@ApiTooManyRequestsResponse({ description: "Vượt giới hạn tạo nhà hàng trong ngày." })
	@ApiUnauthorizedResponse({ description: "Thiếu hoặc sai Bearer token." })
	@ApiInternalServerErrorResponse({ description: "Lỗi nội bộ máy chủ." })
	@Post()
	async createRestaurant(
		@Body() dto: CreateRestaurantDto,
		@CurrentUser("sub") ownerId: Types.ObjectId,
	) {
		return this.restaurantService.create(dto, ownerId);
	}

	@ApiBearerAuth()
	@ApiOperation({
		summary: "Lấy danh sách nhà hàng theo owner",
		description: "Owner lấy danh sách nhà hàng của chính mình; admin có thể truyền owner_id để truy vấn owner khác.",
	})
	@ApiQuery({ name: "page", required: false, type: Number, example: 1, description: "Trang hiện tại (>=1)" })
	@ApiQuery({ name: "limit", required: false, type: Number, example: 10, description: "Số bản ghi mỗi trang (1-50)" })
	@ApiQuery({ name: "status", required: false, enum: ["published"], description: "Lọc nhà hàng đã xuất bản" })
	@ApiQuery({
		name: "owner_id",
		required: false,
		type: String,
		example: "664f1a2b3c4d5e6f7a8b9c0d",
		description: "Chỉ áp dụng với tài khoản admin",
	})
	@ApiOkResponse({
		description: "Danh sách nhà hàng theo owner",
		schema: swWrap({ $ref: getSchemaPath(OwnerRestaurantListResponseDto) }),
	})
	@ApiBadRequestResponse({ description: "Query không hợp lệ (page/limit/status/owner_id)." })
	@ApiUnauthorizedResponse({ description: "Thiếu hoặc sai Bearer token." })
	@ApiForbiddenResponse({ description: "Không có quyền truy cập tài nguyên nhà hàng." })
	@ApiInternalServerErrorResponse({ description: "Lỗi nội bộ máy chủ." })
	@Get()
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

	@ApiBearerAuth()
	@ApiOperation({
		summary: "Lấy chi tiết nhà hàng (private)",
		description: "Owner/Admin nhận đầy đủ field; Staff bị ẩn tax_rate, service_charge_rate, settings.",
	})
	@ApiParam({
		name: "id",
		type: String,
		example: "664f1a2b3c4d5e6f7a8b9c0d",
		description: "Restaurant ObjectId",
	})
	@ApiOkResponse({
		description: "Chi tiết nhà hàng theo vai trò truy cập",
		schema: swWrap({
			oneOf: [
				{ $ref: getSchemaPath(RestaurantDocumentResponseDto) },
				{ $ref: getSchemaPath(RestaurantStaffDetailResponseDto) },
			],
		}),
	})
	@ApiBadRequestResponse({ description: "Restaurant id không hợp lệ." })
	@ApiNotFoundResponse({ description: "Không tìm thấy nhà hàng." })
	@ApiUnauthorizedResponse({ description: "Thiếu hoặc sai Bearer token." })
	@ApiForbiddenResponse({ description: "Không có quyền truy cập nhà hàng này." })
	@ApiInternalServerErrorResponse({ description: "Lỗi nội bộ máy chủ." })
	@Get(":id")
	@RestaurantRoles(RESTAURANT_ROLE.OWNER, RESTAURANT_ROLE.STAFF)
	async getRestaurantDetail(
		@Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
		@CurrentUser("sub") userId: Types.ObjectId,
	) {
		return this.restaurantService.getRestaurantDetails(restaurantId, userId);
	}

	@ApiBearerAuth()
	@ApiOperation({
		summary: "Cập nhật thông tin cơ bản nhà hàng",
		description: "Cập nhật partial các field cơ bản, không bao gồm slug và operating_hours.",
	})
	@ApiParam({
		name: "id",
		type: String,
		example: "664f1a2b3c4d5e6f7a8b9c0d",
		description: "Restaurant ObjectId",
	})
	@ApiBody({ type: UpdateRestaurantDto })
	@ApiOkResponse({
		description: "Cập nhật thành công",
		schema: swWrap({ $ref: getSchemaPath(UpdatedResponseDto) }),
	})
	@ApiBadRequestResponse({ description: "Payload không hợp lệ hoặc dữ liệu không thỏa ràng buộc." })
	@ApiNotFoundResponse({ description: "Không tìm thấy nhà hàng." })
	@ApiTooManyRequestsResponse({ description: "Vượt giới hạn cập nhật nhà hàng." })
	@ApiUnauthorizedResponse({ description: "Thiếu hoặc sai Bearer token." })
	@ApiForbiddenResponse({ description: "Không có quyền cập nhật nhà hàng." })
	@ApiInternalServerErrorResponse({ description: "Lỗi nội bộ máy chủ." })
	@Patch(":id")
	@RestaurantRoles(RESTAURANT_ROLE.OWNER)
	async updateRestaurant(
		@Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
		@CurrentUser("sub") userId: Types.ObjectId,
		@Body() dto: UpdateRestaurantDto,
	): Promise<UpdatedResponseDto> {
		await this.restaurantService.updateRestaurant(dto, restaurantId, userId);
		return { updated: true };
	}

	@ApiBearerAuth()
	@ApiOperation({
		summary: "Cập nhật giờ mở cửa",
		description: "Cập nhật cấu hình operating_hours cho toàn bộ tuần.",
	})
	@ApiParam({
		name: "id",
		type: String,
		example: "664f1a2b3c4d5e6f7a8b9c0d",
		description: "Restaurant ObjectId",
	})
	@ApiBody({ type: UpdateOperatingHoursDto })
	@ApiOkResponse({
		description: "Cập nhật giờ mở cửa thành công",
		schema: swWrap({ $ref: getSchemaPath(UpdatedResponseDto) }),
	})
	@ApiBadRequestResponse({ description: "operating_hours không hợp lệ hoặc payload sai định dạng." })
	@ApiNotFoundResponse({ description: "Không tìm thấy nhà hàng." })
	@ApiTooManyRequestsResponse({ description: "Vượt giới hạn cập nhật nhà hàng." })
	@ApiUnauthorizedResponse({ description: "Thiếu hoặc sai Bearer token." })
	@ApiForbiddenResponse({ description: "Không có quyền cập nhật giờ mở cửa." })
	@ApiInternalServerErrorResponse({ description: "Lỗi nội bộ máy chủ." })
	@Patch(":id/hours")
	@RestaurantRoles(RESTAURANT_ROLE.OWNER)
	async updateOperatingHours(
		@Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
		@Body() dto: UpdateOperatingHoursDto,
	): Promise<UpdatedResponseDto> {
		await this.restaurantService.updateOperatingHours(dto, restaurantId);
		return { updated: true };
	}

	@ApiBearerAuth()
	@ApiOperation({
		summary: "Cập nhật cấu hình tài chính",
		description: "Cập nhật tax_rate, currency và service_charge_rate của nhà hàng.",
	})
	@ApiParam({
		name: "id",
		type: String,
		example: "664f1a2b3c4d5e6f7a8b9c0d",
		description: "Restaurant ObjectId",
	})
	@ApiBody({ type: UpdateRestaurantfinancialDto })
	@ApiOkResponse({
		description: "Cập nhật tài chính thành công",
		schema: swWrap({ $ref: getSchemaPath(UpdatedResponseDto) }),
	})
	@ApiBadRequestResponse({ description: "Dữ liệu tài chính không hợp lệ." })
	@ApiNotFoundResponse({ description: "Không tìm thấy nhà hàng." })
	@ApiTooManyRequestsResponse({ description: "Vượt giới hạn cập nhật nhà hàng." })
	@ApiUnauthorizedResponse({ description: "Thiếu hoặc sai Bearer token." })
	@ApiForbiddenResponse({ description: "Không có quyền cập nhật tài chính nhà hàng." })
	@ApiInternalServerErrorResponse({ description: "Lỗi nội bộ máy chủ." })
	@Patch(":id/financial")
	@RestaurantRoles(RESTAURANT_ROLE.OWNER)
	async updateFinancial(
		@Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
		@Body() dto: UpdateRestaurantfinancialDto,
	): Promise<UpdatedResponseDto> {
		await this.restaurantService.updateFinancialSettings(dto, restaurantId);
		return { updated: true };
	}

	@ApiBearerAuth()
	@ApiOperation({
		summary: "Cập nhật settings nhà hàng",
		description: "Merge patch settings theo whitelist key cho phép.",
	})
	@ApiParam({
		name: "id",
		type: String,
		example: "664f1a2b3c4d5e6f7a8b9c0d",
		description: "Restaurant ObjectId",
	})
	@ApiBody({ type: UpdateRestaurantSettingsDto })
	@ApiOkResponse({
		description: "Cập nhật settings thành công",
		schema: swWrap({ $ref: getSchemaPath(RestaurantSettingsUpdateResponseDto) }),
	})
	@ApiBadRequestResponse({ description: "settings rỗng, sai type hoặc chứa key không hợp lệ." })
	@ApiNotFoundResponse({ description: "Không tìm thấy nhà hàng." })
	@ApiTooManyRequestsResponse({ description: "Vượt giới hạn cập nhật nhà hàng." })
	@ApiUnauthorizedResponse({ description: "Thiếu hoặc sai Bearer token." })
	@ApiForbiddenResponse({ description: "Không có quyền cập nhật settings nhà hàng." })
	@ApiInternalServerErrorResponse({ description: "Lỗi nội bộ máy chủ." })
	@Patch(":id/settings")
	@RestaurantRoles(RESTAURANT_ROLE.OWNER)
	async updateSettings(
		@Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
		@Body() dto: UpdateRestaurantSettingsDto,
	): Promise<RestaurantSettingsUpdateResponseDto> {
		return this.restaurantService.updateRestaurantSettings(dto, restaurantId);
	}

	@ApiBearerAuth()
	@ApiOperation({
		summary: "Cập nhật trạng thái xuất bản",
		description: "Bật/tắt is_published. Khi publish yêu cầu nhà hàng đủ dữ liệu bắt buộc.",
	})
	@ApiParam({
		name: "id",
		type: String,
		example: "664f1a2b3c4d5e6f7a8b9c0d",
		description: "Restaurant ObjectId",
	})
	@ApiBody({ type: UpdatePublishStatusDto })
	@ApiOkResponse({
		description: "Cập nhật trạng thái xuất bản thành công",
		schema: swWrap({ $ref: getSchemaPath(UpdatePublishStatusResponseDto) }),
	})
	@ApiBadRequestResponse({ description: "Dữ liệu không hợp lệ hoặc chưa đủ điều kiện publish." })
	@ApiNotFoundResponse({ description: "Không tìm thấy nhà hàng." })
	@ApiTooManyRequestsResponse({ description: "Vượt giới hạn cập nhật nhà hàng." })
	@ApiUnauthorizedResponse({ description: "Thiếu hoặc sai Bearer token." })
	@ApiForbiddenResponse({ description: "Không có quyền cập nhật trạng thái xuất bản." })
	@ApiInternalServerErrorResponse({ description: "Lỗi nội bộ máy chủ." })
	@Patch(":id/publish")
	@RestaurantRoles(RESTAURANT_ROLE.OWNER)
	async updatePublishStatus(
		@Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
		@Body() dto: UpdatePublishStatusDto,
	): Promise<UpdatePublishStatusResponseDto> {
		return this.restaurantService.updatePublishStatus(dto.is_published, restaurantId);
	}

	@ApiBearerAuth()
	@ApiOperation({
		summary: "Cập nhật trạng thái nhận đơn online",
		description: "Bật/tắt accepts_online_orders. Chỉ bật được khi nhà hàng đã publish.",
	})
	@ApiParam({
		name: "id",
		type: String,
		example: "664f1a2b3c4d5e6f7a8b9c0d",
		description: "Restaurant ObjectId",
	})
	@ApiBody({ type: UpdateOnlineOrdersDto })
	@ApiOkResponse({
		description: "Cập nhật trạng thái nhận đơn online thành công",
		schema: swWrap({ $ref: getSchemaPath(UpdateOnlineOrdersResponseDto) }),
	})
	@ApiBadRequestResponse({ description: "Dữ liệu không hợp lệ hoặc chưa publish nhưng yêu cầu bật online orders." })
	@ApiNotFoundResponse({ description: "Không tìm thấy nhà hàng." })
	@ApiTooManyRequestsResponse({ description: "Vượt giới hạn cập nhật nhà hàng." })
	@ApiUnauthorizedResponse({ description: "Thiếu hoặc sai Bearer token." })
	@ApiForbiddenResponse({ description: "Không có quyền cập nhật trạng thái nhận đơn online." })
	@ApiInternalServerErrorResponse({ description: "Lỗi nội bộ máy chủ." })
	@Patch(":id/online-orders")
	@RestaurantRoles(RESTAURANT_ROLE.OWNER)
	async updateOnlineOrders(
		@Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
		@Body() dto: UpdateOnlineOrdersDto,
	): Promise<UpdateOnlineOrdersResponseDto> {
		return this.restaurantService.updateAcceptOnlineOrders(dto.accepts_online_orders, restaurantId);
	}

	@ApiBearerAuth()
	@ApiOperation({
		summary: "Cập nhật logo nhà hàng",
		description: "Cập nhật logo_url. URL phải là HTTPS, đuôi ảnh hợp lệ và thuộc trusted storage host.",
	})
	@ApiParam({
		name: "id",
		type: String,
		example: "664f1a2b3c4d5e6f7a8b9c0d",
		description: "Restaurant ObjectId",
	})
	@ApiBody({ type: UpdateRestaurantLogoDto })
	@ApiOkResponse({
		description: "Cập nhật logo thành công",
		schema: swWrap({ $ref: getSchemaPath(UpdateRestaurantLogoResponseDto) }),
	})
	@ApiBadRequestResponse({ description: "URL logo không hợp lệ hoặc không thuộc trusted host." })
	@ApiNotFoundResponse({ description: "Không tìm thấy nhà hàng." })
	@ApiTooManyRequestsResponse({ description: "Vượt giới hạn cập nhật ảnh trong giờ." })
	@ApiUnauthorizedResponse({ description: "Thiếu hoặc sai Bearer token." })
	@ApiForbiddenResponse({ description: "Không có quyền cập nhật logo nhà hàng." })
	@ApiInternalServerErrorResponse({ description: "Lỗi nội bộ máy chủ." })
	@Put(":id/logo")
	@RestaurantRoles(RESTAURANT_ROLE.OWNER)
	async updateRestaurantLogo(
		@Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
		@Body() dto: UpdateRestaurantLogoDto,
	): Promise<UpdateRestaurantLogoResponseDto> {
		return this.restaurantService.updateRestaurantLogo(dto, restaurantId);
	}

	@ApiBearerAuth()
	@ApiOperation({
		summary: "Cập nhật ảnh bìa nhà hàng",
		description: "Cập nhật cover_image_url. URL phải là HTTPS, đuôi ảnh hợp lệ và thuộc trusted storage host.",
	})
	@ApiParam({
		name: "id",
		type: String,
		example: "664f1a2b3c4d5e6f7a8b9c0d",
		description: "Restaurant ObjectId",
	})
	@ApiBody({ type: UpdateRestaurantCoverDto })
	@ApiOkResponse({
		description: "Cập nhật ảnh bìa thành công",
		schema: swWrap({ $ref: getSchemaPath(UpdateRestaurantCoverResponseDto) }),
	})
	@ApiBadRequestResponse({ description: "URL ảnh bìa không hợp lệ hoặc không thuộc trusted host." })
	@ApiNotFoundResponse({ description: "Không tìm thấy nhà hàng." })
	@ApiTooManyRequestsResponse({ description: "Vượt giới hạn cập nhật ảnh trong giờ." })
	@ApiUnauthorizedResponse({ description: "Thiếu hoặc sai Bearer token." })
	@ApiForbiddenResponse({ description: "Không có quyền cập nhật ảnh bìa nhà hàng." })
	@ApiInternalServerErrorResponse({ description: "Lỗi nội bộ máy chủ." })
	@Put(":id/cover")
	@RestaurantRoles(RESTAURANT_ROLE.OWNER)
	async updateRestaurantCover(
		@Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
		@Body() dto: UpdateRestaurantCoverDto,
	): Promise<UpdateRestaurantCoverResponseDto> {
		return this.restaurantService.updateRestaurantCover(dto, restaurantId);
	}

	@ApiBearerAuth()
	@ApiOperation({
		summary: "Thêm ảnh vào gallery nhà hàng",
		description: "Thêm 1 ảnh vào gallery_urls, tối đa 20 ảnh/gallery.",
	})
	@ApiParam({
		name: "id",
		type: String,
		example: "664f1a2b3c4d5e6f7a8b9c0d",
		description: "Restaurant ObjectId",
	})
	@ApiBody({ type: AddRestaurantGalleryImageDto })
	@ApiOkResponse({
		description: "Thêm ảnh gallery thành công",
		schema: swWrap({ $ref: getSchemaPath(GalleryMutationResponseDto) }),
	})
	@ApiBadRequestResponse({ description: "URL ảnh không hợp lệ hoặc đã đạt giới hạn gallery." })
	@ApiNotFoundResponse({ description: "Không tìm thấy nhà hàng." })
	@ApiTooManyRequestsResponse({ description: "Vượt giới hạn cập nhật ảnh trong giờ." })
	@ApiUnauthorizedResponse({ description: "Thiếu hoặc sai Bearer token." })
	@ApiForbiddenResponse({ description: "Không có quyền cập nhật gallery nhà hàng." })
	@ApiInternalServerErrorResponse({ description: "Lỗi nội bộ máy chủ." })
	@Post(":id/gallery")
	@RestaurantRoles(RESTAURANT_ROLE.OWNER)
	async addRestaurantGalleryImage(
		@Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
		@Body() dto: AddRestaurantGalleryImageDto,
	): Promise<GalleryMutationResponseDto> {
		return this.restaurantService.addRestaurantGalleryImage(dto, restaurantId);
	}

	@ApiBearerAuth()
	@ApiOperation({
		summary: "Xóa ảnh khỏi gallery theo vị trí",
		description: "Xóa ảnh tại chỉ mục index trong gallery_urls.",
	})
	@ApiParam({
		name: "id",
		type: String,
		example: "664f1a2b3c4d5e6f7a8b9c0d",
		description: "Restaurant ObjectId",
	})
	@ApiParam({
		name: "index",
		type: Number,
		example: 0,
		description: "Vị trí ảnh trong mảng gallery_urls (>=0)",
	})
	@ApiOkResponse({
		description: "Xóa ảnh gallery thành công",
		schema: swWrap({ $ref: getSchemaPath(GalleryMutationResponseDto) }),
	})
	@ApiBadRequestResponse({ description: "id/index không hợp lệ hoặc index < 0." })
	@ApiNotFoundResponse({ description: "Không tìm thấy nhà hàng hoặc ảnh không tồn tại trong gallery." })
	@ApiUnauthorizedResponse({ description: "Thiếu hoặc sai Bearer token." })
	@ApiForbiddenResponse({ description: "Không có quyền cập nhật gallery nhà hàng." })
	@ApiInternalServerErrorResponse({ description: "Lỗi nội bộ máy chủ." })
	@Delete(":id/gallery/:index")
	@RestaurantRoles(RESTAURANT_ROLE.OWNER)
	async removeRestaurantGalleryImage(
		@Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
		@Param("index", ParseIntPipe) index: number,
	): Promise<GalleryMutationResponseDto> {
		return this.restaurantService.removeRestaurantGalleryImage(index, restaurantId);
	}

	@ApiBearerAuth()
	@ApiOperation({
		summary: "Xóa mềm nhà hàng",
		description: "Soft delete nhà hàng khi không còn đơn active.",
	})
	@ApiParam({
		name: "id",
		type: String,
		example: "664f1a2b3c4d5e6f7a8b9c0d",
		description: "Restaurant ObjectId",
	})
	@ApiOkResponse({
		description: "Xóa nhà hàng thành công",
		schema: swWrap({ $ref: getSchemaPath(DeleteRestaurantResponseDto) }),
	})
	@ApiBadRequestResponse({ description: "Restaurant id không hợp lệ." })
	@ApiNotFoundResponse({ description: "Không tìm thấy nhà hàng." })
	@ApiConflictResponse({ description: "Nhà hàng đang có đơn active nên không thể xoá." })
	@ApiTooManyRequestsResponse({ description: "Vượt giới hạn thao tác xóa/cập nhật nhà hàng." })
	@ApiUnauthorizedResponse({ description: "Thiếu hoặc sai Bearer token." })
	@ApiForbiddenResponse({ description: "Không có quyền xóa nhà hàng." })
	@ApiInternalServerErrorResponse({ description: "Lỗi nội bộ máy chủ." })
	@Delete(":id")
	@RestaurantRoles(RESTAURANT_ROLE.OWNER)
	async deleteRestaurant(
		@Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
	): Promise<DeleteRestaurantResponseDto> {
		return this.restaurantService.deleteRestaurant(restaurantId);
	}

}

@ApiTags("public-restaurants")
@ApiExtraModels(SearchRestaurantResponseDto, RestaurantPublicDetailResponseDto)
@Controller("public/restaurants")
export class PublicRestaurantController {

	constructor(
		private readonly restaurantService: RestaurantService,
	) {}

	@ApiOperation({
		summary: "Tìm kiếm nhà hàng public",
		description: "Tìm nhà hàng đã publish theo city, filter, keyword và geolocation.",
	})
	@ApiQuery({ name: "city", required: true, type: String, example: "Ho Chi Minh", description: "Thành phố" })
	@ApiQuery({ name: "cuisine_type", required: false, type: String, example: "Vietnamese", description: "Loại ẩm thực" })
	@ApiQuery({
		name: "price_range",
		required: false,
		type: String,
		example: "1,2",
		description: "Danh sách mức giá (1-4), truyền dạng comma-separated",
	})
	@ApiQuery({
		name: "accepts_online",
		required: false,
		type: Boolean,
		example: true,
		description: "Lọc nhà hàng nhận đơn online",
	})
	@ApiQuery({ name: "lat", required: false, type: Number, example: 10.7769, description: "Vĩ độ" })
	@ApiQuery({ name: "lng", required: false, type: Number, example: 106.7009, description: "Kinh độ" })
	@ApiQuery({ name: "radius_km", required: false, type: Number, example: 10, description: "Bán kính tìm kiếm (km)" })
	@ApiQuery({ name: "q", required: false, type: String, example: "pho", description: "Từ khóa tìm theo tên" })
	@ApiQuery({ name: "sort", required: false, enum: ["distance", "name"], example: "name", description: "Tiêu chí sắp xếp" })
	@ApiQuery({ name: "page", required: false, type: Number, example: 1, description: "Trang hiện tại" })
	@ApiQuery({ name: "limit", required: false, type: Number, example: 20, description: "Số bản ghi mỗi trang" })
	@ApiOkResponse({
		description: "Danh sách nhà hàng public",
		schema: swWrap({ $ref: getSchemaPath(SearchRestaurantResponseDto) }),
	})
	@ApiBadRequestResponse({ description: "Query không hợp lệ." })
	@ApiTooManyRequestsResponse({ description: "Vượt giới hạn tìm kiếm public (60 lần/phút/IP)." })
	@ApiInternalServerErrorResponse({ description: "Lỗi nội bộ máy chủ." })
	@Get()
	@Public()
	@ThrottleCustom("public-restaurant-search", { ttl: 60_000, limit: 60 })
	async searchPublicRestaurants(
		@Query() dto: SearchRestaurantDto,
	) {
		return this.restaurantService.searchRestaurants(dto);
	}

	@ApiOperation({
		summary: "Lấy chi tiết nhà hàng public theo slug",
		description: "Trả thông tin nhà hàng đã publish cho client public. owner_id và settings được ẩn.",
	})
	@ApiParam({
		name: "slug",
		type: String,
		example: "bep-nha-viet",
		description: "Slug của nhà hàng",
	})
	@ApiOkResponse({
		description: "Chi tiết nhà hàng public",
		schema: swWrap({ $ref: getSchemaPath(RestaurantPublicDetailResponseDto) }),
	})
	@ApiBadRequestResponse({ description: "Slug không hợp lệ." })
	@ApiNotFoundResponse({ description: "Không tìm thấy nhà hàng hoặc nhà hàng chưa publish." })
	@ApiInternalServerErrorResponse({ description: "Lỗi nội bộ máy chủ." })
	@Get(":slug")
	@Public()
	async getPublicRestaurantBySlug(
		@Param("slug", SlugValidationPipe) slug: string,
	) {
		return this.restaurantService.getRestaurantDetailsBySlug(slug);
	}

}
