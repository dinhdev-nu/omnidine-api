import { Inject, Injectable } from "@nestjs/common";
import { Types } from "mongoose";
import Redis from "ioredis";
import { INJECTION_TOKEN } from "src/common/constants/injection-token.constant";
import { ERROR_CODE } from "src/common/constants/error-code.constant";
import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    NotFoundException,
    TooManyRequestException,
} from "src/common/exceptions";
import {
    IBaseUpdateStaffFields,
    IStaffQueryFilters,
    IStaffRepository,
} from "../repositories";
import {
    Staff,
    StaffDocument,
    StaffPermissionKey,
    StaffPermissions,
    StaffStatus,
} from "../schemas/staff.schema.xxx";
import { CreateStaffDto } from "../dto/create-staff.dto";
import { IUserRepository } from "../../auth/repositories/user.repository";
import { StringUtil } from "src/common/utils/string.util";
import { IPaginatedResult } from "src/common/interfaces/paginated-result.interface";
import {
    ListStaffQuery,
    UpdateStaffDto,
    UpdateStaffPermissionsDto,
    UpdateStaffStatusDto,
} from "../dto/staff.dto";
import { ObjectUtil } from "src/common/utils/object.ultil";
import { IOrderRepository } from "../../order/repositories/order.repository";
import { ObjectIdUtil } from "src/common/utils/object-id.util";

const CACHE_STAFF_DETAIL_KEY_PREFIX = "staff:";
const CACHE_STAFF_DETAIL_TTL_SECONDS = 300;
const CACHE_STAFF_LIST_KEY_PREFIX = "staff:list:";
const CACHE_STAFF_LIST_TTL_SECONDS = 60;
const CACHE_STAFF_AUTH_KEY_PREFIX = "staff:auth:";
const CACHE_STAFF_AUTH_TTL_SECONDS = 300;

const RATE_LIMIT_STAFF_WRITE_PREFIX = "ratelimit:staff:write:";
const RATE_LIMIT_STAFF_WRITE_TTL_SECONDS = 60;
const RATE_LIMIT_STAFF_WRITE_MAX = 30;

type RestaurantRole = "owner" | "admin" | "staff";

@Injectable()
export class StaffService {
    constructor(
        @Inject(INJECTION_TOKEN.STAFF_REPOSITORY)
        private readonly staffRepository: IStaffRepository,

        @Inject(INJECTION_TOKEN.USER_REPOSITORY)
        private readonly userRepository: IUserRepository,

        @Inject(INJECTION_TOKEN.ORDER_REPOSITORY)
        private readonly orderRepository: IOrderRepository,

        @Inject(INJECTION_TOKEN.REDIS_CLIENT)
        private readonly redis: Redis,
    ) {}

    async createStaff(
        resId: Types.ObjectId,
        userId: Types.ObjectId,
        dto: CreateStaffDto,
    ): Promise<Record<string, unknown>> {
        await this.checkWriteRateLimit(
            resId.toString(),
            "Vui lòng cho 1 phút trước khi tiếp tục tạo nhân viên mới",
        )

        await this.assertUserExists(userId);

        const duplicateCode = await this.staffRepository.findByEmployeeCodeInRestaurant(
            resId,
            dto.employee_code.trim(),
        );
        if (duplicateCode) {
            throw new ConflictException(
                ERROR_CODE.CONFLICT_ERROR,
                "Mã nhân viên đã tồn tại trong nhà hàng",
                { employee_code: dto.employee_code.trim() },
            );
        }

        const duplicatedUserLink = await this.staffRepository.findByUserInRestaurant(
            resId,
            userId,
        );
        if (duplicatedUserLink) {
            throw new ConflictException(
                ERROR_CODE.CONFLICT_ERROR,
                "Tài khoản đã được liên kết với nhân viên khác trong nhà hàng",
                { user_id: userId.toString() },
            );
        }

        const staff = await this.staffRepository.createOne({
            restaurant_id: resId,
            user_id: userId,
            employee_code: dto.employee_code,
            full_name: dto.full_name,
            phone: StringUtil.normalizeNullableString(dto.phone),
            email: StringUtil.normalizeNullableString(dto.email, true),
            position: dto.position,
            hire_date: this.parseHireDate(dto.hire_date),
            status: dto.status ?? StaffStatus.ACTIVE,
            avatar_url: StringUtil.normalizeNullableString(dto.avatar_url),
            permissions: {},
            deleted_at: null,
        } as Partial<Staff>);

        await this.invalidateStaffCaches(resId, {
            list: true,
            userIds: [userId],
        });

        return {
            id: staff._id.toString(),
            employee_code: staff.employee_code,
            full_name: staff.full_name,
            position: staff.position,
            hire_date: staff.hire_date,
            status: staff.status,
            user_id: staff.user_id,
            created_at: staff.created_at,
        };
    }

