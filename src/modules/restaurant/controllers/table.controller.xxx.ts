import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    Query,
    Req,
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
import { Request } from "express";
import { Types } from "mongoose";
import { RESTAURANT_ROLE, RestaurantRole } from "src/common/constants/restaurant-role.constant";
import { ROLE } from "src/common/constants/role.constant";
import {
    Public,
    RequireRestaurant,
    RestaurantRoles,
    Roles,
    ThrottleCustom,
} from "src/common/decorators";
import { ParseObjectIdPipe } from "src/common/pipes/parse-id.pipe";
import {
    CreateTableDto,
    DeleteTableResponseDto,
    ListTablesQueryDto,
    ListTablesResponseDto,
    PublicTableScanResponseDto,
    RegenerateTableQrResponseDto,
    TableDetailOwnerResponseDto,
    TableDetailStaffResponseDto,
    TablePersistedResponseDto,
    ToggleTableActiveResponseDto,
    UpdateTableDto,
    UpdateTableResponseDto,
    UpdateTableStatusDto,
    UpdateTableStatusResponseDto,
} from "../dto/table.dto";
import { TableService } from "../services";
import { CurrentActor } from "src/common/decorators/user/current-actor.decorator";
import { swWrap } from "src/common/swagger/api-response.util";

@ApiTags("tables")
@ApiBearerAuth()
@ApiExtraModels(
    TablePersistedResponseDto,
    ListTablesResponseDto,
    TableDetailOwnerResponseDto,
    TableDetailStaffResponseDto,
    UpdateTableResponseDto,
    UpdateTableStatusResponseDto,
    ToggleTableActiveResponseDto,
    RegenerateTableQrResponseDto,
    DeleteTableResponseDto,
)
@Controller("restaurants/:id/tables")
@Roles(ROLE.ADMIN, ROLE.USER)
export class TableController {
    constructor(
        private readonly tableService: TableService,
    ) {}

    @ApiOperation({
        summary: "Tao ban moi",
        description: "Owner tao ban moi cho nha hang, he thong check gioi han so ban va trung table_number.",
    })
    @ApiParam({
        name: "id",
        type: String,
        example: "664f1a2b3c4d5e6f7a8b9001",
        description: "ObjectId nha hang",
    })
    @ApiBody({ type: CreateTableDto })
    @ApiOkResponse({
        description: "Tao ban thanh cong",
        schema: swWrap({ $ref: getSchemaPath(TablePersistedResponseDto) }),
    })
    @ApiBadRequestResponse({ description: "Payload khong hop le, dat gioi han so ban, hoac id khong hop le." })
    @ApiNotFoundResponse({ description: "Khong tim thay nha hang hoac khong truy cap duoc context restaurant." })
    @ApiConflictResponse({ description: "table_number da ton tai trong nha hang." })
    @ApiTooManyRequestsResponse({ description: "Vuot gioi han thao tac ghi ban trong 1 phut." })
    @ApiUnauthorizedResponse({ description: "Thieu hoac sai Bearer token." })
    @ApiForbiddenResponse({ description: "Khong co quyen tao ban cho nha hang nay." })
    @ApiInternalServerErrorResponse({ description: "Loi noi bo may chu." })
    @Post()
    @RestaurantRoles(RESTAURANT_ROLE.OWNER)
    async createTable(
        @Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
        @Body() payload: CreateTableDto,
    ) {
        return this.tableService.createTable(restaurantId, payload);
    }

