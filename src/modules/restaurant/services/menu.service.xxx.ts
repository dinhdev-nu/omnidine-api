import { Inject, Injectable } from "@nestjs/common";
import { Types } from "mongoose";
import Redis from "ioredis";
import { ERROR_CODE } from "src/common/constants/error-code.constant";
import { INJECTION_TOKEN } from "src/common/constants/injection-token.constant";
import {
    BadRequestException,
    ConflictException,
    NotFoundException,
    TooManyRequestException,
} from "src/common/exceptions";
import { IPaginatedResult } from "src/common/interfaces/paginated-result.interface";
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
import {
    IMenuCategoryRepository,
    IMenuItemQueryFilters,
    IMenuItemRepository,
    IUpdateMenuItemPayload,
    IUpdateMenuCategory,
} from "../repositories";
import { MenuItemImage } from "../schemas/menu-item.schema";
import { RestaurantService } from "../restaurant.service.xxx";
import { ObjectUtil } from "src/common/utils/object.ultil";
import { ObjectIdUtil } from "src/common/utils/object-id.util";
import { IOrderRepository } from "../../order/repositories/order.repository";

const CACHE_MENU_CATEGORIES_PREFIX = "menu:categories:";
const CACHE_MENU_CATEGORIES_TTL_SECONDS = 300;
const CACHE_MENU_ITEM_PREFIX = "menu:item:";
const CACHE_MENU_ITEM_TTL_SECONDS = 300;
const CACHE_MENU_ITEMS_PREFIX = "menu:items:";
const CACHE_MENU_ITEMS_TTL_SECONDS = 300;
const CACHE_MENU_PUBLIC_PREFIX = "menu:public:";
const CACHE_MENU_PUBLIC_TTL_SECONDS = 600;
const CACHE_MENU_ITEM_SEARCH_PREFIX = "menu:search:"; // + q
const CACHE_MENU_ITEM_SEARCH_TTL_SECONDS = 600;

const RATE_LIMIT_MENU_WRITE_PREFIX = "ratelimit:menu:write:";
const RATE_LIMIT_MENU_WRITE_TTL_SECONDS = 60;
const RATE_LIMIT_MENU_WRITE_MAX = 30;
const RATE_LIMIT_MENU_IMAGE_PREFIX = "ratelimit:menu:image:";
const RATE_LIMIT_MENU_IMAGE_TTL_SECONDS = 3600;
const RATE_LIMIT_MENU_IMAGE_MAX = 20;

const MAX_ACTIVE_CATEGORIES = 50;
const MAX_ITEMS_PER_CATEGORY = 200;
const MAX_ITEM_IMAGES = 10;

const TRUSTED_IMAGE_HOST_PATTERNS = [
    "cloudinary",
    "amazonaws.com",
    "googleapis.com",
    "minio",
    "cdn",
];

@Injectable()
export class MenuService {
    constructor(
        @Inject(INJECTION_TOKEN.MENU_CATEGORY_REPOSITORY)
        private readonly menuCategoryRepository: IMenuCategoryRepository,

        @Inject(INJECTION_TOKEN.MENU_ITEM_REPOSITORY)
        private readonly menuItemRepository: IMenuItemRepository,

        @Inject(INJECTION_TOKEN.ORDER_REPOSITORY)
        private readonly orderRepository: IOrderRepository,

        private readonly restaurantService: RestaurantService,

        @Inject(INJECTION_TOKEN.REDIS_CLIENT)
        private readonly redis: Redis,
    ) {}

    async createCategory(
        resId: Types.ObjectId,
        payload: CreateMenuCategoryDto,
    ): Promise<Record<string, unknown>> {
        await this.checkWriteRateLimit(
            resId,
            "Tạo danh mục quá nhiều lần, vui lòng thử lại sau",
        );

        const activeCount = await this.menuCategoryRepository.countActiveByRestaurant(
            resId,
        );
        if (activeCount >= MAX_ACTIVE_CATEGORIES) {
            throw new BadRequestException(
                ERROR_CODE.VALIDATION_ERROR,
                `Dat gioi han ${MAX_ACTIVE_CATEGORIES} danh muc active`,
            );
        }

        const sortOrder = payload.sort_order !== undefined
            ? payload.sort_order
            : await this.nextCategorySortOrder(resId);

        const created = await this.menuCategoryRepository.createOne({
            restaurant_id: resId,
            name: payload.name,
            description: payload.description ?? null,
            image_url: payload.image_url ?? null,
            sort_order: sortOrder,
            is_active: true,
        });

        // Invalidate cache
        await this.invalidateCategoryCaches(resId);

        return this.toPlainObject(created);
    }