    async listStaffs(
        resId: Types.ObjectId,
        query: ListStaffQuery,
    ): Promise<IPaginatedResult<Record<string, unknown>>> {
        const { page = 1, limit = 50 } = query;
        const useCache = page === 1 && !query.status && !query.position;

        const cacheKey = `${CACHE_STAFF_LIST_KEY_PREFIX}${resId.toString()}`;
        if (useCache) {
            const cached = await this.redis.get(cacheKey);
            if (cached) {
                return JSON.parse(cached) as IPaginatedResult<Record<string, unknown>>;
            }
        }

        const filters: IStaffQueryFilters = {
            page,
            limit,
            status: query.status,
            position: query.position,
        };

        const result = await this.staffRepository.findByRestaurantId(resId, filters);
        const totalPages = Math.max(Math.ceil(result.total / limit), 1);

        const response: IPaginatedResult<Record<string, unknown>> = {
            data: result.data.map((staff) => this.serializeStaffListRow(staff)),
            pagination: {
                page,
                limit,
                total: result.total,
                total_pages: totalPages,
            },
        };

        if (useCache) {
            await this.redis.set(
                cacheKey,
                JSON.stringify(response),
                "EX",
                CACHE_STAFF_LIST_TTL_SECONDS,
            );
        }

        return response;
    }

    async getStaffDetail(
        resId: Types.ObjectId,
        staffId: Types.ObjectId,
        options: {
            requesterRole?: RestaurantRole;
            requesterUserId?: Types.ObjectId;
        } = {},
    ): Promise<Record<string, unknown>> {
        const staff = await this.getStaffOrThrow(resId, staffId);

        const requesterRole = options.requesterRole;
        const requesterUserId = options.requesterUserId;

        // Đặc quyền
        const isPrivileged = requesterRole === "owner" || requesterRole === "admin";
        
        const isSelf =
            requesterRole === "staff" &&
            requesterUserId &&
            ObjectIdUtil.isSameObjectId(ObjectIdUtil.toObjectId(staff.user_id, "user_id"), requesterUserId);

        const includePermissions = Boolean(isPrivileged || isSelf);

        const src = this.toPlainObject(staff);

        return ObjectUtil.omit(
            src,
            includePermissions ? [] : ["permissions"],
        );
    }

