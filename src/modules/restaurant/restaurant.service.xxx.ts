import { Inject, Injectable } from "@nestjs/common";
import Redis from "ioredis";
import { INJECTION_TOKEN } from "src/common/constants/injection-token.constant";
import { IRestaurantRepository, ISearchResult } from "./repositories";
import { AddRestaurantGalleryImageDto, CreateRestaurantDto, SearchRestaurantDto, UpdateOperatingHoursDto, UpdateRestaurantCoverDto, UpdateRestaurantDto, UpdateRestaurantfinancialDto, UpdateRestaurantLogoDto, UpdateRestaurantSettingsDto } from "./dto/restaurant.dto";
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException, TooManyRequestException } from "src/common/exceptions";
import { ERROR_CODE } from "src/common/constants/error-code.constant";
import { SlugUtil } from "src/common/utils/slug.util";
import { Types } from "mongoose";
import { RestaurantDocument } from "./schemas/restaurant.schema.xxx";
import { ObjectUtil } from "src/common/utils/object.ultil";
import { ObjectIdUtil } from "src/common/utils/object-id.util";
import { IOrderRepository } from "../order/repositories/order.repository";
import { AppConfigService } from "src/config/config.service";

interface IPageRequest {
    page?: number;
    limit?: number;
    status?: string;
}


const CACHE_RESTAURANT_SLUG_PREFIX = 'restaurant:slug:';
const CACHE_RESTAURANT_SLUG_TTL = 60 * 60; // 1 hour in seconds
const CACHE_RESTAURANT_OWNER_LIST_PREFIX = 'restaurant:list:owner:';
const CACHE_RESTAURANT_OWNER_LIST_TTL = 60 * 60; // 1 hour in seconds
const CACHE_RESTAURANT_DETAILS_PREFIX = 'restaurant:details:';
const CACHE_RESTAURANT_DETAILS_TTL = 60 * 60; // 1 hour in seconds

const CACHE_RESTAURANT_PUBLIC_SLUG_PREFIX = 'restaurant:public:slug:';
const CACHE_RESTAURANT_PUBLIC_SLUG_TTL = 60 * 60; // 1 hour in seconds


const RATE_LIMIT_CREATE_KEY_PREFIX = 'ratelimit:restaurant:create:';
const RATE_LIMIT_CREATE_TTL = 86400;
const RATE_LIMIT_UPDATE_KEY_PREFIX = 'ratelimit:restaurant:update:';
const RATE_LIMIT_UPDATE_TTL = 60;
const RATE_LIMIT_IMAGE_KEY_PREFIX = 'ratelimit:restaurant:image:';
const RATE_LIMIT_IMAGE_TTL = 3600;
const RATE_LIMIT_IMAGE_LIMIT = 20;

const IMAGE_URL_EXT_REGEX = /\.(jpg|jpeg|png|webp)$/i;

const RESTAURANT_SETTINGS_WHITELIST = [
    'auto_confirm_orders',
    'min_order_amount',
    'delivery_radius_km',
    'max_advance_booking_days',
] as const;

type RestaurantSettingKey = typeof RESTAURANT_SETTINGS_WHITELIST[number];


@Injectable()
export class RestaurantService {

    constructor(
        @Inject(INJECTION_TOKEN.RESTAURANT_REPOSITORY)
        private readonly restaurantRepository: IRestaurantRepository,

        @Inject(INJECTION_TOKEN.ORDER_REPOSITORY)
        private readonly orderRepository: IOrderRepository,

        @Inject(INJECTION_TOKEN.REDIS_CLIENT) 
        private readonly redis: Redis,

        private readonly config: AppConfigService,
    ) {}


    async checkRestaurantSlug(slug: string): Promise<{ available: boolean }> {
        
        // Get from cache
        const cacheKey = `${CACHE_RESTAURANT_SLUG_PREFIX}${slug}`;
        const raw = await this.redis.get(cacheKey);
        if (raw !== null)  return { available: !!raw };

        // Get db 
        const restaurant = await this.restaurantRepository.getBySlug(slug);
        if (restaurant) {
            await this.redis.set(cacheKey, JSON.stringify({id: restaurant._id}), 'EX', CACHE_RESTAURANT_SLUG_TTL);
            return { available: false };
        }

        return { available: true };
    }