    @ApiOperation({
        summary: "Lay danh sach ban",
        description: "Lay danh sach ban theo bo loc. Owner/Admin thay them notes; staff khong thay notes.",
    })
    @ApiParam({
        name: "id",
        type: String,
        example: "664f1a2b3c4d5e6f7a8b9001",
        description: "ObjectId nha hang",
    })
    @ApiQuery({ name: "status", required: false, enum: ["available", "occupied", "reserved", "cleaning", "inactive"], description: "Loc theo trang thai ban" })
    @ApiQuery({ name: "is_active", required: false, type: Boolean, example: true, description: "Loc theo trang thai kich hoat" })
    @ApiQuery({ name: "capacity_min", required: false, type: Number, example: 2, description: "Suc chua toi thieu" })
    @ApiQuery({ name: "capacity_max", required: false, type: Number, example: 8, description: "Suc chua toi da" })
    @ApiOkResponse({
        description: "Danh sach ban",
        schema: swWrap({ $ref: getSchemaPath(ListTablesResponseDto) }),
    })
    @ApiBadRequestResponse({ description: "Query khong hop le, id khong hop le, hoac capacity_min > capacity_max." })
    @ApiNotFoundResponse({ description: "Khong tim thay nha hang." })
    @ApiUnauthorizedResponse({ description: "Thieu hoac sai Bearer token." })
    @ApiForbiddenResponse({ description: "Khong co quyen xem ban cua nha hang nay." })
    @ApiInternalServerErrorResponse({ description: "Loi noi bo may chu." })
    @Get()
    @RequireRestaurant()
    async listTables(
        @Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
        @Query() query: ListTablesQueryDto,
        @CurrentActor('role') role : RestaurantRole,
    ) {
        return this.tableService.listTables(
            restaurantId,
            query,
            role,
        );
    }

    @ApiOperation({
        summary: "Lay chi tiet ban",
        description: "Lay chi tiet ban. Owner/Admin thay qr_code va notes; staff thay has_qr.",
    })
    @ApiParam({
        name: "id",
        type: String,
        example: "664f1a2b3c4d5e6f7a8b9001",
        description: "ObjectId nha hang",
    })
    @ApiParam({
        name: "table_id",
        type: String,
        example: "664f1a2b3c4d5e6f7a8b9401",
        description: "ObjectId ban",
    })
    @ApiOkResponse({
        description: "Chi tiet ban theo vai tro requester",
        schema: swWrap({
            oneOf: [
                { $ref: getSchemaPath(TableDetailOwnerResponseDto) },
                { $ref: getSchemaPath(TableDetailStaffResponseDto) },
            ],
        }),
    })
    @ApiBadRequestResponse({ description: "id/table_id khong hop le." })
    @ApiNotFoundResponse({ description: "Khong tim thay ban hoac nha hang." })
    @ApiUnauthorizedResponse({ description: "Thieu hoac sai Bearer token." })
    @ApiForbiddenResponse({ description: "Ban khong thuoc nha hang dang truy cap." })
    @ApiInternalServerErrorResponse({ description: "Loi noi bo may chu." })
    @Get(":table_id")
    @RequireRestaurant()
    async getTableDetail(
        @Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
        @Param("table_id", ParseObjectIdPipe) tableId: Types.ObjectId,
        @CurrentActor('role') role : RestaurantRole,
    ) {
        return this.tableService.getTableDetail(
            restaurantId,
            tableId,
            role,
        );
    }

    @ApiOperation({
        summary: "Cap nhat thong tin ban",
        description: "Cap nhat partial table_number, capacity, name, notes va check trung table_number.",
    })
    @ApiParam({
        name: "id",
        type: String,
        example: "664f1a2b3c4d5e6f7a8b9001",
        description: "ObjectId nha hang",
    })
    @ApiParam({
        name: "table_id",
        type: String,
        example: "664f1a2b3c4d5e6f7a8b9401",
        description: "ObjectId ban",
    })
    @ApiBody({ type: UpdateTableDto })
    @ApiOkResponse({
        description: "Cap nhat ban thanh cong",
        schema: swWrap({ $ref: getSchemaPath(UpdateTableResponseDto) }),
    })
    @ApiBadRequestResponse({ description: "Payload khong hop le, id khong hop le, hoac khong co field hop le de cap nhat." })
    @ApiNotFoundResponse({ description: "Khong tim thay ban hoac nha hang." })
    @ApiConflictResponse({ description: "table_number da ton tai trong nha hang." })
    @ApiTooManyRequestsResponse({ description: "Vuot gioi han thao tac ghi ban trong 1 phut." })
    @ApiUnauthorizedResponse({ description: "Thieu hoac sai Bearer token." })
    @ApiForbiddenResponse({ description: "Khong co quyen cap nhat ban." })
    @ApiInternalServerErrorResponse({ description: "Loi noi bo may chu." })
    @Patch(":table_id")
    @RestaurantRoles(RESTAURANT_ROLE.OWNER)
    async updateTable(
        @Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
        @Param("table_id", ParseObjectIdPipe) tableId: Types.ObjectId,
        @Body() payload: UpdateTableDto,
    ) {
        return this.tableService.updateTable(restaurantId, tableId, payload);
    }