    async listCategories(
        resId: Types.ObjectId,
        query: ListMenuCategoryQueryDto = {},
    ): Promise<{ data: Record<string, unknown>[] }> {
        const includeInactive = query.include_inactive === true;
        const cacheKey = `${CACHE_MENU_CATEGORIES_PREFIX}${resId.toString()}`;

        let fullList: Record<string, unknown>[];

        const cached = await this.redis.get(cacheKey);
        if (cached) {
            fullList = JSON.parse(cached) as Record<string, unknown>[];
        } else {
            const [categories, itemCountMap] = await Promise.all([
                this.menuCategoryRepository.listByRestaurant(resId),
                this.menuItemRepository.countByCategoryMap(resId),
            ]);

            fullList = categories.map((category) => {
                const mapped = this.toPlainObject(category);
                const id = category._id.toString();
                mapped.item_count = itemCountMap[id] ?? 0;
                return mapped;
            });

            await this.redis.set(
                cacheKey,
                JSON.stringify(fullList),
                "EX",
                CACHE_MENU_CATEGORIES_TTL_SECONDS,
            );
        }

        return {
            data: includeInactive
                ? fullList
                : fullList.filter((row) => row.is_active === true),
        };
    }

    async updateCategory(
        resId: Types.ObjectId,
        categoryId: Types.ObjectId,
        payload: UpdateMenuCategoryDto,
    ): Promise<{ updated: boolean; category: Record<string, unknown> }> {
        await this.checkWriteRateLimit(
            resId,
            "Cập nhật danh mục quá nhiều lần, vui lòng thử lại sau",
        );

        await this.getCategoryOrThrow(resId, categoryId);

        const data: IUpdateMenuCategory = {};

        if (payload.name !== undefined) data.name = payload.name;
        if (payload.description !== undefined) data.description = payload.description;
        if (payload.image_url !== undefined) data.image_url = payload.image_url;

        if (!Object.keys(data).length) {
            throw new BadRequestException(
                ERROR_CODE.VALIDATION_ERROR,
                "Khong co field hop le de cap nhat danh muc",
            );
        }

        const updated = await this.menuCategoryRepository.updateInRestaurant(
            resId,
            categoryId,
            data,
        );

        if (!updated) {
            throw new NotFoundException(
                ERROR_CODE.RESOURCE_NOT_FOUND,
                "Danh muc khong ton tai",
            );
        }

        await this.invalidateCategoryCaches(resId);

        return {
            updated: true,
            category: this.toPlainObject(updated),
        };
    }

    async toggleCategoryActive(
        resId: Types.ObjectId,
        categoryId: Types.ObjectId,
        payload: ToggleMenuCategoryDto,
    ): Promise<{ is_active: boolean; message: string }> {
        await this.checkWriteRateLimit(resId, "Thay đổi trạng thái danh mục quá nhiều lần, vui lòng thử lại sau");

        const category = await this.getCategoryOrThrow(resId, categoryId);

        if (payload.is_active && category.is_active !== true) {
            const activeCount = await this.menuCategoryRepository.countActiveByRestaurant(
                resId,
            );
            if (activeCount >= MAX_ACTIVE_CATEGORIES) {
                throw new BadRequestException(
                    ERROR_CODE.VALIDATION_ERROR,
                    `Dat gioi han ${MAX_ACTIVE_CATEGORIES} danh muc active`,
                );
            }
        }

        const updated = await this.menuCategoryRepository.toggleActive(
            resId,
            categoryId,
            payload.is_active,
        );

        if (!updated) {
            throw new NotFoundException(
                ERROR_CODE.RESOURCE_NOT_FOUND,
                "Danh muc khong ton tai",
            );
        }

        await this.invalidateCategoryCaches(resId);

        return {
            is_active: updated.is_active,
            message: updated.is_active ? "Da hien" : "Da an",
        };
    }

