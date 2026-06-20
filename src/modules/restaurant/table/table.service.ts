import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import { Connection, Types } from "mongoose";
import Redis from "ioredis";
import { ERROR_CODE } from "src/common/constants/error-code.constant";
import { INJECTION_TOKEN } from "src/common/constants/injection-token.constant";
import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    NotFoundException,
    TooManyRequestException,
} from "src/common/exceptions";
import { StringUtil } from "src/common/utils/string.util";
import {
    CreateTableDto,
    ListTablesQueryDto,
    UpdateTableDto,
    UpdateTableStatusDto,
} from "./dto/table.dto";
import { ITableRepository, IUpdateTablePayload } from "./repositories/table.repository";
import { TableDocument, TableStatus } from "./schemas/table.schema";
import { ObjectUtil } from "src/common/utils/object.util";
import { RestaurantService } from "../restaurant.service";
import { IOrderRepository } from "../../order/repositories/order.repository";
import { InjectConnection } from "@nestjs/mongoose";
import { RestaurantRole } from "src/common/constants/restaurant-role.constant";
import { ObjectIdUtil } from "src/common/utils/object-id.util";


interface ITableQrCache {
    table_id: string;
    restaurant_id: string;
    table_number: string;
    name: string | null;
    capacity: number;
    status: TableStatus;
    is_active: boolean;
}

const CACHE_TABLE_PREFIX = "table:";
const CACHE_TABLE_LIST_PREFIX = "table:list:";
const CACHE_TABLE_QR_PREFIX = "table:qr:";

const CACHE_TABLE_TTL_SECONDS = 300;
const CACHE_TABLE_LIST_TTL_SECONDS = 60;
const CACHE_TABLE_QR_TTL_SECONDS = 3600;

const RATE_LIMIT_TABLE_WRITE_PREFIX = "ratelimit:table:write:";
const RATE_LIMIT_TABLE_WRITE_TTL_SECONDS = 60;
const RATE_LIMIT_TABLE_WRITE_MAX = 30;

const RATE_LIMIT_TABLE_QR_PREFIX = "ratelimit:table:qr:";
const RATE_LIMIT_TABLE_QR_TTL_SECONDS = 3600;
const RATE_LIMIT_TABLE_QR_MAX = 20;

const MAX_TABLES_PER_RESTAURANT = 300;

@Injectable()
export class TableService {
    constructor(
        @Inject(INJECTION_TOKEN.TABLE_REPOSITORY)
        private readonly tableRepository: ITableRepository,

        @Inject(INJECTION_TOKEN.ORDER_REPOSITORY)
        private readonly orderRepository: IOrderRepository,

        @InjectConnection()
        private readonly connection: Connection,

        private readonly restaurantService: RestaurantService,

        @Inject(INJECTION_TOKEN.REDIS_CLIENT)
        private readonly redis: Redis,
    ) {}

    async createTable(
        resId: Types.ObjectId,
        payload: CreateTableDto,
    ): Promise<Record<string, unknown>> {
        await this.checkWriteRateLimit(resId);

        const totalTables = await this.tableRepository.countByRestaurant(resId);
        if (totalTables >= MAX_TABLES_PER_RESTAURANT) {
            throw new BadRequestException(
                ERROR_CODE.VALIDATION_ERROR,
                `Restaurant reached table limit ${MAX_TABLES_PER_RESTAURANT}`,
            );
        }

        const duplicated = await this.tableRepository.findByTableNumber(
            resId,
            payload.table_number,
        );
        if (duplicated) {
            throw new ConflictException(
                ERROR_CODE.CONFLICT_ERROR,
                "Table number already exists in this restaurant",
                { table_number: payload.table_number },
            );
        }

        const created = await this.tableRepository.createOne({
            restaurant_id: resId,
            table_number: payload.table_number,
            capacity: payload.capacity,
            name: StringUtil.normalizeNullableString(payload.name),
            notes: StringUtil.normalizeNullableString(payload.notes),
            status: TableStatus.AVAILABLE,
            is_active: true,
            qr_code: null,
        });

        await this.redis.del(`${CACHE_TABLE_LIST_PREFIX}${resId.toString()}`);

        return this.toPlainObject(created);
    }