    async create(dto: CreateRestaurantDto, ownerId: Types.ObjectId) {

        const rateLimitKey = `${RATE_LIMIT_CREATE_KEY_PREFIX}${ownerId}`;
        const incr = await this.redis.incr(rateLimitKey);
        if (incr === 1) await this.redis.expire(rateLimitKey, RATE_LIMIT_CREATE_TTL);
        if (incr > 5) throw new TooManyRequestException(ERROR_CODE.TOO_MANY_REQUESTS, 'Bạn đã tạo quá nhiều nhà hàng hôm nay. Vui lòng thử lại sau.');

        const count = await this.restaurantRepository.getCountByOwner(ownerId);
        if (count >= 10) throw new ForbiddenException(ERROR_CODE.FORBIDDEN, 'Bạn chỉ có thể tạo tối đa 10 nhà hàng.');

        const hasOpenedDay = Object.keys(dto.operating_hours).some(day => {
            const hours = dto.operating_hours[day as keyof typeof dto.operating_hours];
            return hours && !hours.closed;
        })
        if (!hasOpenedDay) {
            throw new BadRequestException(ERROR_CODE.VALIDATION_ERROR, 'Nhà hàng phải mở cửa ít nhất 1 ngày trong tuần');
        }

        if (dto.slug) {
            const existing = await this.checkRestaurantSlug(dto.slug);
            if (!existing.available) {
                throw new ConflictException(ERROR_CODE.CONFLICT_ERROR, 'Slug đã được sử dụng. Vui lòng chọn slug khác.');
            }
        } else {
            Array.from({ length: 3 }).forEach(async (_, i: number) => {
                const slug = await SlugUtil.slugify(dto.name, i > 1);
                const existing = await this.checkRestaurantSlug(slug);
                if (existing.available) {
                    dto.slug = slug;
                    return;
                }
            })
            if (!dto.slug) {
                throw new ConflictException(ERROR_CODE.CONFLICT_ERROR, 'Không thể tạo slug tự động từ tên nhà hàng. Vui lòng cung cấp slug thủ công.');
            }
        }

        const newRes = await this.restaurantRepository.create({
            ...dto,
            owner_id: ownerId,
            is_published: false,
            accepts_online_orders: false,
            currency: 'VND',
            tax_rate: 0.1,
            service_charge_rate: 0.000,
            settings: {},
        })

        // Invalidate cache
        const ownerListCacheKey = `${CACHE_RESTAURANT_OWNER_LIST_PREFIX}${ownerId}`;
        await this.redis.del(ownerListCacheKey);

        return newRes;
    }

    async getRestaurantDetails(resId: Types.ObjectId, userId: Types.ObjectId) {
        
        const res = await this.handleGetResAndThrow(resId);
        if (res.owner_id === userId) {
            return res;
        }

        return {
            ...res.toObject(),
            tax_rate: undefined,
            service_charge_rate: undefined,
            settings: undefined,
        }
    }

    async updateRestaurant(dto: UpdateRestaurantDto, resId: Types.ObjectId, userId: Types.ObjectId) {
        const rateLimitKey = `${RATE_LIMIT_UPDATE_KEY_PREFIX}${resId}`;
        const incr = await this.redis.incr(rateLimitKey);
        if (incr === 1) await this.redis.expire(rateLimitKey, RATE_LIMIT_UPDATE_TTL);
        if (incr > 30) throw new TooManyRequestException(ERROR_CODE.TOO_MANY_REQUESTS, 'Bạn đã cập nhật nhà hàng quá nhiều lần trong hôm nay. Vui lòng thử lại sau.');

        const res = await this.handleGetResAndThrow(resId);

        const data = ObjectUtil.removeNullFields(dto);

        await this.restaurantRepository.update(resId, data);

        // Invalidate cache
        const resCacheKey = `${CACHE_RESTAURANT_DETAILS_PREFIX}${resId}`;
        const slugCacheKey = `${CACHE_RESTAURANT_SLUG_PREFIX}${res.slug}`;
        const publicCacheKey = `${CACHE_RESTAURANT_PUBLIC_SLUG_PREFIX}${res.slug}`;
        await this.redis.del(resCacheKey, slugCacheKey, publicCacheKey);
    }