    async reorderCategories(
        resId: Types.ObjectId,
        payload: ReorderMenuCategoriesDto,
    ): Promise<{ reordered: boolean }> {
        await this.checkWriteRateLimit(resId, "Sắp xếp danh mục quá nhiều lần, vui lòng thử lại sau");

        const [dbIds, reqIds] = await Promise.all([
            this.menuCategoryRepository.listIdsByRestaurant(resId),
            Promise.resolve(
                payload.order.map((id) => ObjectIdUtil.toObjectId(id, "category_id")),
            ),
        ]);

        this.assertSameIdSet(
            reqIds,
            dbIds,
            "order phai chua du tat ca id danh muc",
        );

        // Không cần transaction vì fail cũng reorder được
        await this.menuCategoryRepository.bulkReorder(resId, reqIds);

        await this.invalidateCategoryCaches(resId);

        return { reordered: true };
    }

    async deleteCategory(
        resId: Types.ObjectId,
        categoryId: Types.ObjectId,
    ): Promise<{ deleted: boolean }> {
        await this.checkWriteRateLimit(resId, "Xóa danh mục quá nhiều lần, vui lòng thử lại sau");

        await this.getCategoryOrThrow(resId, categoryId);

        const itemsCount = await this.menuItemRepository.countByCategory(
            resId,
            categoryId,
        );
        if (itemsCount > 0) {
            throw new ConflictException(
                ERROR_CODE.CONFLICT_ERROR,
                `Con ${itemsCount} mon an trong danh muc, khong the xoa - hay xoa hoac chuyen mon an di truoc`,
                { items_count: itemsCount },
            );
        }

        const deleted = await this.menuCategoryRepository.deleteInRestaurant(
            resId,
            categoryId,
        );

        if (!deleted) {
            throw new NotFoundException(
                ERROR_CODE.RESOURCE_NOT_FOUND,
                "Danh muc khong ton tai",
            );
        }

        await this.invalidateCategoryCaches(resId);

        return { deleted: true };
    }

    async createItem(
        resId: Types.ObjectId,
        payload: CreateMenuItemDto,
    ): Promise<Record<string, unknown>> {
        const { category_id } = payload

        await this.checkWriteRateLimit(resId);

        await this.getCategoryOrThrow(resId, category_id);

        const itemCountInCategory = await this.menuItemRepository.countByCategory(
            resId,
            category_id,
        );

        if (itemCountInCategory >= MAX_ITEMS_PER_CATEGORY) {
            throw new BadRequestException(
                ERROR_CODE.VALIDATION_ERROR,
                `Dat gioi han ${MAX_ITEMS_PER_CATEGORY} mon trong danh muc`,
            );
        }

        const sortOrder = payload.sort_order !== undefined
            ? payload.sort_order
            : await this.nextItemSortOrder(resId, category_id);

        const created = await this.menuItemRepository.create({
            restaurant_id: resId,
            category_id: category_id,
            name: payload.name,
            description: payload.description ?? null,
            base_price: payload.base_price,
            images: [],
            is_available: payload.is_available ?? true,
            is_featured: payload.is_featured ?? false,
            sort_order: sortOrder,
            deleted_at: null,
        });

        await this.invalidateItemCaches(resId, {
            item_id: ObjectIdUtil.toObjectId(
                created._id as Types.ObjectId | string,
                "item_id",
            ),
            category_id: category_id,
            include_item_category: true,
            include_categories: true,
        });

        return this.toPlainObject(created);
    }