    async listTables(
        resId: Types.ObjectId,
        query: ListTablesQueryDto = {},
        role: RestaurantRole,
    ): Promise<{ data: Record<string, unknown>[]; total: number }> {
        if (
            query.capacity_min !== undefined &&
            query.capacity_max !== undefined &&
            query.capacity_min > query.capacity_max
        ) {
            throw new BadRequestException(
                ERROR_CODE.VALIDATION_ERROR,
                "capacity_min must be less than or equal to capacity_max",
            );
        }

        const listKey = `${CACHE_TABLE_LIST_PREFIX}${resId.toString()}`;
        const cached = await this.redis.get(listKey);

        let allTables: TableDocument[];
        if (cached) {
            allTables = JSON.parse(cached) as TableDocument[];
        } else {
            allTables = await this.tableRepository.listByRestaurant(resId);
            await this.redis.set(
                listKey,
                JSON.stringify(allTables),
                "EX",
                CACHE_TABLE_LIST_TTL_SECONDS,
            );
        }

        const filtered = allTables.filter((table) => {
            if (query.status !== undefined && table.status !== query.status) return false;
            if (query.is_active !== undefined && table.is_active !== query.is_active) {
                return false;
            }

            if (
                query.capacity_min !== undefined &&
                table.capacity < query.capacity_min
            ) {
                return false;
            }

            if (
                query.capacity_max !== undefined &&
                table.capacity > query.capacity_max
            ) {
                return false;
            }

            return true;
        });
        return {
            data: filtered.map((table) => this.serializeListRow(table, role)),
            total: filtered.length,
        };
    }

    async getTableDetail(
        resId: Types.ObjectId,
        tableId: Types.ObjectId,
        role: RestaurantRole,
    ): Promise<Record<string, unknown>> {
        const cacheKey = `${CACHE_TABLE_PREFIX}${tableId.toString()}`;
        const cached = await this.redis.get(cacheKey);

        let table: TableDocument | null = null;
        if (cached) {
            table = JSON.parse(cached) as TableDocument;
            const tableRestaurantId = ObjectIdUtil.toObjectId(
                table.restaurant_id,
                "restaurant_id",
            );

            if (!ObjectIdUtil.isSameObjectId(tableRestaurantId, resId)) {
                throw new ForbiddenException(
                    ERROR_CODE.FORBIDDEN,
                    "Table does not belong to this restaurant",
                );
            }
        }

        if (!table) {
            table = await this.getTableOrThrow(resId, tableId);

            await this.redis.set(
                cacheKey,
                JSON.stringify(table),
                "EX",
                CACHE_TABLE_TTL_SECONDS,
            );
        }

        return this.serializeDetailRow(table, role);
    }

    async updateTable(
        resId: Types.ObjectId,
        tableId: Types.ObjectId,
        payload: UpdateTableDto,
    ): Promise<{ updated: boolean; table: Record<string, unknown> }> {
        await this.checkWriteRateLimit(resId);

        const table = await this.getTableOrThrow(resId, tableId);

        const oldQr = table.qr_code;

        const data: IUpdateTablePayload = {};

        if (payload.table_number !== undefined) {
            const duplicated = await this.tableRepository.findByTableNumber(
                resId,
                payload.table_number,
                tableId,
            );
            if (duplicated) {
                throw new ConflictException(
                    ERROR_CODE.CONFLICT_ERROR,
                    "Table number already exists in this restaurant",
                    { table_number: payload.table_number },
                );
            }
            data.table_number = payload.table_number;
        }

        if (payload.capacity !== undefined) data.capacity = payload.capacity;
        if (payload.name !== undefined) {
            data.name = StringUtil.normalizeNullableString(payload.name);
        }
        if (payload.notes !== undefined) {
            data.notes = StringUtil.normalizeNullableString(payload.notes);
        }

        if (!Object.keys(data).length) {
            throw new BadRequestException(
                ERROR_CODE.VALIDATION_ERROR,
                "No valid field to update",
            );
        }

        const updated = await this.tableRepository.updateInRestaurant(
            resId,
            tableId,
            data,
        );

        if (!updated) {
            throw new NotFoundException(
                ERROR_CODE.RESOURCE_NOT_FOUND,
                "Table not found",
                { table_id: tableId.toString(), restaurant_id: resId.toString() },
            );
        }

        const keysToDelete = [
            `${CACHE_TABLE_PREFIX}${tableId.toString()}`,
            `${CACHE_TABLE_LIST_PREFIX}${resId.toString()}`,
        ];

        const changedTableNumber =
            data.table_number !== undefined &&
            data.table_number !== table.table_number;
        const changedName =
            data.name !== undefined &&
            data.name !== table.name;
        const changedCapacity =
            data.capacity !== undefined &&
            data.capacity !== table.capacity;

        if (oldQr && (changedTableNumber || changedName || changedCapacity)) {
            keysToDelete.push(`${CACHE_TABLE_QR_PREFIX}${oldQr}`);
        }

        await this.redis.del(...keysToDelete);

        return {
            updated: true,
            table: this.toPlainObject(updated),
        };
    }