    async updateOperatingHours(dto: UpdateOperatingHoursDto, resId: Types.ObjectId) {
        const rateLimitKey = `${RATE_LIMIT_UPDATE_KEY_PREFIX}${resId}`;
        const incr = await this.redis.incr(rateLimitKey);
        if (incr === 1) await this.redis.expire(rateLimitKey, RATE_LIMIT_UPDATE_TTL);
        if (incr > 30) throw new TooManyRequestException(ERROR_CODE.TOO_MANY_REQUESTS, 'Bạn đã cập nhật giờ mở cửa quá nhiều lần trong hôm nay. Vui lòng thử lại sau.');

        const res = await this.handleGetResAndThrow(resId);

        this.validateOperatingHours(dto.operating_hours);
        await this.restaurantRepository.update(resId, { operating_hours: dto.operating_hours });

        // Invalidate cache
        const resCacheKey = `${CACHE_RESTAURANT_DETAILS_PREFIX}${resId}`;
        const publicSlugCacheKey = `${CACHE_RESTAURANT_PUBLIC_SLUG_PREFIX}${res.slug}`;
        await this.redis.del(resCacheKey, publicSlugCacheKey);
    }

    async updateFinancialSettings(dto: UpdateRestaurantfinancialDto, resId: Types.ObjectId) {
        const rateLimitKey = `${RATE_LIMIT_UPDATE_KEY_PREFIX}${resId}`;
        const incr = await this.redis.incr(rateLimitKey);
        if (incr === 1) await this.redis.expire(rateLimitKey, RATE_LIMIT_UPDATE_TTL);
        if (incr > 30) throw new TooManyRequestException(ERROR_CODE.TOO_MANY_REQUESTS, 'Bạn đã cập nhật cài đặt tài chính quá nhiều lần trong hôm nay. Vui lòng thử lại sau.');

        await this.handleGetResAndThrow(resId);
        const data = ObjectUtil.removeNullFields(dto);
        await this.restaurantRepository.update(resId, data);

        // Invalidate cache
        const resCacheKey = `${CACHE_RESTAURANT_DETAILS_PREFIX}${resId}`;
        await this.redis.del(resCacheKey);
    }

    async updateRestaurantSettings(dto: UpdateRestaurantSettingsDto, resId: Types.ObjectId): Promise<{ updated: boolean, settings: Record<string, unknown> }> {
        const rateLimitKey = `${RATE_LIMIT_UPDATE_KEY_PREFIX}${resId}`;
        const incr = await this.redis.incr(rateLimitKey);
        if (incr === 1) await this.redis.expire(rateLimitKey, RATE_LIMIT_UPDATE_TTL);
        if (incr > 30) throw new TooManyRequestException(ERROR_CODE.TOO_MANY_REQUESTS, 'Bạn đã cập nhật cài đặt hệ thống quá nhiều lần trong hôm nay. Vui lòng thử lại sau.');

        await this.handleGetResAndThrow(resId);

        const patch = this.validateAndNormalizeSettingsPatch(dto.settings);
        const current = await this.restaurantRepository.findById(resId);
        const currentSettings = this.normalizeSettings(current?.settings);
        const mergedSettings = { ...currentSettings, ...patch };

        await this.restaurantRepository.update(resId, { settings: mergedSettings });

        const resCacheKey = `${CACHE_RESTAURANT_DETAILS_PREFIX}${resId}`;
        await this.redis.del(resCacheKey);

        return {
            updated: true,
            settings: mergedSettings,
        };
    }

    async updateRestaurantLogo(dto: UpdateRestaurantLogoDto, resId: Types.ObjectId): Promise<{ logo_url: string }> {
        await this.applyImageRateLimit(resId);

        const res = await this.handleGetResAndThrow(resId);
        this.validateImageUrl(dto.logo_url, 'logo_url');

        await this.restaurantRepository.update(resId, { logo_url: dto.logo_url });

        const resCacheKey = `${CACHE_RESTAURANT_DETAILS_PREFIX}${resId}`;
        const publicCacheKey = `${CACHE_RESTAURANT_PUBLIC_SLUG_PREFIX}${res.slug}`;
        await this.redis.del(resCacheKey, publicCacheKey);

        return { logo_url: dto.logo_url };
    }