    @ApiOperation({
        summary: "Cap nhat trang thai ban",
        description: "Doi status cua ban. Co the bi chan neu ban dang inactive hoac co unpaid active orders.",
    })
    @ApiParam({
        name: "id",
        type: String,
        example: "664f1a2b3c4d5e6f7a8b9001",
        description: "ObjectId nha hang",
    })
    @ApiParam({
        name: "table_id",
        type: String,
        example: "664f1a2b3c4d5e6f7a8b9401",
        description: "ObjectId ban",
    })
    @ApiBody({ type: UpdateTableStatusDto })
    @ApiOkResponse({
        description: "Cap nhat status ban",
        schema: swWrap({ $ref: getSchemaPath(UpdateTableStatusResponseDto) }),
    })
    @ApiBadRequestResponse({ description: "Payload status khong hop le, id khong hop le, hoac ban dang inactive." })
    @ApiNotFoundResponse({ description: "Khong tim thay ban hoac nha hang." })
    @ApiConflictResponse({ description: "Ban co unpaid active orders nen khong the chuyen ve available/reserved." })
    @ApiTooManyRequestsResponse({ description: "Vuot gioi han thao tac ghi ban trong 1 phut." })
    @ApiUnauthorizedResponse({ description: "Thieu hoac sai Bearer token." })
    @ApiForbiddenResponse({ description: "Khong co quyen cap nhat status ban." })
    @ApiInternalServerErrorResponse({ description: "Loi noi bo may chu." })
    @Patch(":table_id/status")
    @RestaurantRoles(RESTAURANT_ROLE.OWNER)
    async updateTableStatus(
        @Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
        @Param("table_id", ParseObjectIdPipe) tableId: Types.ObjectId,
        @Body() payload: UpdateTableStatusDto,
    ) {
        return this.tableService.updateTableStatus(restaurantId, tableId, payload);
    }

    @ApiOperation({
        summary: "Bat/tat active cua ban",
        description: "Dao trang thai is_active. Neu dang tat ban active co order unpaid thi bi chan.",
    })
    @ApiParam({
        name: "id",
        type: String,
        example: "664f1a2b3c4d5e6f7a8b9001",
        description: "ObjectId nha hang",
    })
    @ApiParam({
        name: "table_id",
        type: String,
        example: "664f1a2b3c4d5e6f7a8b9401",
        description: "ObjectId ban",
    })
    @ApiOkResponse({
        description: "Cap nhat active table thanh cong",
        schema: swWrap({ $ref: getSchemaPath(ToggleTableActiveResponseDto) }),
    })
    @ApiBadRequestResponse({ description: "id/table_id khong hop le." })
    @ApiNotFoundResponse({ description: "Khong tim thay ban hoac nha hang." })
    @ApiConflictResponse({ description: "Ban dang co active unpaid orders nen khong the deactivate." })
    @ApiTooManyRequestsResponse({ description: "Vuot gioi han thao tac ghi ban trong 1 phut." })
    @ApiUnauthorizedResponse({ description: "Thieu hoac sai Bearer token." })
    @ApiForbiddenResponse({ description: "Khong co quyen cap nhat ban." })
    @ApiInternalServerErrorResponse({ description: "Loi noi bo may chu." })
    @Patch(":table_id/toggle")
    @RestaurantRoles(RESTAURANT_ROLE.OWNER)
    async toggleTableActive(
        @Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
        @Param("table_id", ParseObjectIdPipe) tableId: Types.ObjectId,
    ) {
        return this.tableService.toggleTableActive(restaurantId, tableId);
    }