    async listItems(
        resId: Types.ObjectId,
        query: ListMenuItemsQueryDto = {},
    ): Promise<IPaginatedResult<Record<string, unknown>>> {
        const {
            page = 1,
            limit = 50,
        } = query;

        const categoryId = query.category_id
            ? ObjectIdUtil.toObjectId(query.category_id as string, "category_id")
            : undefined;

        const useCache = Boolean(
            categoryId &&
            page === 1 &&
            query.is_available === undefined &&
            query.is_featured === undefined,
        );

        const cacheKey = categoryId
            ? `${CACHE_MENU_ITEMS_PREFIX}${resId.toString()}:${categoryId.toString()}`
            : "";

        if (useCache && cacheKey) {
            const cached = await this.redis.get(cacheKey);
            if (cached) {
                return JSON.parse(cached) as IPaginatedResult<Record<string, unknown>>;
            }
        }

        const filters: IMenuItemQueryFilters = {
            page,
            limit,
            category_id: categoryId,
            is_available: query.is_available,
            is_featured: query.is_featured,
        };

        const result = await this.menuItemRepository.listByRestaurant(
            resId,
            filters,
        );

        const response: IPaginatedResult<Record<string, unknown>> = {
            data: result.data.map((item) => this.toPlainObject(item)),
            pagination: {
                page,
                limit,
                total: result.total,
                total_pages: Math.max(Math.ceil(result.total / limit), 1),
            },
        };

        if (useCache && cacheKey) {
            await this.redis.set(
                cacheKey,
                JSON.stringify(response),
                "EX",
                CACHE_MENU_ITEMS_TTL_SECONDS,
            );
        }

        return response;
    }

    async getItemDetail(
        resId: Types.ObjectId,
        itemId: Types.ObjectId,
    ): Promise<Record<string, unknown>> {
        const cacheKey = `${CACHE_MENU_ITEM_PREFIX}${itemId.toString()}`;
        const cached = await this.redis.get(cacheKey);
        if (cached) {
            return JSON.parse(cached) as Record<string, unknown>;
        }

        const item = await this.getItemOrThrow(resId, itemId);
        const mapped = this.toPlainObject(item);

        await this.redis.set(
            cacheKey,
            JSON.stringify(mapped),
            "EX",
            CACHE_MENU_ITEM_TTL_SECONDS,
        );

        return mapped;
    }

    async updateItem(
        resId: Types.ObjectId,
        itemId: Types.ObjectId,
        payload: UpdateMenuItemDto,
    ): Promise<{ updated: boolean; item: Record<string, unknown> }> {
        await this.checkWriteRateLimit(resId);

        const current = await this.getItemOrThrow(resId, itemId);
        const currentCategoryId = current.category_id as Types.ObjectId; 

        const data: IUpdateMenuItemPayload = {};
        let targetCategoryId = currentCategoryId;

        if (payload.name !== undefined) data.name = payload.name;
        if (payload.description !== undefined) data.description = payload.description;
        if (payload.base_price !== undefined) data.base_price = payload.base_price;
        
        if (payload.category_id !== undefined) {
            const nextCategoryId = ObjectIdUtil.toObjectId(
                payload.category_id,
                "category_id",
            );
            await this.getCategoryOrThrow(resId, nextCategoryId);

            targetCategoryId = nextCategoryId;
            data.category_id = nextCategoryId;
        }

        if (!Object.keys(data).length) {
            throw new BadRequestException(
                ERROR_CODE.VALIDATION_ERROR,
                "Khong co field hop le de cap nhat mon an",
            );
        }

        const updated = await this.menuItemRepository.updateInRestaurant(
            resId,
            itemId,
            data as IUpdateMenuItemPayload,
        );

        if (!updated) {
            throw new NotFoundException(
                ERROR_CODE.RESOURCE_NOT_FOUND,
                "Mon an khong ton tai",
            );
        }

        // Invalidate caches
        const menuItemCacheKey = `${CACHE_MENU_ITEM_PREFIX}${itemId.toString()}`;
        const menuItemCatCacheKey = `${CACHE_MENU_ITEMS_PREFIX}${resId.toString()}:${currentCategoryId.toString()}`;
        const menuItemTargetCatCacheKey = `${CACHE_MENU_ITEMS_PREFIX}${resId.toString()}:${targetCategoryId.toString()}`;
        const menuPublic = `${CACHE_MENU_PUBLIC_PREFIX}${resId.toString()}`;
        await this.redis.del(menuItemCacheKey, menuItemCatCacheKey, menuItemTargetCatCacheKey, menuPublic);

        return {
            updated: true,
            item: this.toPlainObject(updated),
        };
    }