    async updateRestaurantCover(dto: UpdateRestaurantCoverDto, resId: Types.ObjectId): Promise<{ cover_image_url: string }> {
        await this.applyImageRateLimit(resId);

        const res = await this.handleGetResAndThrow(resId);
        this.validateImageUrl(dto.cover_image_url, 'cover_image_url');

        await this.restaurantRepository.update(resId, { cover_image_url: dto.cover_image_url });

        const resCacheKey = `${CACHE_RESTAURANT_DETAILS_PREFIX}${resId}`;
        const publicCacheKey = `${CACHE_RESTAURANT_PUBLIC_SLUG_PREFIX}${res.slug}`;
        await this.redis.del(resCacheKey, publicCacheKey);

        return { cover_image_url: dto.cover_image_url };
    }

    async addRestaurantGalleryImage(dto: AddRestaurantGalleryImageDto, resId: Types.ObjectId): Promise<{ gallery_urls: string[], count: number }> {
        await this.applyImageRateLimit(resId);

        const res = await this.handleGetResAndThrow(resId);
        this.validateImageUrl(dto.image_url, 'image_url');

        const gallery = this.normalizeGalleryUrls(res.gallery_urls);
        if (gallery.length >= 20) {
            throw new BadRequestException(ERROR_CODE.VALIDATION_ERROR, 'Đã đạt tối đa 20 ảnh trong gallery.');
        }

        const nextGallery = [...gallery, dto.image_url];
        await this.restaurantRepository.update(resId, { gallery_urls: nextGallery });

        const resCacheKey = `${CACHE_RESTAURANT_DETAILS_PREFIX}${resId}`;
        const publicCacheKey = `${CACHE_RESTAURANT_PUBLIC_SLUG_PREFIX}${res.slug}`;
        await this.redis.del(resCacheKey, publicCacheKey);

        return {
            gallery_urls: nextGallery,
            count: nextGallery.length,
        };
    }

    async removeRestaurantGalleryImage(index: number, resId: Types.ObjectId): Promise<{ gallery_urls: string[], count: number }> {
        if (index < 0) {
            throw new BadRequestException(ERROR_CODE.VALIDATION_ERROR, 'index phải lớn hơn hoặc bằng 0.');
        }

        const res = await this.handleGetResAndThrow(resId);
        const gallery = this.normalizeGalleryUrls(res.gallery_urls);

        if (index >= gallery.length) {
            throw new NotFoundException(ERROR_CODE.RESOURCE_NOT_FOUND, 'Ảnh không tồn tại trong gallery.');
        }

        const nextGallery = gallery.filter((_, idx) => idx !== index);
        await this.restaurantRepository.update(resId, { gallery_urls: nextGallery });

        const resCacheKey = `${CACHE_RESTAURANT_DETAILS_PREFIX}${resId}`;
        const publicCacheKey = `${CACHE_RESTAURANT_PUBLIC_SLUG_PREFIX}${res.slug}`;
        await this.redis.del(resCacheKey, publicCacheKey);

        return {
            gallery_urls: nextGallery,
            count: nextGallery.length,
        };
    }

    async updatePublishStatus(is_published: boolean, resId: Types.ObjectId): Promise<{is_published: boolean, message: string}> {
        const rateLimitKey = `${RATE_LIMIT_UPDATE_KEY_PREFIX}${resId}`;
        const incr = await this.redis.incr(rateLimitKey);
        if (incr === 1) await this.redis.expire(rateLimitKey, RATE_LIMIT_UPDATE_TTL);
        if (incr > 30) throw new TooManyRequestException(ERROR_CODE.TOO_MANY_REQUESTS, 'Bạn đã cập nhật trạng thái xuất bản quá nhiều lần trong hôm nay. Vui lòng thử lại sau.');

        const res = await this.handleGetResAndThrow(resId);
        // Check điêu kiện để được phép publish
        if (!res.name || !res.address || !res.city || !res.operating_hours) {
            throw new BadRequestException(ERROR_CODE.VALIDATION_ERROR, 'Để xuất bản nhà hàng, bạn cần điền đầy đủ tên, địa chỉ, thành phố và giờ mở cửa.');
        }
        this.validateOperatingHours(res.operating_hours as UpdateOperatingHoursDto['operating_hours']);

        if(is_published === res.is_published) {
            return { is_published, message: 'Trạng thái xuất bản không thay đổi.' };
        }

        await this.restaurantRepository.update(resId, { is_published });

        // Invalidate cache
        const resCacheKey = `${CACHE_RESTAURANT_DETAILS_PREFIX}${resId}`;
        const resSlugCacheKey = `${CACHE_RESTAURANT_SLUG_PREFIX}${res.slug}`;
        const resPublicSlugCacheKey = `${CACHE_RESTAURANT_PUBLIC_SLUG_PREFIX}${res.slug}`;
        const ownerListCacheKey = `${CACHE_RESTAURANT_OWNER_LIST_PREFIX}${res.owner_id}`;
        await this.redis.del(resCacheKey, resSlugCacheKey, resPublicSlugCacheKey, ownerListCacheKey);
        return { is_published, message: 'Trạng thái xuất bản đã được cập nhật.' };
    }

