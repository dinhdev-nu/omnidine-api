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
import { RESTAURANT_ROLE_INJECT } from "src/common/guards/restaurant-auth.guard";
import { ParseObjectIdPipe } from "src/common/pipes/parse-id.pipe";
import {
    CreateTableDto,
    ListTablesQueryDto,
    UpdateTableDto,
    UpdateTableStatusDto,
} from "../dto/table.dto";
import { TableService } from "../services";
import { CurrentActor } from "src/common/decorators/user/current-actor.decorator";

@Controller("restaurants/:id/tables")
@Roles(ROLE.ADMIN, ROLE.USER)
export class TableController {
    constructor(
        private readonly tableService: TableService,
    ) {}

    @Post()
    @RestaurantRoles(RESTAURANT_ROLE.OWNER)
    async createTable(
        @Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
        @Body() payload: CreateTableDto,
    ) {
        return this.tableService.createTable(restaurantId, payload);
    }

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

    @Patch(":table_id")
    @RestaurantRoles(RESTAURANT_ROLE.OWNER)
    async updateTable(
        @Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
        @Param("table_id", ParseObjectIdPipe) tableId: Types.ObjectId,
        @Body() payload: UpdateTableDto,
    ) {
        return this.tableService.updateTable(restaurantId, tableId, payload);
    }

    @Patch(":table_id/status")
    @RestaurantRoles(RESTAURANT_ROLE.OWNER)
    async updateTableStatus(
        @Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
        @Param("table_id", ParseObjectIdPipe) tableId: Types.ObjectId,
        @Body() payload: UpdateTableStatusDto,
    ) {
        return this.tableService.updateTableStatus(restaurantId, tableId, payload);
    }

    @Patch(":table_id/toggle")
    @RestaurantRoles(RESTAURANT_ROLE.OWNER)
    async toggleTableActive(
        @Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
        @Param("table_id", ParseObjectIdPipe) tableId: Types.ObjectId,
    ) {
        return this.tableService.toggleTableActive(restaurantId, tableId);
    }

    @Post(":table_id/qr")
    @RestaurantRoles(RESTAURANT_ROLE.OWNER)
    async regenerateQrCode(
        @Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
        @Param("table_id", ParseObjectIdPipe) tableId: Types.ObjectId,
        @Req() req: Request,
    ) {
        return this.tableService.regenerateQrCode(
            restaurantId,
            tableId,
            this.resolvePublicBaseUrl(req),
        );
    }

    @Delete(":table_id")
    @RestaurantRoles(RESTAURANT_ROLE.OWNER)
    async deleteTable(
        @Param("id", ParseObjectIdPipe) restaurantId: Types.ObjectId,
        @Param("table_id", ParseObjectIdPipe) tableId: Types.ObjectId,
    ) {
        return this.tableService.deleteTable(restaurantId, tableId);
    }

    private resolvePublicBaseUrl(req: Request): string | undefined {
        const host = req.get("host");
        if (!host) return undefined;

        const forwardedProto = req.get("x-forwarded-proto")?.split(",")[0]?.trim();
        const protocol = forwardedProto || req.protocol || "http";
        return `${protocol}://${host}`;
    }
}

@Controller("public/tables")
export class PublicTableController {
    constructor(
        private readonly tableService: TableService,
    ) {}

    @Get(":qr_code")
    @Public()
    @ThrottleCustom("public-table-qr-scan", { ttl: 60_000, limit: 60 })
    async scanPublicByQrCode(
        @Param("qr_code") qrCode: string,
    ) {
        return this.tableService.scanPublicByQrCode(qrCode);
    }
}