    async updateStaffInfo(
        resId: Types.ObjectId,
        staffId: Types.ObjectId,
        dto: UpdateStaffDto,
    ): Promise<{ updated: boolean; staff: Record<string, unknown> }> {
        await this.checkWriteRateLimit(
            resId.toString(),
            "Vui lòng cho 1 phút trước khi tiếp tục cập nhật thông tin nhân viên",
        )

        const current = await this.getStaffOrThrow(resId, staffId);

        const data: IBaseUpdateStaffFields = {
            full_name: dto.full_name,
            position: dto.position,
            hire_date: dto.hire_date ? this.parseHireDate(dto.hire_date) : undefined,
            phone: dto.phone !== undefined ? StringUtil.normalizeNullableString(dto.phone) : undefined,
            email: dto.email !== undefined ? StringUtil.normalizeNullableString(dto.email, true) : undefined,
        };

        const updated = await this.staffRepository.updateFieldsInRestaurant(
            resId,
            staffId,
            data,
        );

        if (!updated) {
            throw new NotFoundException(
                ERROR_CODE.RESOURCE_NOT_FOUND,
                "Staff not found",
                { staff_id: staffId.toString(), restaurant_id: resId.toString() },
            );
        }

        await this.invalidateStaffCaches(resId, {
            list: true,
            staffId,
            userIds: [current.user_id],
        });

        return {
            updated: true,
            staff: this.serializeStaffDetailRow(updated, true),
        };
    }

    async updateStaffStatus(
        resId: Types.ObjectId,
        staffId: Types.ObjectId,
        dto: UpdateStaffStatusDto,
    ): Promise<{ unchanged: boolean; status: StaffStatus; warnings: string[] }> {
        await this.checkWriteRateLimit(
            resId.toString(),
            "Vui lòng cho 1 phút trước khi tiếp tục cập nhật trạng thái nhân viên",
        )

        const staff = await this.getStaffOrThrow(resId, staffId);

        if (staff.status === dto.status) {
            return {
                unchanged: true,
                status: staff.status,
                warnings: [],
            };
        }

        const warnings: string[] = [];
        if (dto.status === StaffStatus.TERMINATED) {
            const activeOrders = await this.orderRepository.countActiveByStaff(resId, staffId);
            if (activeOrders > 0) {
                warnings.push(`Đang phụ trách ${activeOrders} đơn hàng active`);
            }
        }

        const updated = await this.staffRepository.updateStaffStatus(
            resId,
            staffId,
            dto.status,
        );

        if (!updated) {
            throw new NotFoundException(
                ERROR_CODE.RESOURCE_NOT_FOUND,
                "Staff not found",
                { staff_id: staffId.toString(), restaurant_id: resId.toString() },
            );
        }

        const staffUserId = updated.user_id;
        await this.invalidateStaffCaches(resId, {
            list: true,
            staffId,
            userIds: [staffUserId],
        });

        return {
            unchanged: false,
            status: updated.status,
            warnings,
        };
    }

    async linkAccount(
        resId: Types.ObjectId,
        staffId: Types.ObjectId,
        newUserId: Types.ObjectId,
    ): Promise<{ linked: boolean; user_id: string }> {
        await this.checkWriteRateLimit(
            resId.toString(),
            "Vui lòng cho 1 phút trước khi tiếp tục liên kết tài khoản",
        )

        const staff = await this.getStaffOrThrow(resId, staffId);

        const currentUserId =  staff.user_id;
        if (ObjectIdUtil.isSameObjectId(currentUserId, newUserId)) {
            return {
                linked: true,
                user_id: newUserId.toString(),
            };
        }

        await this.assertUserExists(newUserId);

        const duplicatedUserLink = await this.staffRepository.findByUserInRestaurant(
            resId,
            newUserId,
            staffId,
        );
        if (duplicatedUserLink) {
            throw new ConflictException(
                ERROR_CODE.CONFLICT_ERROR,
                "Tài khoản đã được liên kết với nhân viên khác trong nhà hàng",
                { user_id: newUserId.toString() },
            );
        }

        const updated = await this.staffRepository.linkUserAccount(
            resId,
            staffId,
            newUserId,
        );

        if (!updated) {
            throw new NotFoundException(
                ERROR_CODE.RESOURCE_NOT_FOUND,
                "Staff not found",
                { staff_id: staffId.toString(), restaurant_id: resId.toString() },
            );
        }

        await this.invalidateStaffCaches(resId, {
            list: true,
            staffId,
            userIds: [currentUserId, newUserId],
        });

        return {
            linked: true,
            user_id: newUserId.toString(),
        };
    }