    async updateAcceptOnlineOrders(accepts_online_orders: boolean, resId: Types.ObjectId): Promise<{accepts_online_orders: boolean, message: string}> {
        const rateLimitKey = `${RATE_LIMIT_UPDATE_KEY_PREFIX}${resId}`;
        const incr = await this.redis.incr(rateLimitKey);
        if (incr === 1) await this.redis.expire(rateLimitKey, RATE_LIMIT_UPDATE_TTL);
        if (incr > 30) throw new TooManyRequestException(ERROR_CODE.TOO_MANY_REQUESTS, 'Bạn đã cập nhật trạng thái nhận đơn online quá nhiều lần trong hôm nay. Vui lòng thử lại sau.');

        const res = await this.handleGetResAndThrow(resId);
        if(!res.is_published && accepts_online_orders) {
            throw new BadRequestException(ERROR_CODE.VALIDATION_ERROR, 'Chỉ có thể nhận đơn online khi nhà hàng đã được xuất bản.');
        }
        if(accepts_online_orders === res.accepts_online_orders) return { accepts_online_orders, message: 'Trạng thái nhận đơn online không thay đổi.' };

        await this.restaurantRepository.update(resId, { accepts_online_orders });

        // Invalidate cache
        const resCacheKey = `${CACHE_RESTAURANT_DETAILS_PREFIX}${resId}`;
        const resPublicSlugCacheKey = `${CACHE_RESTAURANT_PUBLIC_SLUG_PREFIX}${res.slug}`;
        await this.redis.del(resCacheKey, resPublicSlugCacheKey);
        return { accepts_online_orders, message: 'Trạng thái nhận đơn online đã được cập nhật.' };
    }

    async getRestaurantsByOwner(ownerId: Types.ObjectId, pagination: IPageRequest): Promise<{ data: Partial<RestaurantDocument>[], pagination: { page: number, limit: number, total: number, total_pages: number } }> {
        const { page = 1, limit = 10, status } = pagination;
        const useCache = page === 1 && !status; // Chỉ sử dụng cache cho trang đầu tiên và khi không có filter status
        // Page 1
        const cacheKey = `${CACHE_RESTAURANT_OWNER_LIST_PREFIX}${ownerId}:`;
        if (useCache) {
            const raw = await this.redis.get(cacheKey);
            if (raw) {
                return JSON.parse(raw);
            }
        }

        const [total, resList] = await Promise.all([
            this.restaurantRepository.getCountByOwner(ownerId),
            this.restaurantRepository.getListByOwner(ownerId, page, limit, status)
        ]); 
        
        // Build pagination metadata
        const totalPages = Math.ceil(total / limit);
        const response = {
            data: resList.map(res => ObjectUtil.pick(
                res, 
                ['_id', 'name', 'slug', 'is_published', 'accepts_online_orders', 'logo_url'],
                ['created_at']
            )),
            pagination: {
                page, limit, total,
                total_pages: totalPages
            }
        }

        if (useCache) {
            await this.redis.set(cacheKey, JSON.stringify(response), 'EX', CACHE_RESTAURANT_OWNER_LIST_TTL);
        }

        return response;
    }