    async toggleItemAvailability(
        resId: Types.ObjectId,
        itemId: Types.ObjectId,
        payload: ToggleMenuItemAvailabilityDto,
    ): Promise<{ is_available: boolean; message: string; warnings: string[] }> {
        await this.checkWriteRateLimit(resId);

        const item = await this.getItemOrThrow(resId, itemId);
        const categoryId = ObjectIdUtil.toObjectId((item as any).category_id, "category_id");

        const warnings: string[] = [];
        if (payload.is_available === false) {
            const activeRefs = await this.orderRepository.countActiveOrderItems(resId, itemId);
            if (activeRefs > 0) {
                warnings.push(`Co ${activeRefs} mon dang duoc xu ly`);
            }
        }

        const updated = await this.menuItemRepository.toggleAvailability(
            resId,
            itemId,
            payload.is_available,
        );

        if (!updated) {
            throw new NotFoundException(
                ERROR_CODE.RESOURCE_NOT_FOUND,
                "Mon an khong ton tai",
            );
        }

        await this.invalidateItemCaches(resId, {
            item_id: itemId,
            category_id: categoryId,
            include_categories: false,
            include_item_detail: true,
            include_item_category: true,
        });

        return {
            is_available: updated.is_available,
            message: updated.is_available ? "Con hang" : "Het hang",
            warnings,
        };
    }

    async toggleItemFeatured(
        resId: Types.ObjectId,
        itemId: Types.ObjectId,
        payload: ToggleMenuItemFeaturedDto,
    ): Promise<{ is_featured: boolean; message: string }> {
        await this.checkWriteRateLimit(resId, "Thay đổi trạng thái nổi bật của món ăn quá nhiều lần, vui lòng thử lại sau");

        const item = await this.getItemOrThrow(resId, itemId);
        const categoryId = ObjectIdUtil.toObjectId((item as any).category_id, "category_id");

        const updated = await this.menuItemRepository.toggleFeatured(
            resId,
            itemId,
            payload.is_featured,
        );

        if (!updated) {
            throw new NotFoundException(
                ERROR_CODE.RESOURCE_NOT_FOUND,
                "Mon an khong ton tai",
            );
        }

        await this.invalidateItemCaches(resId, {
            item_id: itemId,
            category_id: categoryId,
            include_item_detail: true,
            include_categories: false,
        });

        return {
            is_featured: updated.is_featured,
            message: updated.is_featured
                ? "Da danh dau noi bat"
                : "Da bo noi bat",
        };
    }

    async addItemImage(
        resId: Types.ObjectId,
        itemId: Types.ObjectId,
        payload: AddMenuItemImageDto,
    ): Promise<{ images: MenuItemImage[]; count: number }> {
        await this.checkWriteRateLimit(resId, "Them anh mon an qua nhieu lan, vui long thu lai sau");
        await this.checkImageRateLimit(itemId);

        const item = await this.getItemOrThrow(resId, itemId);
        const categoryId = ObjectIdUtil.toObjectId((item as any).category_id, "category_id");

        const currentImages = Array.isArray(item.images)
            ? (item.images as MenuItemImage[])
            : [];

        if (currentImages.length >= MAX_ITEM_IMAGES) {
            throw new BadRequestException(
                ERROR_CODE.VALIDATION_ERROR,
                `Dat toi da ${MAX_ITEM_IMAGES} anh cho mot mon`,
            );
        }

        const updated = await this.menuItemRepository.appendImage(
            resId,
            itemId,
            {
                url: payload.url,
                alt: payload.alt ?? payload.url,
            },
        );

        if (!updated) {
            throw new NotFoundException(
                ERROR_CODE.RESOURCE_NOT_FOUND,
                "Mon an khong ton tai",
            );
        }

        await this.invalidateItemCaches(resId, {
            item_id: itemId,
            category_id: categoryId,
            include_item_detail: true,
            include_item_category: true,
            include_categories: false,
        });

        const images = Array.isArray(updated.images) ? updated.images : [];

        return {
            images,
            count: images.length,
        };
    }