    async updateTableStatus(
        resId: Types.ObjectId,
        tableId: Types.ObjectId,
        payload: UpdateTableStatusDto,
    ): Promise<{
        unchanged: boolean;
        table?: Record<string, unknown>;
    }> {
        await this.checkWriteRateLimit(resId);
        const { status: targetStatus } = payload;

        const table = await this.getTableOrThrow(resId, tableId);
        if (!table.is_active) {
            throw new BadRequestException(
                ERROR_CODE.VALIDATION_ERROR,
                "Inactive table cannot change status",
            );
        }

        if (table.status === targetStatus) {
            return { unchanged: true };
        }

        if (
            targetStatus === TableStatus.AVAILABLE ||
            targetStatus === TableStatus.RESERVED
        ) {
            const unpaidActiveOrders = await this.orderRepository.countActiveUnpaidByTable(resId, tableId);

            if (unpaidActiveOrders > 0) {
                throw new ConflictException(
                    ERROR_CODE.CONFLICT_ERROR,
                    "Table has unpaid active orders, cannot switch status",
                    { unpaid_active_orders: unpaidActiveOrders },
                );
            }
        }

        const updated = await this.tableRepository.updateStatus(
            resId,
            tableId,
            targetStatus,
        );

        if (!updated) {
            throw new NotFoundException(
                ERROR_CODE.RESOURCE_NOT_FOUND,
                "Table not found",
                { table_id: tableId.toString(), restaurant_id: resId.toString() },
            );
        }

        const keysToDelete = [
            `${CACHE_TABLE_PREFIX}${tableId.toString()}`,
            `${CACHE_TABLE_LIST_PREFIX}${resId.toString()}`,
        ];
        if (table.qr_code) {
            keysToDelete.push(`${CACHE_TABLE_QR_PREFIX}${table.qr_code}`);
        }
        await this.redis.del(...keysToDelete);

        return {
            unchanged: false,
            table: ObjectUtil.pick(updated, [
                "id",
                "restaurant_id",
                "table_number",
                "status",
                "updated_at"
            ]),
        };
    }

    async toggleTableActive(
        resId: Types.ObjectId,
        tableId: Types.ObjectId,
    ): Promise<Record<string, unknown>> {
        await this.checkWriteRateLimit(resId);

        const table = await this.getTableOrThrow(resId, tableId);
        const nextIsActive = !table.is_active;

        if (table.is_active) {
            const activeOrders = await this.orderRepository.countActiveUnpaidByTable(resId, tableId);
            if (activeOrders > 0) {
                throw new ConflictException(
                    ERROR_CODE.CONFLICT_ERROR,
                    `Table has ${activeOrders} active orders, cannot deactivate`,
                    { active_orders: activeOrders },
                );
            }
        }

        const updated = await this.tableRepository.toggleActive(
            resId,
            tableId,
            nextIsActive,
        );

        if (!updated) {
            throw new NotFoundException(
                ERROR_CODE.RESOURCE_NOT_FOUND,
                "Table not found",
                { table_id: tableId.toString(), restaurant_id: resId.toString() },
            );
        }

        const keysToDelete = [
            `${CACHE_TABLE_PREFIX}${tableId.toString()}`,
            `${CACHE_TABLE_LIST_PREFIX}${resId.toString()}`,
        ];
        if (table.qr_code) {
            keysToDelete.push(`${CACHE_TABLE_QR_PREFIX}${table.qr_code}`);
        }
        await this.redis.del(...keysToDelete);

        return ObjectUtil.pick(updated, [
            "id",
            "restaurant_id",
            "table_number",
            "is_active",
            "updated_at"
        ]);
    }