    async deleteRestaurant(resId: Types.ObjectId): Promise<{deleted: boolean, message: string}> {
        const rlmtUpdateKey = `${RATE_LIMIT_UPDATE_KEY_PREFIX}${resId}`;
        const incr = await this.redis.incr(rlmtUpdateKey);
        if (incr === 1) await this.redis.expire(rlmtUpdateKey, RATE_LIMIT_UPDATE_TTL);
        if (incr > 30) throw new TooManyRequestException(ERROR_CODE.TOO_MANY_REQUESTS, 'Bạn đã xóa nhà hàng quá nhiều lần trong hôm nay. Vui lòng thử lại sau.');

        const res = await this.handleGetResAndThrow(resId);

        // Check orders in restaurant before delete
        const activeOrderCount = await this.orderRepository.countActiveByRestaurant(resId);
        if (activeOrderCount > 0) {
            throw new ConflictException(ERROR_CODE.CONFLICT_ERROR, 'Không thể xóa nhà hàng có đơn hàng đang chờ xử lý.');
        }

        // Soft delete
        await this.restaurantRepository.softDelete(resId);

        // Invalidate cache
        const delKeys = [
            `${CACHE_RESTAURANT_DETAILS_PREFIX}${resId}`,
            `${CACHE_RESTAURANT_SLUG_PREFIX}${res.slug}`,
            `${CACHE_RESTAURANT_PUBLIC_SLUG_PREFIX}${res.slug}`,
            `${CACHE_RESTAURANT_OWNER_LIST_PREFIX}${res.owner_id}`,
        ]
        await this.redis.del(...delKeys);

        return { deleted: true, message: 'Nhà hàng đã được xóa.' };
    }

    async searchRestaurants(dto: SearchRestaurantDto): Promise<ISearchResult> {
        return await this.restaurantRepository.search(dto);
    }

    async getRestaurantDetailsBySlug(slug: string): Promise<RestaurantDocument> {
        const cachePublicSlugKey = `${CACHE_RESTAURANT_PUBLIC_SLUG_PREFIX}${slug}`;
        const publicRaw = await this.redis.get(cachePublicSlugKey);

        if (publicRaw) {
            return JSON.parse(publicRaw);
        }

        const cacheSlugKey = `${CACHE_RESTAURANT_SLUG_PREFIX}${slug}`;
        const cached = await this.redis.get(cacheSlugKey);

        let resResult: RestaurantDocument | null = null;

        if (cached) {
            const cachedData = JSON.parse(cached) as { id: string };
            const objId = ObjectIdUtil.toObjectId(cachedData.id, "restaurant_id");
            resResult = await this.handleGetResAndThrow(objId);
        } else {
            resResult = await this.restaurantRepository.getBySlug(slug);
        }

        if (!resResult || !resResult.is_published) {
            throw new NotFoundException(
                ERROR_CODE.RESTAURANT_NOT_FOUND, 
                'Không tìm thấy nhà hàng'
            );
        }

        const res = ObjectUtil.omit(resResult, ['owner_id', 'settings']) as RestaurantDocument;

        await this.redis.set(cacheSlugKey, JSON.stringify({ id: resResult._id }), 'EX', CACHE_RESTAURANT_SLUG_TTL);
        await this.redis.set(cachePublicSlugKey, JSON.stringify(res), 'EX', CACHE_RESTAURANT_PUBLIC_SLUG_TTL);

        return res;
    }



    // --------------
    async handleGetResAndThrow(resId: Types.ObjectId): Promise<RestaurantDocument> {
        const cacheKey = `${CACHE_RESTAURANT_DETAILS_PREFIX}${resId}`;
        const resRaw = await this.redis.get(cacheKey);

        if (resRaw) {
            return JSON.parse(resRaw) as RestaurantDocument;
        }

        const res = await this.restaurantRepository.findOne({ _id: resId, deleted_at: null });
        if (!res) {
            throw new NotFoundException(ERROR_CODE.RESTAURANT_NOT_FOUND, 'Không tìm thấy nhà hàng');
        }

        await this.redis.set(
            cacheKey,
            JSON.stringify(res),
            'EX',
            CACHE_RESTAURANT_DETAILS_TTL
        );

        return res;
    }


    private validateOperatingHours(operating_hours: UpdateOperatingHoursDto['operating_hours']) {
        const hasOpenedDay = Object.keys(operating_hours).some(day => {
            const hours = operating_hours[day as keyof typeof operating_hours];
            return hours && !hours.closed;
        })
        if (!hasOpenedDay) {
            throw new BadRequestException(ERROR_CODE.VALIDATION_ERROR, 'Nhà hàng phải mở cửa ít nhất 1 ngày trong tuần');
        }
    }

    private async applyImageRateLimit(resId: Types.ObjectId): Promise<void> {
        const rateLimitKey = `${RATE_LIMIT_IMAGE_KEY_PREFIX}${resId}`;
        const incr = await this.redis.incr(rateLimitKey);
        if (incr === 1) await this.redis.expire(rateLimitKey, RATE_LIMIT_IMAGE_TTL);
        if (incr > RATE_LIMIT_IMAGE_LIMIT) {
            throw new TooManyRequestException(
                ERROR_CODE.TOO_MANY_REQUESTS,
                'Bạn đã cập nhật ảnh quá nhiều lần trong giờ này. Vui lòng thử lại sau.'
            );
        }
    }

