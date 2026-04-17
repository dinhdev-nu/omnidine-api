import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { FilterQuery, Model, Types, UpdateQuery } from "mongoose";
import { BaseRepository, IBaseRepository } from "src/common/repositories/base.repositories";
import {
    MenuCategory,
    MenuCategoryDocument,
} from "../schemas/menu-category.schema";

interface IOptions {
    includeInactive?: boolean;
    includeBaseUpdate: IUpdateMenuCategory;
}

export interface IUpdateMenuCategory extends Partial<MenuCategory> {}

export interface IMenuCategoryRepository extends IBaseRepository<MenuCategoryDocument> {
    countActiveByRestaurant(restaurantId: Types.ObjectId): Promise<number>;
    listByRestaurant(
        restaurantId: Types.ObjectId,
    ): Promise<MenuCategoryDocument[]>;
    listIdsByRestaurant(restaurantId: Types.ObjectId): Promise<Types.ObjectId[]>;
    findByIdInRestaurant(
        restaurantId: Types.ObjectId,
        categoryId: Types.ObjectId,
    ): Promise<MenuCategoryDocument | null>;
    getMaxSortOrderByRestaurant(restaurantId: Types.ObjectId): Promise<number>;
    createOne(data: Partial<MenuCategory>): Promise<MenuCategoryDocument>;
    updateInRestaurant(
        restaurantId: Types.ObjectId,
        categoryId: Types.ObjectId,
        data: IUpdateMenuCategory,
    ): Promise<MenuCategoryDocument | null>;
    toggleActive(
        restaurantId: Types.ObjectId,
        categoryId: Types.ObjectId,
        isActive: boolean,
    ): Promise<MenuCategoryDocument | null>;
    bulkReorder(
        restaurantId: Types.ObjectId,
        orderedCategoryIds: Types.ObjectId[],
    ): Promise<void>;
    deleteInRestaurant(
        restaurantId: Types.ObjectId,
        categoryId: Types.ObjectId,
    ): Promise<boolean>;
}

@Injectable()
export class MenuCategoryRepository
    extends BaseRepository<MenuCategoryDocument>
    implements IMenuCategoryRepository
{
    constructor(
        @InjectModel(MenuCategory.name)
        private readonly menuCategoryModel: Model<MenuCategoryDocument>,
    ) {
        super(menuCategoryModel);
    }

    async countActiveByRestaurant(restaurantId: Types.ObjectId): Promise<number> {
        return this.menuCategoryModel.countDocuments({
            restaurant_id: restaurantId,
            is_active: true,
        }).exec();
    }

    async listByRestaurant(restaurantId: Types.ObjectId): Promise<MenuCategoryDocument[]> {
        return this.menuCategoryModel
            .find({ restaurant_id: restaurantId })
            .sort({ sort_order: 1, created_at: 1 })
            .lean()
            .exec() as Promise<MenuCategoryDocument[]>;
    }

    async listIdsByRestaurant(restaurantId: Types.ObjectId): Promise<Types.ObjectId[]> {
        const docs = await this.menuCategoryModel
            .find({ restaurant_id: restaurantId })
            .select("_id")
            .sort({ sort_order: 1, created_at: 1 })
            .lean()
            .exec();

        return docs.map((doc: any) => doc._id as Types.ObjectId);
    }

    async findByIdInRestaurant(
        restaurantId: Types.ObjectId,
        categoryId: Types.ObjectId,
    ): Promise<MenuCategoryDocument | null> {
        return this.menuCategoryModel
            .findOne({
                _id: categoryId,
                restaurant_id: restaurantId,
            })
            .lean()
            .exec() as Promise<MenuCategoryDocument | null>;
    }

    async getMaxSortOrderByRestaurant(restaurantId: Types.ObjectId): Promise<number> {
        const doc = await this.menuCategoryModel
            .findOne({
                restaurant_id: restaurantId,
            })
            .select("sort_order")
            .sort({ sort_order: -1 })
            .lean()
            .exec() as { sort_order?: number } | null;

        return doc?.sort_order ?? -1;
    }

    async createOne(data: Partial<MenuCategory>): Promise<MenuCategoryDocument> {
        return this.menuCategoryModel.create(data) as Promise<MenuCategoryDocument>;
    }

    async updateInRestaurant(
        restaurantId: Types.ObjectId,
        categoryId: Types.ObjectId,
        data: IUpdateMenuCategory,
    ): Promise<MenuCategoryDocument | null> {
        return this.menuCategoryModel
            .findOneAndUpdate(
                {
                    _id: categoryId,
                    restaurant_id: restaurantId,
                },
                {
                    $set: data,
                },
                {
                    new: true,
                },
            )
            .lean()
            .exec() as Promise<MenuCategoryDocument | null>;
    }

    async toggleActive(
        restaurantId: Types.ObjectId,
        categoryId: Types.ObjectId,
        isActive: boolean,
    ): Promise<MenuCategoryDocument | null> {
        return this.menuCategoryModel
            .findOneAndUpdate(
                {
                    _id: categoryId,
                    restaurant_id: restaurantId,
                },
                {
                    $set: {
                        is_active: isActive,
                    },
                },
                {
                    new: true,
                },
            )
            .lean()
            .exec() as Promise<MenuCategoryDocument | null>;
    }

    async bulkReorder(
        restaurantId: Types.ObjectId,
        orderedCategoryIds: Types.ObjectId[],
    ): Promise<void> {
        if (!orderedCategoryIds.length) return;

        await this.menuCategoryModel.bulkWrite(
            orderedCategoryIds.map((categoryId, index) => ({
                updateOne: {
                    filter: {
                        _id: categoryId,
                        restaurant_id: restaurantId,
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

    async deleteInRestaurant(
        restaurantId: Types.ObjectId,
        categoryId: Types.ObjectId,
    ): Promise<boolean> {
        const result = await this.menuCategoryModel.deleteOne({
            _id: categoryId,
            restaurant_id: restaurantId,
        }).exec();

        return result.deletedCount > 0;
    }
}
