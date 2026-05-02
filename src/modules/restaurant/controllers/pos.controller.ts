import { Controller, Get, Param } from "@nestjs/common";
import {
    ApiBadRequestResponse,
    ApiBearerAuth,
    ApiForbiddenResponse,
    ApiInternalServerErrorResponse,
    ApiNotFoundResponse,
    ApiOkResponse,
    ApiOperation,
    ApiParam,
    ApiTags,
    ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { ROLE } from "src/common/constants/role.constant";
import { CurrentUser, Roles } from "src/common/decorators";
import { SlugValidationPipe } from "src/common/pipes/slug.pipe";
import { swWrap } from "src/common/swagger/api-response.util";
import { PosService } from "../services";
import { AccessTokenPayload } from "src/modules/auth/auth.service.xxx";

const BUSINESS_ROLE_ENUM = ["owner", "admin", "staff"];

const POS_INIT_DATA_SCHEMA = {
    type: "object",
    properties: {
        user: {
            type: "object",
            properties: {
                id: { type: "string", example: "6650aa42b12c3d4e5f678900" },
                system_role: { type: "string", enum: ["user", "admin"], example: "user" },
            },
        },
        business_role: {
            type: "string",
            enum: BUSINESS_ROLE_ENUM,
            example: "staff",
        },
        current_staff: {
            nullable: true,
            oneOf: [
                { type: "null" },
                {
                    type: "object",
                    properties: {
                        _id: { type: "string", example: "6650aa42b12c3d4e5f678911" },
                        employee_code: { type: "string", example: "EMP001" },
                        full_name: { type: "string", example: "Nguyen Van B" },
                        phone: { type: "string", nullable: true, example: "0901234567" },
                        email: { type: "string", nullable: true, example: "staff@example.com" },
                        position: {
                            type: "string",
                            enum: ["manager", "cashier", "waiter", "kitchen", "delivery"],
                            example: "cashier",
                        },
                        permissions: {
                            type: "object",
                            properties: {
                                can_discount: { type: "boolean", example: true },
                                can_cancel_order: { type: "boolean", example: true },
                                can_process_payment: { type: "boolean", example: true },
                                can_refund: { type: "boolean", example: false },
                                can_view_reports: { type: "boolean", example: false },
                                can_manage_tables: { type: "boolean", example: true },
                                can_manage_menu: { type: "boolean", example: false },
                            },
                        },
                    },
                },
            ],
        },
        restaurant: {
            type: "object",
            properties: {
                _id: { type: "string", example: "664f1a2b3c4d5e6f7a8b9001" },
                name: { type: "string", example: "Bep Nha Viet" },
                logo_url: { type: "string", nullable: true, example: "https://cdn.example.com/logos/restaurant.png" },
                slug: { type: "string", example: "bep-nha-viet" },
                address: { type: "string", example: "123 Tran Hung Dao" },
                phone: { type: "string", nullable: true, example: "02812345678" },
                timezone: { type: "string", example: "Asia/Ho_Chi_Minh" },
                currency: { type: "string", example: "VND" },
                tax_rate: { type: "number", example: 0.1 },
                service_charge_rate: { type: "number", example: 0.01 },
                accepts_online_orders: { type: "boolean", example: true },
            },
        },
    },
};

@ApiTags("pos")
@ApiBearerAuth()
@Controller("restaurants")
@Roles(ROLE.ADMIN, ROLE.USER)
export class PosController {
    constructor(
        private readonly posService: PosService,
    ) {}

    @ApiOperation({
        summary: "Khoi tao du lieu POS",
        description: "Tra ve thong tin context POS theo slug: user hien tai, business role trong nha hang, staff profile (neu role staff) va thong tin restaurant.",
    })
    @ApiParam({
        name: "slug",
        type: String,
        example: "bep-nha-viet",
        description: "Restaurant slug",
    })
    @ApiOkResponse({
        description: "Khoi tao POS thanh cong",
        schema: swWrap(POS_INIT_DATA_SCHEMA),
    })
    @ApiBadRequestResponse({ description: "Slug khong hop le." })
    @ApiUnauthorizedResponse({ description: "Thieu hoac sai Bearer token." })
    @ApiForbiddenResponse({ description: "User khong co quyen truy cap POS cua nha hang." })
    @ApiNotFoundResponse({ description: "Khong tim thay nha hang theo slug." })
    @ApiInternalServerErrorResponse({ description: "Loi noi bo may chu." })
    @Get("/:slug/pos/init")
    async initPos(
        @Param("slug", SlugValidationPipe) slug: string,
        @CurrentUser() user: AccessTokenPayload,
    ) {
        return this.posService.init(slug, user);
    }
}