import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { FilterQuery, Model, Types, UpdateQuery } from "mongoose";
import { BaseRepository, IBaseRepository } from "src/common/repositories/base.repositories";
import {
    MenuItem,
    MenuItemDocument,
    MenuItemImage,
} from "../schemas/menu-item.schema";

const ACTIVE_ORDER_ITEM_STATUSES = [
    "pending",
    "confirmed",
    "preparing",
    "ready",
    "delivering",
    "progress",
];

export interface IMenuItemQueryFilters {
    category_id?: Types.ObjectId;
    is_available?: boolean;
    is_featured?: boolean;
    page?: number;
    limit?: number;
}

export interface IMenuItemListResult {
    data: MenuItemDocument[];
    total: number;
}

export interface IUpdateMenuItemPayload {
    name?: string;
    description?: string | null;
    base_price?: number;
    category_id?: Types.ObjectId | null;
}

export interface IPublicMenuItemSearchResult {
    data: Array<Record<string, unknown>>;
    total: number;
}

export interface IMenuItemRepository extends IBaseRepository<MenuItemDocument> {
    countByCategory(
        restaurantId: Types.ObjectId,
        categoryId: Types.ObjectId,
    ): Promise<number>;
    countByCategoryMap(
        restaurantId: Types.ObjectId,
    ): Promise<Record<string, number>>;
    listByRestaurant(
        restaurantId: Types.ObjectId,
        filters?: IMenuItemQueryFilters,
    ): Promise<IMenuItemListResult>;
    listIdsByCategory(
        restaurantId: Types.ObjectId,
        categoryId: Types.ObjectId,
    ): Promise<Types.ObjectId[]>;
    findByIdInRestaurant(
        restaurantId: Types.ObjectId,
        itemId: Types.ObjectId,
    ): Promise<MenuItemDocument | null>;
    getMaxSortOrderByCategory(
        restaurantId: Types.ObjectId,
        categoryId: Types.ObjectId,
    ): Promise<number>;
    updateInRestaurant(
        restaurantId: Types.ObjectId,
        itemId: Types.ObjectId,
        data: IUpdateMenuItemPayload,
    ): Promise<MenuItemDocument | null>;
    toggleAvailability(
        restaurantId: Types.ObjectId,
        itemId: Types.ObjectId,
        isAvailable: boolean,
    ): Promise<MenuItemDocument | null>;
    toggleFeatured(
        restaurantId: Types.ObjectId,
        itemId: Types.ObjectId,
        isFeatured: boolean,
    ): Promise<MenuItemDocument | null>;
    appendImage(
        restaurantId: Types.ObjectId,
        itemId: Types.ObjectId,
        image: MenuItemImage,
    ): Promise<MenuItemDocument | null>;
    removeImageAt(
        restaurantId: Types.ObjectId,
        itemId: Types.ObjectId,
        index: number,
    ): Promise<MenuItemDocument | null>;
    bulkReorderByCategory(
        restaurantId: Types.ObjectId,
        categoryId: Types.ObjectId,
        orderedItemIds: Types.ObjectId[],
    ): Promise<void>;
    softDeleteInRestaurant(
        restaurantId: Types.ObjectId,
        itemId: Types.ObjectId,
    ): Promise<MenuItemDocument | null>;
    listPublicAvailableByRestaurant(
        restaurantId: Types.ObjectId,
        categoryIds: Types.ObjectId[],
    ): Promise<MenuItemDocument[]>;
    getAvailableItemsByUniqueIdsInRestaurant(
        restaurantId: Types.ObjectId,
        itemIds: Types.ObjectId[],
    ): Promise<MenuItemDocument[]>;
    searchPublicAvailableByRestaurant(
        restaurantId: Types.ObjectId,
        query: string,
        page: number,
        limit: number,
    ): Promise<IPublicMenuItemSearchResult>;
}