    async updatePermissions(
        resId: Types.ObjectId,
        staffId: Types.ObjectId,
        payload: UpdateStaffPermissionsDto,
    ): Promise<{ updated: boolean; permissions: Record<string, boolean> }> {
        await this.checkWriteRateLimit(
            resId.toString(),
            "Vui lòng cho 1 phút trước khi tiếp tục cập nhật quyền hạn nhân viên",
        )

        const staff = await this.getStaffOrThrow(resId, staffId);

        const patch = this.extractPermissionPatch(payload);
        if (Object.keys(patch).length === 0) {
            throw new BadRequestException(
                ERROR_CODE.VALIDATION_ERROR,
                "Không có trường permissions nào được cung cấp để cập nhật",
            );
        }

        const data: Record<StaffPermissionKey, boolean> = {
            ...(staff.permissions ?? ({} as StaffPermissions)),
            ...patch,
        }

        const updated = await this.staffRepository.updatePermissions(
            resId,
            staffId,
            data,
        );

        if (!updated) {
            throw new NotFoundException(
                ERROR_CODE.RESOURCE_NOT_FOUND,
                "Staff not found",
                { staff_id: staffId.toString(), restaurant_id: resId.toString() },
            );
        }

        await this.invalidateStaffCaches(resId, {
            list: true,
            staffId,
            userIds: [staff.user_id],
        });

        return {
            updated: true,
            permissions: (updated.permissions ?? {}) as unknown as Record<string, boolean>,
        };
    }

    async updateAvatar(
        resId: Types.ObjectId,
        staffId: Types.ObjectId,
        userId: Types.ObjectId,
        avatar_url: string,
        isBypassCheck = false,
    ): Promise<{ avatar_url: string | null }> {
        await this.checkWriteRateLimit(
            resId.toString(),
            "Vui lòng cho 1 phút trước khi tiếp tục cập nhật ảnh đại diện nhân viên",
        )

        const staff = await this.getStaffOrThrow(resId, staffId);

        if (!isBypassCheck) {
            this.assertStaffCanEditSelf(staff, userId);
        }

        const updated = await this.staffRepository.updateFieldsInRestaurant(
            resId,
            staffId,
            {
                avatar_url: StringUtil.normalizeNullableString(avatar_url),
            },
        );

        if (!updated) {
            throw new NotFoundException(
                ERROR_CODE.RESOURCE_NOT_FOUND,
                "Staff not found",
                { staff_id: staffId.toString(), restaurant_id: resId.toString() },
            );
        }

        await this.invalidateStaffCaches(resId, {
            list: true,
            staffId,
        });

        return {
            avatar_url: updated.avatar_url ?? null,
        };
    }

    async softDeleteStaff(
        resId: Types.ObjectId,
        staffId: Types.ObjectId,
    ): Promise<{ deleted: boolean }> {
        await this.checkWriteRateLimit(
            resId.toString(),
            "Vui lòng cho 1 phút trước khi tiếp tục xoá nhân viên",
        )

        const staff = await this.getStaffOrThrow(resId, staffId);

        const activeOrders = await this.orderRepository.countActiveByStaff(resId, staffId);
        if (activeOrders > 0) {
            throw new ConflictException(
                ERROR_CODE.CONFLICT_ERROR,
                `Đang phụ trách ${activeOrders} đơn hàng active - không thể xoá`,
                { active_orders: activeOrders },
            );
        }

        const deleted = await this.staffRepository.softDeleteInRestaurant(resId, staffId);
        if (!deleted) {
            throw new NotFoundException(
                ERROR_CODE.RESOURCE_NOT_FOUND,
                "Staff not found",
                { staff_id: staffId.toString(), restaurant_id: resId.toString() },
            );
        }
        const staffUserId = staff.user_id;

        await this.invalidateStaffCaches(resId, {
            list: true,
            staffId,
            userIds: [staffUserId],
        });

        return { deleted: true };
    }