    async regenerateQrCode(
        resId: Types.ObjectId,
        tableId: Types.ObjectId,
    ): Promise<Record<string, unknown>> {
        await this.checkQrRateLimit(resId);

        const table = await this.getTableOrThrow(resId, tableId);
        const oldQr = table.qr_code;
        const newQr = randomUUID();
        
        const updated = await this.tableRepository.updateQrCode(
            resId,
            tableId,
            newQr,
        );
        
        if (!updated) {
            throw new NotFoundException(
                ERROR_CODE.RESOURCE_NOT_FOUND,
                "Table not found",
                { table_id: tableId.toString(), restaurant_id: resId.toString() },
            );
        }

        
        if (oldQr) await this.redis.del(`${CACHE_TABLE_QR_PREFIX}${oldQr}`);
        
        const qrCache: ITableQrCache = {
            table_id: updated._id.toString(),
            restaurant_id: resId.toString(),
            table_number: updated.table_number,
            name: updated.name,
            capacity: updated.capacity,
            status: updated.status,
            is_active: updated.is_active,
        };

        await this.redis.set(
            `${CACHE_TABLE_QR_PREFIX}${newQr}`,
            JSON.stringify(qrCache),
            "EX",
            CACHE_TABLE_QR_TTL_SECONDS,
        );

        await this.redis.del(
            `${CACHE_TABLE_PREFIX}${tableId.toString()}`,
            `${CACHE_TABLE_LIST_PREFIX}${resId.toString()}`,
        );

        return {
            table_id: updated._id.toString(),
            qr_code: newQr,
            updated_at: updated.updated_at,
        };
    }

    async scanPublicByQrCode(
        qrCode: string,
    ): Promise<Record<string, unknown>> {
        const qrKey = `${CACHE_TABLE_QR_PREFIX}${qrCode}`;
        const cached = await this.redis.get(qrKey);

        let qrTable: ITableQrCache | null = null;
        if (cached) {
            qrTable = JSON.parse(cached) as ITableQrCache;
        }

        if (!qrTable) {
            const table = await this.tableRepository.findByQrCode(qrCode);
            if (!table) {
                throw new NotFoundException(
                    ERROR_CODE.RESOURCE_NOT_FOUND,
                    "Invalid QR code",
                );
            }

            qrTable = {
                table_id: table._id.toString(),
                restaurant_id: table.restaurant_id.toString(),
                table_number: table.table_number,
                name: table.name,
                capacity: table.capacity,
                status: table.status,
                is_active: table.is_active,
            };

            await this.redis.set(
                qrKey,
                JSON.stringify(qrTable),
                "EX",
                CACHE_TABLE_QR_TTL_SECONDS,
            );
        }

        if (!qrTable.is_active) {
            throw new NotFoundException(
                ERROR_CODE.RESOURCE_NOT_FOUND,
                "Table is not available",
            );
        }

        const resObjId = ObjectIdUtil.toObjectId(
            qrTable.restaurant_id,
            "restaurant_id",
        );
        const restaurant = await this.restaurantService.handleGetResAndThrow(resObjId);

        if (!restaurant.is_published) {
            throw new NotFoundException(
                ERROR_CODE.RESOURCE_NOT_FOUND,
                "Table is not available",
            );
        }

        return {
            table_id: qrTable.table_id,
            table_number: qrTable.table_number,
            name: qrTable.name,
            capacity: qrTable.capacity,
            status: qrTable.status,
            restaurant: ObjectUtil.omit(restaurant, ['owner_id', 'settings', "__v"], ["created_at", "updated_at"]),
            menu_url: `/public/restaurants/${restaurant.slug}/menu`,
        };
    }

    async deleteTable(
        resId: Types.ObjectId,
        tableId: Types.ObjectId,
    ): Promise<{ message: string }> {
        await this.checkWriteRateLimit(resId);

        const table = await this.getTableOrThrow(resId, tableId);

        const activeOrders = await this.orderRepository.countActiveUnpaidByTable(resId, tableId);
        if (activeOrders > 0) {
            throw new ConflictException(
                ERROR_CODE.CONFLICT_ERROR,
                `Table has ${activeOrders} active orders, cannot delete`,
                { active_orders: activeOrders },
            );
        }

        let result: boolean = false;
        const session = await this.connection.startSession();
        try {
            result = await session.withTransaction(async () => {
                const deleted = await this.tableRepository.deleteInRestaurant(resId, tableId, { session });
                if (!deleted) {
                    throw new NotFoundException(
                        ERROR_CODE.RESOURCE_NOT_FOUND,
                        "Table not found",
                        { table_id: tableId.toString(), restaurant_id: resId.toString() },
                    );
                }
                await this.orderRepository.unlinkOrdersFromTable(resId, tableId, { session });
                return true;    
            })
            
        } finally {
            await session.endSession();
        }

        const keysToDelete = [
            `${CACHE_TABLE_PREFIX}${tableId.toString()}`,
            `${CACHE_TABLE_LIST_PREFIX}${resId.toString()}`,
        ];
        if (table.qr_code) {
            keysToDelete.push(`${CACHE_TABLE_QR_PREFIX}${table.qr_code}`);
        }
        await this.redis.del(...keysToDelete);

        return { message: `Deleted table ${table.table_number}` };
    }