    async removeItemImage(
        resId: Types.ObjectId,
        itemId: Types.ObjectId,
        index: number,
    ): Promise<{ images: MenuItemImage[]; count: number }> {
        await this.checkWriteRateLimit(resId, "Xóa ảnh món ăn quá nhiều lần, vui lòng thử lại sau");

        if (!Number.isInteger(index) || index < 0) {
            throw new BadRequestException(
                ERROR_CODE.VALIDATION_ERROR,
                "index khong hop le",
            );
        }

        const item = await this.getItemOrThrow(resId, itemId);
        const categoryId = ObjectIdUtil.toObjectId((item as any).category_id, "category_id");
        const currentImages = Array.isArray((item as any).images)
            ? ((item as any).images as MenuItemImage[])
            : [];

        if (index >= currentImages.length) {
            throw new NotFoundException(
                ERROR_CODE.RESOURCE_NOT_FOUND,
                "Anh khong ton tai",
                { index },
            );
        }

        const updated = await this.menuItemRepository.removeImageAt(
            resId,
            itemId,
            index,
        );

        if (!updated) {
            throw new NotFoundException(
                ERROR_CODE.RESOURCE_NOT_FOUND,
                "Mon an khong ton tai",
            );
        }

        await this.invalidateItemCaches(resId, {
            item_id: itemId,
            category_id: categoryId,
            include_item_detail: true,
            include_item_category: true,
        });

        const images = Array.isArray(updated.images) ? updated.images : [];

        return {
            images,
            count: images.length,
        };
    }

    async reorderItems(
        resId: Types.ObjectId,
        payload: ReorderMenuItemsDto,
    ): Promise<{ reordered: boolean }> {
        const categoryId = ObjectIdUtil.toObjectId(payload.category_id, "category_id");

        await this.checkWriteRateLimit(resId, "Sắp xếp món ăn quá nhiều lần, vui lòng thử lại sau");

        await this.getCategoryOrThrow(resId, categoryId);

        const [databaseIds, requestIds] = await Promise.all([
            this.menuItemRepository.listIdsByCategory(resId, categoryId),
            Promise.resolve(payload.order.map((id) => ObjectIdUtil.toObjectId(id, "item_id"))),
        ]);

        this.assertSameIdSet(
            requestIds,
            databaseIds,
            "order phai chua du tat ca id mon trong danh muc",
        );

        await this.menuItemRepository.bulkReorderByCategory(
            resId,
            categoryId,
            requestIds,
        );

        await this.invalidateItemCaches(resId, {
            category_id: categoryId,
            include_categories: false,
            include_item_category: true,
        });

        return { reordered: true };
    }

    async softDeleteItem(
        resId: Types.ObjectId,
        itemId: Types.ObjectId,
    ): Promise<{ deleted: boolean }> {
        await this.checkWriteRateLimit(resId, "Xóa món ăn quá nhiều lần, vui lòng thử lại sau");

        const item = await this.getItemOrThrow(resId, itemId);
        const categoryId = ObjectIdUtil.toObjectId((item as any).category_id, "category_id");

        const deleted = await this.menuItemRepository.softDeleteInRestaurant(
            resId,
            itemId,
        );

        if (!deleted) {
            throw new NotFoundException(
                ERROR_CODE.RESOURCE_NOT_FOUND,
                "Mon an khong ton tai",
            );
        }

        await this.invalidateItemCaches(resId, {
            item_id: itemId,
            category_id: categoryId,
            include_categories: true,
            include_item_category: true,
            include_item_detail: true,
        });

        return { deleted: true };
    }