    async getStaffByUserOrThrow(
        resId: Types.ObjectId,
        userId: Types.ObjectId,
    ): Promise<StaffDocument> {
        const cacheKey = `${CACHE_STAFF_AUTH_KEY_PREFIX}${userId.toString()}:${resId.toString()}`;
        const cached = await this.redis.get(cacheKey);
        if (cached) {
            const staff = JSON.parse(cached) as StaffDocument;
            if (
                ObjectIdUtil.isSameObjectId(ObjectIdUtil.toObjectId(staff.restaurant_id, "restaurant_id"), resId) &&
                ObjectIdUtil.isSameObjectId(ObjectIdUtil.toObjectId(staff.user_id, "user_id"), userId) &&
                staff.status === StaffStatus.ACTIVE &&
                !staff.deleted_at
            ) {
                return staff;
            }
        }

        const staff = await this.staffRepository.findByUserInRestaurant(resId, userId);
        if (!staff || staff.status !== StaffStatus.ACTIVE ) {
            throw new ForbiddenException(
                ERROR_CODE.FORBIDDEN,
                "Bạn không thuộc staff active của nhà hàng này",
            );
        }

        await this.redis.set(cacheKey, JSON.stringify(staff), "EX", CACHE_STAFF_AUTH_TTL_SECONDS);
        await this.redis.set(
            `${CACHE_STAFF_DETAIL_KEY_PREFIX}${staff._id.toString()}`,
            JSON.stringify(staff),
            "EX",
            CACHE_STAFF_DETAIL_TTL_SECONDS,
        );

        return staff;
    }

    private async getStaffOrThrow(
        resId: Types.ObjectId,
        staffId: Types.ObjectId,
    ): Promise<StaffDocument> {
        const cacheKey = `${CACHE_STAFF_DETAIL_KEY_PREFIX}${staffId.toString()}`;
        const cached = await this.redis.get(cacheKey);
        if (cached) {
            const staff = JSON.parse(cached) as StaffDocument;
            if (ObjectIdUtil.isSameObjectId(ObjectIdUtil.toObjectId(staff.restaurant_id, "restaurant_id"), resId)) {
                return staff;
            }
        }

        const staff = await this.staffRepository.findByIdInRestaurant(resId, staffId);

        if (!staff) {
            throw new NotFoundException(
                ERROR_CODE.RESOURCE_NOT_FOUND,
                "Nhân viên không tồn tại",
                { staff_id: staffId.toString(), restaurant_id: resId.toString() },
            );
        }

        await this.redis.set(cacheKey, JSON.stringify(staff), "EX", CACHE_STAFF_DETAIL_TTL_SECONDS);

        return staff;
    }

    private serializeStaffListRow(staff: StaffDocument): Record<string, unknown> {
        const src = this.toPlainObject(staff);
        return {
            id: this.readEntityId(src),
            employee_code: src.employee_code,
            full_name: src.full_name,
            position: src.position,
            status: src.status,
            hire_date: src.hire_date,
            avatar_url: src.avatar_url,
            user_id: src.user_id,
            created_at: src.created_at,
        };
    }

    private serializeStaffDetailRow(
        staff: StaffDocument,
        includePermissions: boolean,
    ): Record<string, unknown> {
        const src = this.toPlainObject(staff);
        const base = {
            id: this.readEntityId(src),
            employee_code: src.employee_code,
            full_name: src.full_name,
            phone: src.phone,
            email: src.email,
            position: src.position,
            hire_date: src.hire_date,
            avatar_url: src.avatar_url,
            status: src.status,
            user_id: src.user_id,
            created_at: src.created_at,
            updated_at: src.updated_at,
        } as Record<string, unknown>;

        if (includePermissions) {
            base.permissions = src.permissions ?? {};
        }

        return base;
    }