    private validateImageUrl(url: string, field: string): void {
        let parsed: URL;
        try {
            parsed = new URL(url);
        } catch {
            throw new BadRequestException(ERROR_CODE.VALIDATION_ERROR, `${field} phải là URL hợp lệ.`);
        }

        if (parsed.protocol !== 'https:') {
            throw new BadRequestException(ERROR_CODE.VALIDATION_ERROR, `${field} phải là HTTPS URL.`);
        }

        if (!IMAGE_URL_EXT_REGEX.test(parsed.pathname)) {
            throw new BadRequestException(ERROR_CODE.VALIDATION_ERROR, `${field} chỉ chấp nhận đuôi jpg/jpeg/png/webp.`);
        }

        if (!this.isTrustedStorageHost(parsed)) {
            throw new BadRequestException(ERROR_CODE.VALIDATION_ERROR, `${field} phải thuộc trusted storage host.`);
        }
    }

    private isTrustedStorageHost(url: URL): boolean {
        if (url.hostname.toLowerCase() !== 'res.cloudinary.com') {
            return false;
        }

        const cloudinaryName = (this.config.upload.cloudinaryName || '').trim();
        if (!cloudinaryName) {
            return true;
        }

        return url.pathname.startsWith(`/${cloudinaryName}/`);
    }

    private normalizeGalleryUrls(value: unknown): string[] {
        if (!Array.isArray(value)) {
            return [];
        }

        return value.filter((item): item is string => typeof item === 'string');
    }

    private normalizeSettings(value: unknown): Record<string, unknown> {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            return {};
        }
        return value as Record<string, unknown>;
    }

    private validateAndNormalizeSettingsPatch(settings: Record<string, unknown>): Partial<Record<RestaurantSettingKey, unknown>> {
        const keys = Object.keys(settings);
        if (keys.length === 0) {
            throw new BadRequestException(ERROR_CODE.VALIDATION_ERROR, 'settings không được rỗng.');
        }

        const allowedKeys = new Set<string>(RESTAURANT_SETTINGS_WHITELIST);
        const unknownKeys = keys.filter((key) => !allowedKeys.has(key));
        if (unknownKeys.length > 0) {
            throw new BadRequestException(ERROR_CODE.VALIDATION_ERROR, `settings chứa key không hợp lệ: ${unknownKeys.join(', ')}`);
        }

        const hasNullValue = Object.values(settings).some((value) => value === null);
        if (hasNullValue) {
            throw new BadRequestException(ERROR_CODE.VALIDATION_ERROR, 'Không cho phép xoá key settings bằng null.');
        }

        const patch: Partial<Record<RestaurantSettingKey, unknown>> = {};

        if (Object.prototype.hasOwnProperty.call(settings, 'auto_confirm_orders')) {
            if (typeof settings.auto_confirm_orders !== 'boolean') {
                throw new BadRequestException(ERROR_CODE.VALIDATION_ERROR, 'auto_confirm_orders phải là boolean.');
            }
            patch.auto_confirm_orders = settings.auto_confirm_orders;
        }

        if (Object.prototype.hasOwnProperty.call(settings, 'min_order_amount')) {
            const value = settings.min_order_amount;
            if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
                throw new BadRequestException(ERROR_CODE.VALIDATION_ERROR, 'min_order_amount phải là số >= 0.');
            }
            patch.min_order_amount = value;
        }

        if (Object.prototype.hasOwnProperty.call(settings, 'delivery_radius_km')) {
            const value = settings.delivery_radius_km;
            if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
                throw new BadRequestException(ERROR_CODE.VALIDATION_ERROR, 'delivery_radius_km phải là số > 0.');
            }
            patch.delivery_radius_km = value;
        }

        if (Object.prototype.hasOwnProperty.call(settings, 'max_advance_booking_days')) {
            const value = settings.max_advance_booking_days;
            if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 365) {
                throw new BadRequestException(ERROR_CODE.VALIDATION_ERROR, 'max_advance_booking_days phải là số nguyên từ 1 đến 365.');
            }
            patch.max_advance_booking_days = value;
        }

        return patch;
    }
}