    async getPublicMenuBySlug(
        slug: string,
    ): Promise<Record<string, unknown>> {
        const restaurant = await this.restaurantService.getRestaurantDetailsBySlug(slug);
        
        if (!restaurant) {
            throw new NotFoundException(
                ERROR_CODE.RESOURCE_NOT_FOUND,
                "Nha hang khong ton tai",
            );
        }

        const restaurantId = ObjectIdUtil.toObjectId(
            restaurant._id as Types.ObjectId | string,
            "restaurant_id",
        );
        const publicCacheKey = `${CACHE_MENU_PUBLIC_PREFIX}${restaurantId.toString()}`;
        const cached = await this.redis.get(publicCacheKey);
        if (cached) {
            return JSON.parse(cached) as Record<string, unknown>;
        }

        const categories = await this.menuCategoryRepository.listByRestaurant(restaurantId);
        const activeCategories = categories.filter((cat) => cat.is_active === true);
        const activeCategoryIds = activeCategories.map((cat) => ObjectIdUtil.toObjectId((cat as any)._id, "category_id"));

        const items = await this.menuItemRepository.listPublicAvailableByRestaurant(
            restaurantId,
            activeCategoryIds,
        );

        const categoryRows = activeCategories.map((cat) => {
            return {
                ...ObjectUtil.omit(this.toPlainObject(cat), ['_id', "restaurant_id", "sort_order", "__v"], ["created_at", "updated_at"]),
                items: items
                    .filter((item) => item.category_id && ObjectIdUtil.isSameObjectId(item.category_id, cat._id))
                    .map((item) => ObjectUtil.pick(item, ["_id", "name", "description", "base_price", "images", "is_featured", "sort_order"], ["created_at", "updated_at"])),
            }
        })

        const response = {
            restaurant: ObjectUtil.omit(restaurant, ["_id", 'owner_id', 'settings' , 'slug', "__v"], ["created_at", "updated_at"]),
            categories: categoryRows,
        };

        await this.redis.set(
            publicCacheKey,
            JSON.stringify(response),
            "EX",
            CACHE_MENU_PUBLIC_TTL_SECONDS,
        );

        return response;
    }

    async searchPublicMenuItem(
        slug: string,
        query: PublicMenuSearchQueryDto,
    ): Promise<IPaginatedResult<Record<string, unknown>> & { query: string }> {
        const { q, page = 1, limit = 20 } = query;

        
        
        const restaurant = await this.restaurantService.getRestaurantDetailsBySlug(slug);
        const resId = ObjectIdUtil.toObjectId(
            restaurant._id as Types.ObjectId | string,
            "restaurant_id",
        );
        
        const useCache = Boolean(q && q.trim().length > 0 && page === 1);
        const cacheKey = `${CACHE_MENU_ITEM_SEARCH_PREFIX}${resId.toString()}:${q}`;
        if (useCache) {
            const cached = await this.redis.get(cacheKey);
            if (cached) {
                const parsed = JSON.parse(cached) as IPaginatedResult<Record<string, unknown>> & { query: string };
                if (parsed.query === q) {
                    return parsed;
                }
            }
        }

        const searchResult = await this.menuItemRepository.searchPublicAvailableByRestaurant(
            resId,
            q,
            page,
            limit,
        );

        const response: IPaginatedResult<Record<string, unknown>> & { query: string } = {
            query: q,
            data: searchResult.data,
            pagination: {
                page,
                limit,
                total: searchResult.total,
                total_pages: Math.max(Math.ceil(searchResult.total / limit), 1),
            },

        }

        if (useCache) {
            await this.redis.set(
                cacheKey,
                JSON.stringify(response),
                "EX",
                CACHE_MENU_ITEM_SEARCH_TTL_SECONDS,
            );
        }
        return response;
    }

    private async getCategoryOrThrow(
        restaurantId: Types.ObjectId,
        categoryId: Types.ObjectId,
    ) {
        const category = await this.menuCategoryRepository.findByIdInRestaurant(
            restaurantId,
            categoryId,
        );

        if (!category) {
            throw new NotFoundException(
                ERROR_CODE.RESOURCE_NOT_FOUND,
                "Danh muc khong ton tai",
                { category_id: categoryId.toString(), restaurant_id: restaurantId.toString() },
            );
        }

        return category;
    }

    private async getItemOrThrow(
        restaurantId: Types.ObjectId,
        itemId: Types.ObjectId,
    ) {
        const item = await this.menuItemRepository.findByIdInRestaurant(
            restaurantId,
            itemId,
        );

        if (!item) {
            throw new NotFoundException(
                ERROR_CODE.RESOURCE_NOT_FOUND,
                "Mon an khong ton tai",
                { item_id: itemId.toString(), restaurant_id: restaurantId.toString() },
            );
        }

        return item;
    }