    private extractPermissionPatch(
        payload: UpdateStaffPermissionsDto,
    ): Record<StaffPermissionKey, boolean> {
        const patch: Partial<Record<StaffPermissionKey, boolean>> = {};
        const source = payload as Partial<Record<StaffPermissionKey, boolean>>;

        for (const key of Object.values(StaffPermissionKey) as StaffPermissionKey[]) {
            const value = source[key];
            if (typeof value === "boolean") {
                patch[key] = value;
            }
        }

        return patch as Record<StaffPermissionKey, boolean>;
    }

    private async invalidateStaffCaches(
        resId: Types.ObjectId,
        options: {
            staffId?: Types.ObjectId;
            list?: boolean;
            userIds?: Types.ObjectId[];
        },
    ): Promise<void> {
        const keys = new Set<string>();

        if (options.staffId) {
            keys.add(`${CACHE_STAFF_DETAIL_KEY_PREFIX}${options.staffId.toString()}`);
        }

        if (options.list) {
            keys.add(`${CACHE_STAFF_LIST_KEY_PREFIX}${resId.toString()}`);
        }

        for (const userId of options.userIds ?? []) {
            keys.add(`${CACHE_STAFF_AUTH_KEY_PREFIX}${userId.toString()}:${resId.toString()}`);
        }

        if (keys.size > 0) {
            await this.redis.del(...Array.from(keys));
        }
    }
    
    private async assertUserExists(userId: Types.ObjectId): Promise<void> {
        const user = await this.userRepository.findUserExistById(userId, false);

        if (!user) {
            throw new NotFoundException(
                ERROR_CODE.USER_NOT_FOUND,
                "Tài khoản không tồn tại",
                { user_id: userId.toString() },
            );
        }
    }

    private assertStaffCanEditSelf(staff: StaffDocument, userId: Types.ObjectId): void {
        if (!userId) {
            throw new ForbiddenException(
                ERROR_CODE.FORBIDDEN,
                "Chỉ được thao tác trên tài khoản của chính mình",
            );
        }

        const actorUserId = ObjectIdUtil.toObjectId(userId, "user_id");
        const staffUserId = ObjectIdUtil.toObjectId(staff.user_id, "user_id");

        if (!ObjectIdUtil.isSameObjectId(actorUserId, staffUserId)) {
            throw new ForbiddenException(
                ERROR_CODE.FORBIDDEN,
                "Chỉ được thao tác trên tài khoản của chính mình",
            );
        }
    }

    private toPlainObject(staff: StaffDocument): Staff & { _id?: Types.ObjectId; id?: string } {
        const asAny = staff as any;
        if (typeof asAny.toObject === "function") {
            return asAny.toObject();
        }
        return { ...asAny };
    }

    private readEntityId(entity: { id?: unknown; _id?: unknown }): string {
        const id = (entity.id ?? entity._id) as Types.ObjectId | string | undefined;
        return id ? String(id) : "";
    }

    private parseHireDate(value: Date | string): Date {
        const hireDate = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(hireDate.getTime())) {
            throw new BadRequestException(
                ERROR_CODE.VALIDATION_ERROR,
                "hire_date is invalid",
            );
        }

        const now = new Date();
        if (hireDate.getTime() > now.getTime()) {
            throw new BadRequestException(
                ERROR_CODE.VALIDATION_ERROR,
                "hire_date cannot be in the future",
            );
        }

        return hireDate;
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

    private async checkWriteRateLimit(resId: string, message: string): Promise<void> {
        await this.checkRateLimit(
            `${RATE_LIMIT_STAFF_WRITE_PREFIX}${resId}`,
            RATE_LIMIT_STAFF_WRITE_MAX,
            RATE_LIMIT_STAFF_WRITE_TTL_SECONDS,
            message,
        );
    }
}
