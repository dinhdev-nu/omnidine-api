import { BaseRepository, IBaseRepository } from "src/common/repositories/base.repositories";
import { RestaurantDocument, Restaurant } from "../schemas/restaurant.schema.xxx";
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { FilterQuery, Model, PipelineStage, Types } from "mongoose";
import { SearchRestaurantDto } from "../dto/restaurant.dto";


export interface ISearchResult {
    data: Partial<RestaurantDocument>[];
    pagination: { page: number, limit: number, total: number, total_pages: number };
}

export interface IRestaurantRepository extends IBaseRepository<RestaurantDocument> {
    getBySlug(slug: string): Promise<RestaurantDocument | null>;
    getResByIdWithOwnerCheck(resId: Types.ObjectId): Promise<RestaurantDocument | null>;
    getCountByOwner(ownerId: Types.ObjectId): Promise<number>;
    getListByOwner(ownerId: Types.ObjectId, page?: number, limit?: number, status?: string): Promise<RestaurantDocument[]>;
    softDelete(id: Types.ObjectId): Promise<boolean>;
    search(dto: SearchRestaurantDto): Promise<ISearchResult>;
}

@Injectable()
export class RestaurantRepository
extends BaseRepository<RestaurantDocument>
implements IRestaurantRepository {
    constructor(
        @InjectModel(Restaurant.name) 
        private readonly restaurantModel: Model<RestaurantDocument>,
    ) {
        super(restaurantModel);
    }

    async softDelete(id: Types.ObjectId): Promise<boolean> {
        const result = await this.restaurantModel.updateOne(
            { _id: id, deleted_at: null },
            { deleted_at: new Date(), is_published: false, updated_at: new Date() },
        ).exec();
        return result.modifiedCount > 0;
    }

    async getResByIdWithOwnerCheck(resId: Types.ObjectId): Promise<RestaurantDocument | null> {
        return this.restaurantModel.findOne({ _id: resId, deleted_at: null }).lean().exec();
    }

    async getBySlug(slug: string): Promise<RestaurantDocument | null> {
        return this.restaurantModel.findOne({ slug, deleted_at: null }).lean().exec();
    }

    async getCountByOwner(ownerId: Types.ObjectId): Promise<number> {
        return this.restaurantModel.countDocuments({ owner_id: ownerId, deleted_at: null }).exec();
    }

    async getListByOwner(ownerId: Types.ObjectId, page = 1, limit = 10, status?: string): Promise<RestaurantDocument[]> {
        const filter: FilterQuery<RestaurantDocument> = { owner_id: ownerId, deleted_at: null };
        if (status === 'published') {
            filter.is_published = true;
        }
        const skip = (page - 1) * limit;
        return this.restaurantModel.find(filter)
            .sort({ created_at: -1 })
            .skip(skip) 
            .limit(limit)
            .lean()
            .exec();

    }

    async search(dto: SearchRestaurantDto)
    : Promise<ISearchResult> {
        const {
            city, cuisine_type, price_range,
            accepts_online, lat, lng,
            radius_km = 10, q, sort = 'name',
            page = 1, limit = 20
        } = dto;

        const skip = (page - 1) * limit;
        const useGeo = lat !== undefined && lng !== undefined;
        const useSort = sort === 'distance' && useGeo; 
        const hasText = q && q.trim() !== '';

        const pipeline: PipelineStage[] = [];
        const query: FilterQuery<RestaurantDocument> = { deleted_at: null, is_published: true };

        if (city) query.city = city;
        if (cuisine_type) query.cuisine_type = cuisine_type;
        if (price_range && price_range.length > 0) query.price_range = { $in: price_range };
        if (accepts_online === true) query.accepts_online_orders = true;

        if (useGeo) {
            pipeline.push({
                $geoNear: {
                    near: { type: 'Point', coordinates: [lng, lat] },
                    distanceField: 'distance_m', // metres
                    maxDistance: radius_km * 1000, // convert km to m
                    spherical: true,
                    query: query
                },
            })

            pipeline.push({
                $addFields: {
                    distance_km: { $round: [{ $divide: ['$distance_m', 1000] }, 2] }
                }
            })
        } else {
            // Match stage nếu không dùng geo
            pipeline.push({ $match: query });
            pipeline.push({ $addFields: { distance_km: null } });
        }

        const extraMatch: FilterQuery<Restaurant> = {};
        if (hasText) extraMatch.name = { $regex: q, $options: 'i' };    

        if (Object.keys(extraMatch).length > 0) {
            pipeline.push({ $match: extraMatch });
        }

        pipeline.push({
            $facet: {
                metadata: [{ $count: 'total' }],
                data: [
                    ...(useSort 
                        ? [{ $sort: { distance_m: 1 } }]
                        : [{ $sort: { name: 1 } }]
                    ) as any[],

                    { $skip: skip },
                    { $limit: limit },
                    {
                        $project: {
                            _id:                   1,
                            name:                  1,
                            slug:                  1,
                            description:           1,
                            cuisine_type:          1,
                            price_range:           1,
                            logo_url:              1,
                            cover_image_url:       1,
                            address:               1,
                            city:                  1,
                            district:              1,
                            ward:                  1,
                            latitude:              1,
                            longitude:             1,
                            phone:                 1,
                            operating_hours:       1,
                            accepts_online_orders: 1,
                            distance_km:           1,
                        }
                    }
                ]
            }
        })

        const [result] = await this.restaurantModel.aggregate(pipeline).exec();

        const total = result?.metadata[0]?.total || 0;
        const total_pages = Math.ceil(total / limit);

        return {
            data: result?.data || [],
            pagination: {
                page,
                limit,
                total,
                total_pages
            }
        };
    }
}