    private async getTableOrThrow(
        resId: Types.ObjectId,
        tableId: Types.ObjectId,
    ): Promise<TableDocument> {
        const table = await this.tableRepository.findByIdInRestaurant(resId, tableId);
        if (!table) {
            throw new NotFoundException(
                ERROR_CODE.RESOURCE_NOT_FOUND,
                "Table not found",
                { table_id: tableId.toString(), restaurant_id: resId.toString() },
            );
        }

        return table;
    }

    private serializeListRow(
        table: TableDocument,
        role: RestaurantRole,
    ): Record<string, unknown> {
        const row = this.toPlainObject(table);
        const isPrivileged = role === "owner" || role === "admin";

        return {
            id: this.readEntityId(row),
            table_number: row.table_number,
            name: row.name,
            capacity: row.capacity,
            status: row.status,
            is_active: row.is_active,
            has_qr: Boolean(row.qr_code),
            ...(isPrivileged ? { notes: row.notes } : {}),
        };
    }

    private serializeDetailRow(
        table: TableDocument,
        role: RestaurantRole,
    ): Record<string, unknown> {
        const row = this.toPlainObject(table);
        const isPrivileged = role === "owner" || role === "admin";

        if (isPrivileged) {
            return {
                id: this.readEntityId(row),
                restaurant_id: ObjectIdUtil.toObjectId(row.restaurant_id, "restaurant_id").toString(),
                table_number: row.table_number,
                name: row.name,
                capacity: row.capacity,
                status: row.status,
                is_active: row.is_active,
                qr_code: row.qr_code,
                notes: row.notes,
                created_at: row.created_at,
                updated_at: row.updated_at,
            };
        }

        return {
            id: this.readEntityId(row),
            restaurant_id: ObjectIdUtil.toObjectId(row.restaurant_id, "restaurant_id").toString(),
            table_number: row.table_number,
            name: row.name,
            capacity: row.capacity,
            status: row.status,
            is_active: row.is_active,
            has_qr: Boolean(row.qr_code),
            created_at: row.created_at,
            updated_at: row.updated_at,
        };
    }

    private toPlainObject(entity: any): Record<string, any> {
        if (entity && typeof entity.toObject === "function") {
            return entity.toObject();
        }
        return { ...entity };
    }

    private readEntityId(entity: Record<string, any>): string {
        if (entity.id) return String(entity.id);
        if (entity._id) return String(entity._id);
        return "";
    }

    private async checkWriteRateLimit(restaurantId: Types.ObjectId): Promise<void> {
        await this.checkRateLimit(
            `${RATE_LIMIT_TABLE_WRITE_PREFIX}${restaurantId.toString()}`,
            RATE_LIMIT_TABLE_WRITE_MAX,
            RATE_LIMIT_TABLE_WRITE_TTL_SECONDS,
            "Too many table write operations",
        );
    }

    private async checkQrRateLimit(restaurantId: Types.ObjectId): Promise<void> {
        await this.checkRateLimit(
            `${RATE_LIMIT_TABLE_QR_PREFIX}${restaurantId.toString()}`,
            RATE_LIMIT_TABLE_QR_MAX,
            RATE_LIMIT_TABLE_QR_TTL_SECONDS,
            "Too many QR generations",
        );
    }

    private async checkRateLimit(
        key: string,
        limit: number,
        ttlSeconds: number,
        message: string,
    ): Promise<void> {
        const count = await this.redis.incr(key);
        if (count === 1) {
            await this.redis.expire(key, ttlSeconds);
        }

        if (count > limit) {
            throw new TooManyRequestException(ERROR_CODE.TOO_MANY_REQUESTS, message);
        }
    }
}