    private async nextCategorySortOrder(
        restaurantId: Types.ObjectId,
    ): Promise<number> {
        const max = await this.menuCategoryRepository.getMaxSortOrderByRestaurant(
            restaurantId,
        );
        return max + 1;
    }

    private async nextItemSortOrder(
        restaurantId: Types.ObjectId,
        categoryId: Types.ObjectId,
    ): Promise<number> {
        const max = await this.menuItemRepository.getMaxSortOrderByCategory(
            restaurantId,
            categoryId,
        );
        return max + 1;
    }

    private assertSameIdSet(
        payloadIds: Types.ObjectId[],
        databaseIds: Types.ObjectId[],
        message: string,
    ): void {
        const payloadSet = new Set(payloadIds.map((id) => id.toString()));
        const databaseSet = new Set(databaseIds.map((id) => id.toString()));

        if (payloadSet.size !== databaseSet.size) {
            throw new BadRequestException(ERROR_CODE.VALIDATION_ERROR, message);
        }

        for (const dbId of databaseSet) {
            if (!payloadSet.has(dbId)) {
                throw new BadRequestException(ERROR_CODE.VALIDATION_ERROR, message);
            }
        }
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

    private async checkWriteRateLimit(
        restaurantId: Types.ObjectId,
        message: string = "Vuot qua gioi han ghi menu trong 1 phut",
    ): Promise<void> {
        const key = `${RATE_LIMIT_MENU_WRITE_PREFIX}${restaurantId.toString()}`;
        await this.checkRateLimit(
            key,
            RATE_LIMIT_MENU_WRITE_MAX,
            RATE_LIMIT_MENU_WRITE_TTL_SECONDS,
            message,
        );
    }

    private async checkImageRateLimit(
        itemId: Types.ObjectId,
    ): Promise<void> {
        const key = `${RATE_LIMIT_MENU_IMAGE_PREFIX}${itemId.toString()}`;
        await this.checkRateLimit(
            key,
            RATE_LIMIT_MENU_IMAGE_MAX,
            RATE_LIMIT_MENU_IMAGE_TTL_SECONDS,
            "Vuot qua gioi han upload anh trong 1 gio",
        );
    }

    private async checkRateLimit(
        key: string,
        max: number,
        ttlSeconds: number,
        message: string,
    ): Promise<void> {
        const count = await this.redis.incr(key);
        if (count === 1) await this.redis.expire(key, ttlSeconds);

        if (count > max) {
            throw new TooManyRequestException(
                ERROR_CODE.TOO_MANY_REQUESTS, 
                message
            );
        }
    }

    private async invalidateCategoryCaches(
        restaurantId: Types.ObjectId,
    ): Promise<void> {
        await this.redis.del(
            `${CACHE_MENU_CATEGORIES_PREFIX}${restaurantId.toString()}`,
            `${CACHE_MENU_PUBLIC_PREFIX}${restaurantId.toString()}`,
        );
    }

    private async invalidateItemCaches(
        restaurantId: Types.ObjectId,
        options: {
            item_id?: Types.ObjectId;
            category_id?: Types.ObjectId;
            include_item_detail?: boolean;
            include_item_category?: boolean;
            include_categories?: boolean;
        },
    ): Promise<void> {
        const keys = new Set<string>();
        
        keys.add(`${CACHE_MENU_PUBLIC_PREFIX}${restaurantId.toString()}`);
        if (options.include_item_detail && options.item_id) {
            keys.add(`${CACHE_MENU_ITEM_PREFIX}${options.item_id.toString()}`);
        }

        if (options.include_item_category && options.category_id) {
            keys.add(`${CACHE_MENU_ITEMS_PREFIX}${restaurantId.toString()}:${options.category_id.toString()}`);
        }
        if (options.include_categories) {
            keys.add(`${CACHE_MENU_CATEGORIES_PREFIX}${restaurantId.toString()}`);
        }

        if (keys.size > 0) {
            await this.redis.del(...Array.from(keys));
        }
    }
}