    @ApiOperation({
        summary: "Regenerate QR code cua ban",
        description: "Tao QR code moi cho ban va vo hieu hoa QR cu trong cache.",
    })
    @ApiParam({
        name: "id",
        type: String,
        example: "664f1a2b3c4d5e6f7a8b9001",
        description: "ObjectId nha hang",
    })
    @ApiParam({
        name: "table_id",
        type: String,
        example: "664f1a2b3c4d5e6f7a8b9401",
        description: "ObjectId ban",
    })
    @ApiOkResponse({
        description: "Regenerate QR thanh cong",
        schema: swWrap({ $ref: getSchemaPath(RegenerateTableQrResponseDto) }),
    })
    @ApiBadRequestResponse({ description: "id/table_id khong hop le." })
    @ApiNotFoundResponse({ description: "Khong tim thay ban hoac nha hang." })
    @ApiTooManyRequestsResponse({ description: "Vuot gioi han regenerate QR (20 lan/gio/restaurant)." })
    @ApiUnauthorizedResponse({ description: "Thieu hoac sai Bearer token." })
    @ApiForbiddenResponse({ description: "Khong co quyen regenerate QR cua ban." })
    @ApiInternalServerErrorResponse({ description: "Loi noi bo may chu." })
    @Post(":table_id/qr")
    @RestaurantRoles(RESTAURANT_ROLE.OWNER)
    async regenerateQrCode(
        @Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
        @Param("table_id", ParseObjectIdPipe) tableId: Types.ObjectId,
        @Req() req: Request,
    ) {
        return this.tableService.regenerateQrCode(
            restaurantId,
            tableId
        );
    }

    @ApiOperation({
        summary: "Xoa ban",
        description: "Xoa ban va unlink cac order tham chieu toi ban trong transaction.",
    })
    @ApiParam({
        name: "id",
        type: String,
        example: "664f1a2b3c4d5e6f7a8b9001",
        description: "ObjectId nha hang",
    })
    @ApiParam({
        name: "table_id",
        type: String,
        example: "664f1a2b3c4d5e6f7a8b9401",
        description: "ObjectId ban",
    })
    @ApiOkResponse({
        description: "Xoa ban thanh cong",
        schema: swWrap({ $ref: getSchemaPath(DeleteTableResponseDto) }),
    })
    @ApiBadRequestResponse({ description: "id/table_id khong hop le." })
    @ApiNotFoundResponse({ description: "Khong tim thay ban hoac nha hang." })
    @ApiConflictResponse({ description: "Ban co active unpaid orders nen khong the xoa." })
    @ApiTooManyRequestsResponse({ description: "Vuot gioi han thao tac ghi ban trong 1 phut." })
    @ApiUnauthorizedResponse({ description: "Thieu hoac sai Bearer token." })
    @ApiForbiddenResponse({ description: "Khong co quyen xoa ban." })
    @ApiInternalServerErrorResponse({ description: "Loi noi bo may chu." })
    @Delete(":table_id")
    @RestaurantRoles(RESTAURANT_ROLE.OWNER)
    async deleteTable(
        @Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
        @Param("table_id", ParseObjectIdPipe) tableId: Types.ObjectId,
    ) {
        return this.tableService.deleteTable(restaurantId, tableId);
    }
}

@ApiTags("public-tables")
@ApiExtraModels(PublicTableScanResponseDto)
@Controller("public/tables")
export class PublicTableController {
    constructor(
        private readonly tableService: TableService,
    ) {}

    @ApiOperation({
        summary: "Scan QR ban public",
        description: "Lay thong tin ban theo qr_code de client din-in truy cap nhanh menu public.",
    })
    @ApiParam({
        name: "qr_code",
        type: String,
        example: "06d66ff8-7f8d-4df4-97b7-b04b774706f7",
        description: "Ma QR code cua ban",
    })
    @ApiOkResponse({
        description: "Thong tin ban public",
        schema: swWrap({ $ref: getSchemaPath(PublicTableScanResponseDto) }),
    })
    @ApiBadRequestResponse({ description: "qr_code khong hop le." })
    @ApiNotFoundResponse({ description: "QR khong ton tai, ban inactive, hoac nha hang chua publish." })
    @ApiTooManyRequestsResponse({ description: "Vuot gioi han scan public QR (60 lan/phut/IP)." })
    @ApiInternalServerErrorResponse({ description: "Loi noi bo may chu." })
    @Get(":qr_code")
    @Public()
    @ThrottleCustom("public-table-qr-scan", { ttl: 60_000, limit: 60 })
    async scanPublicByQrCode(
        @Param("qr_code") qrCode: string,
    ) {
        return this.tableService.scanPublicByQrCode(qrCode);
    }
}