@Injectable()
export class MenuItemRepository
    extends BaseRepository<MenuItemDocument>
    implements IMenuItemRepository
{
    constructor(
        @InjectModel(MenuItem.name)
        private readonly menuItemModel: Model<MenuItemDocument>,
    ) {
        super(menuItemModel);
    }

    private baseQuery(restaurantId: Types.ObjectId): FilterQuery<MenuItemDocument> {
        return {
            restaurant_id: restaurantId,
            deleted_at: null,
        };
    }

    async getAvailableItemsByUniqueIdsInRestaurant(restaurantId: Types.ObjectId, itemIds: Types.ObjectId[]): Promise<MenuItemDocument[]> {
        if (!itemIds.length) return [];
        return this.menuItemModel.find({
            restaurant_id: restaurantId,
            _id: { $in: itemIds },
            deleted_at: null,
            is_available: true,
        })
        .select({ _id: 1, name: 1, base_price: 1 })
        .lean().exec() as Promise<MenuItemDocument[]>;
    }

    async countByCategory(
        restaurantId: Types.ObjectId,
        categoryId: Types.ObjectId,
    ): Promise<number> {
        return this.menuItemModel.countDocuments({
            restaurant_id: restaurantId,
            category_id: categoryId,
            deleted_at: null,
        }).exec();
    }

    async countByCategoryMap(
        restaurantId: Types.ObjectId,
    ): Promise<Record<string, number>> {
        const rows = await this.menuItemModel.aggregate([
            {
                $match: {
                    restaurant_id: restaurantId,
                    deleted_at: null,
                },
            },
            {
                $group: {
                    _id: "$category_id",
                    total: { $sum: 1 },
                },
            },
        ]).exec();

        return rows.reduce((acc: Record<string, number>, row: any) => {
            if (row?._id) {
                acc[row._id.toString()] = Number(row.total ?? 0);
            }
            return acc;
        }, {});
    }

    async listByRestaurant(
        restaurantId: Types.ObjectId,
        filters: IMenuItemQueryFilters = {},
    ): Promise<IMenuItemListResult> {
        const page = Math.max(filters.page ?? 1, 1);
        const limit = Math.max(filters.limit ?? 50, 1);
        const skip = (page - 1) * limit;

        const query: FilterQuery<MenuItemDocument> = this.baseQuery(restaurantId);

        if (filters.category_id) query.category_id = filters.category_id;
        if (filters.is_available !== undefined) query.is_available = filters.is_available;
        if (filters.is_featured !== undefined) query.is_featured = filters.is_featured;

        const [data, total] = await Promise.all([
            this.menuItemModel
                .find(query)
                .sort({ sort_order: 1, created_at: 1 })
                .skip(skip)
                .limit(limit)
                .lean()
                .exec(),
            this.menuItemModel.countDocuments(query).exec(),
        ]);

        return {
            data: data as MenuItemDocument[],
            total,
        };
    }

    async listIdsByCategory(
        restaurantId: Types.ObjectId,
        categoryId: Types.ObjectId,
    ): Promise<Types.ObjectId[]> {
        const docs = await this.menuItemModel
            .find({
                restaurant_id: restaurantId,
                category_id: categoryId,
                deleted_at: null,
            })
            .select("_id")
            .sort({ sort_order: 1, created_at: 1 })
            .lean()
            .exec();

        return docs.map((doc: any) => doc._id as Types.ObjectId);
    }

    async findByIdInRestaurant(
        restaurantId: Types.ObjectId,
        itemId: Types.ObjectId,
    ): Promise<MenuItemDocument | null> {
        return this.menuItemModel
            .findOne({
                _id: itemId,
                restaurant_id: restaurantId,
                deleted_at: null,
            })
            .lean()
            .exec() as Promise<MenuItemDocument | null>;
    }

    async getMaxSortOrderByCategory(
        restaurantId: Types.ObjectId,
        categoryId: Types.ObjectId,
    ): Promise<number> {
        const doc = await this.menuItemModel
            .findOne({
                restaurant_id: restaurantId,
                category_id: categoryId,
                deleted_at: null,
            })
            .select("sort_order")
            .sort({ sort_order: -1 })
            .lean()
            .exec() as { sort_order?: number } | null;

        return doc?.sort_order ?? -1;
    }

    async updateInRestaurant(
        restaurantId: Types.ObjectId,
        itemId: Types.ObjectId,
        data: IUpdateMenuItemPayload,
    ): Promise<MenuItemDocument | null> {
        const updateData: UpdateQuery<MenuItemDocument> = {...data};
        return this.menuItemModel
            .findOneAndUpdate(
                {
                    _id: itemId,
                    restaurant_id: restaurantId,
                    deleted_at: null,
                },
                {
                    $set: updateData,
                },
                {
                    new: true,
                },
            )
            .lean()
            .exec() as Promise<MenuItemDocument | null>;
    }

    async toggleAvailability(
        restaurantId: Types.ObjectId,
        itemId: Types.ObjectId,
        isAvailable: boolean,
    ): Promise<MenuItemDocument | null> {
        return this.menuItemModel
            .findOneAndUpdate(
                {
                    _id: itemId,
                    restaurant_id: restaurantId,
                    deleted_at: null,
                },
                {
                    $set: {
                        is_available: isAvailable,
                    },
                },
                {
                    new: true,
                },
            )
            .lean()
            .exec() as Promise<MenuItemDocument | null>;
    }

    async toggleFeatured(
        restaurantId: Types.ObjectId,
        itemId: Types.ObjectId,
        isFeatured: boolean,
    ): Promise<MenuItemDocument | null> {
        return this.menuItemModel
            .findOneAndUpdate(
                {
                    _id: itemId,
                    restaurant_id: restaurantId,
                    deleted_at: null,
                },
                {
                    $set: {
                        is_featured: isFeatured,
                    },
                },
                {
                    new: true,
                },
            )
            .lean()
            .exec() as Promise<MenuItemDocument | null>;
    }

    async appendImage(
        restaurantId: Types.ObjectId,
        itemId: Types.ObjectId,
        image: MenuItemImage,
    ): Promise<MenuItemDocument | null> {
        return this.menuItemModel
            .findOneAndUpdate(
                {
                    _id: itemId,
                    restaurant_id: restaurantId,
                    deleted_at: null,
                },
                {
                    $push: {
                        images: image,
                    },
                },
                {
                    new: true,
                },
            )
            .lean()
            .exec() as Promise<MenuItemDocument | null>;
    }

    async removeImageAt(
        restaurantId: Types.ObjectId,
        itemId: Types.ObjectId,
        index: number,
    ): Promise<MenuItemDocument | null> {
        const item = await this.findByIdInRestaurant(restaurantId, itemId);
        if (!item) return null;

        const images = Array.isArray(item.images) ? [...item.images] : [];
        if (index < 0 || index >= images.length) {
            return item;
        }

        images.splice(index, 1);

        return this.menuItemModel
            .findOneAndUpdate(
                {
                    _id: itemId,
                    restaurant_id: restaurantId,
                    deleted_at: null,
                },
                {
                    $set: {
                        images,
                    },
                },
                {
                    new: true,
                },
            )
            .lean()
            .exec() as Promise<MenuItemDocument | null>;
    }

    async bulkReorderByCategory(
        restaurantId: Types.ObjectId,
        categoryId: Types.ObjectId,
        orderedItemIds: Types.ObjectId[],
    ): Promise<void> {
        if (!orderedItemIds.length) return;

        await this.menuItemModel.bulkWrite(
            orderedItemIds.map((itemId, index) => ({
                updateOne: {
                    filter: {
                        _id: itemId,
                        restaurant_id: restaurantId,
                        category_id: categoryId,
                        deleted_at: null,
                    },
                    update: {
                        $set: {
                            sort_order: index,
                        },
                    },
                },
            })),
        );
    }

    async softDeleteInRestaurant(
        restaurantId: Types.ObjectId,
        itemId: Types.ObjectId,
    ): Promise<MenuItemDocument | null> {
        return this.menuItemModel
            .findOneAndUpdate(
                {
                    _id: itemId,
                    restaurant_id: restaurantId,
                    deleted_at: null,
                },
                {
                    $set: {
                        deleted_at: new Date(),
                        is_available: false,
                    },
                },
                {
                    new: true,
                },
            )
            .lean()
            .exec() as Promise<MenuItemDocument | null>;
    }

    async listPublicAvailableByRestaurant(
        restaurantId: Types.ObjectId,
        categoryIds: Types.ObjectId[],
    ): Promise<MenuItemDocument[]> {
        if (!categoryIds.length) return [];

        return this.menuItemModel
            .find({
                restaurant_id: restaurantId,
                category_id: { $in: categoryIds },
                is_available: true,
                deleted_at: null,
            })
            .sort({ category_id: 1, sort_order: 1, created_at: 1 })
            .lean()
            .exec() as Promise<MenuItemDocument[]>;
    }

    async searchPublicAvailableByRestaurant(
        restaurantId: Types.ObjectId,
        query: string,
        page: number,
        limit: number,
    ): Promise<IPublicMenuItemSearchResult> {
        const skip = (Math.max(page, 1) - 1) * Math.max(limit, 1);
        const matchStage = {
            restaurant_id: restaurantId,
            is_available: true,
            deleted_at: null,
            $text: { $search: query },
        };

        const [result] = await this.menuItemModel.aggregate([
            { // Match 
                $match: matchStage,
            },
            { // Add text score field for sorting full-text
                $addFields: {
                    score: { $meta: "textScore" },
                },
            },
            { // JOIN
                $lookup: {
                    from: "menu_categories",
                    localField: "category_id",
                    foreignField: "_id",
                    as: "category",
                }
            },
            { // Tách khỏi array ( category: [1,2] => category: 1, category: 2 )
                 $unwind: '$category'
            },
            {
                $match: { "category.is_active": true }
            },
            {
                $sort: { score: -1, sort_order: 1, created_at: 1 },
            },
            {  // Phân trang
                $facet: {
                    total: [{ $count: "total" }], // Đếm tổng số kết quả để tính toán pagination
                    data: [
                        { $skip: skip },
                        { $limit: limit },
                        { $project: {
                            _id: 1,
                            name: 1,
                            description: 1,
                            base_price: 1,
                            is_featured: 1,
                            images: 1,
                            category: { _id: 1, name: 1 },
                            score: 1, 
                        }}
                    ],
                },
            },
        ]).exec();

        return {
            data: (result?.data ?? []) as Array<Record<string, unknown>>,
            total: Number(result?.total?.[0]?.total ?? 0),
        };
    }
}
