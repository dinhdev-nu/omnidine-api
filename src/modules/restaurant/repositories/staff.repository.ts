import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { FilterQuery, Model, Types, UpdateQuery } from "mongoose";
import { BaseRepository, IBaseRepository } from "src/common/repositories/base.repositories";
import { Order, OrderDocument } from "src/modules/order/schemas/order.schema.xxx";
import {
    Staff,
    StaffDocument,
    StaffPermissionKey,
    StaffPosition,
    StaffStatus,
} from "../schemas/staff.schema.xxx";

const ACTIVE_ORDER_STATUSES = [
    "pending",
    "confirmed",
    "preparing",
    "ready",
    "delivering",
];

export interface IStaffQueryFilters {
    status?: StaffStatus;
    position?: StaffPosition;
    page?: number;
    limit?: number;
}

export interface IStaffListResult {
    data: StaffDocument[];
    total: number;
}

export interface IBaseUpdateStaffFields {
    full_name?: string;
    position?: StaffPosition;
    hire_date?: Date | string;
    phone?: string | null;
    email?: string | null;
    avatar_url?: string | null;
}

export interface IStaffRepository extends IBaseRepository<StaffDocument> {
    findByRestaurantId(restaurantId: Types.ObjectId, filters?: IStaffQueryFilters): Promise<IStaffListResult>;
    findByIdInRestaurant(
        restaurantId: Types.ObjectId,
        staffId: Types.ObjectId,
    ): Promise<StaffDocument | null>;
    findByEmployeeCodeInRestaurant(
        restaurantId: Types.ObjectId,
        employeeCode: string,
    ): Promise<StaffDocument | null>;
    findByUserInRestaurant(
        restaurantId: Types.ObjectId,
        userId: Types.ObjectId,
        excludeStaffId?: Types.ObjectId,
    ): Promise<StaffDocument | null>;
    findByIdWithRestaurant(staffId: Types.ObjectId): Promise<StaffDocument | null>;
    createOne(data: Partial<Staff>): Promise<StaffDocument>;
    updateFieldsInRestaurant(
        restaurantId: Types.ObjectId,
        staffId: Types.ObjectId,
        data: Partial<IBaseUpdateStaffFields>,
    ): Promise<StaffDocument | null>;
    updateStaffStatus(
        restaurantId: Types.ObjectId,
        staffId: Types.ObjectId,
        status: StaffStatus,
    ): Promise<StaffDocument | null>;
    updatePermissions(
        restaurantId: Types.ObjectId,
        staffId: Types.ObjectId,
        permissions: Record<StaffPermissionKey, boolean>,
    ): Promise<StaffDocument | null>;
    linkUserAccount(
        restaurantId: Types.ObjectId,
        staffId: Types.ObjectId,
        userId: Types.ObjectId,
    ): Promise<StaffDocument | null>;
    softDeleteInRestaurant(restaurantId: Types.ObjectId, staffId: Types.ObjectId): Promise<StaffDocument | null>;
}

@Injectable()
export class StaffRepository
    extends BaseRepository<StaffDocument>
    implements IStaffRepository
{
    constructor(
        @InjectModel(Staff.name)
        private readonly staffModel: Model<StaffDocument>,
    ) {
        super(staffModel);
    }

    private baseQuery(restaurantId: Types.ObjectId): FilterQuery<StaffDocument> {
        return {
            restaurant_id: restaurantId,
            deleted_at: null,
        };
    }

    async findByRestaurantId(
        restaurantId: Types.ObjectId,
        filters: IStaffQueryFilters = {},
    ): Promise<IStaffListResult> {
        const { page = 1, limit = 50 } = filters;
        const skip = (page - 1) * limit;

        const query: FilterQuery<StaffDocument> = this.baseQuery(restaurantId);

        if (filters.status) query.status = filters.status;
        if (filters.position) query.position = filters.position;

        const [data, total] = await Promise.all([
            this.staffModel
                .find(query)
                .select("-__v")
                .sort({ position: 1, full_name: 1 })
                .skip(skip)
                .limit(limit)
                .lean()
                .exec(),
            this.staffModel.countDocuments(query).exec(),
        ]);

        return {
            data: data as StaffDocument[],
            total,
        };
    }

    async findByIdInRestaurant(
        restaurantId: Types.ObjectId,
        staffId: Types.ObjectId,
    ): Promise<StaffDocument | null> {
        return this.staffModel
            .findOne({
                _id: staffId,
                restaurant_id: restaurantId,
                deleted_at: null,
            })
            .select("-__v")
            .lean()
            .exec() as Promise<StaffDocument | null>;
    }

    async findByEmployeeCodeInRestaurant(
        restaurantId: Types.ObjectId,
        employeeCode: string,
    ): Promise<StaffDocument | null> {
        return this.staffModel
            .findOne({
                restaurant_id: restaurantId,
                employee_code: employeeCode,
                deleted_at: null,
            })
            .select("-__v")
            .lean()
            .exec() as Promise<StaffDocument | null>;
    }

    async findByUserInRestaurant(
        restaurantId: Types.ObjectId,
        userId: Types.ObjectId,
        excludeStaffId?: Types.ObjectId,
    ): Promise<StaffDocument | null> {
        const query: FilterQuery<StaffDocument> = {
            restaurant_id: restaurantId,
            user_id: userId,
            deleted_at: null,
        };

        if (excludeStaffId) {
            query._id = { $ne: excludeStaffId };
        }

        return this.staffModel
            .findOne(query)
            .lean()
            .exec() as Promise<StaffDocument | null>;
    }

    async findByIdWithRestaurant(staffId: Types.ObjectId): Promise<StaffDocument | null> {
        return this.staffModel
            .findById(staffId)
            .populate({
                path: "restaurant_id",
                select: "_id ownerId",
            })
            .lean()
            .exec() as Promise<StaffDocument | null>;
    }

    async createOne(data: Partial<Staff>): Promise<StaffDocument> {
        return this.staffModel.create(data) as Promise<StaffDocument>;
    }

    async updateFieldsInRestaurant(
        restaurantId: Types.ObjectId,
        staffId: Types.ObjectId,
        data: IBaseUpdateStaffFields,
    ): Promise<StaffDocument | null> {
        const query: UpdateQuery<StaffDocument> = {};

        if (data.full_name !== undefined) query.full_name = data.full_name;
        if (data.position !== undefined) query.position = data.position;
        if (data.hire_date !== undefined) query.hire_date = data.hire_date;
        if (data.phone !== undefined) query.phone = data.phone;
        if (data.email !== undefined) query.email = data.email;
        if (data.avatar_url !== undefined) query.avatar_url = data.avatar_url;

        if (Object.keys(query).length === 0) {
            return null;
        }
        
        return this.staffModel
            .findOneAndUpdate(
                {
                    _id: staffId,
                    restaurant_id: restaurantId,
                    deleted_at: null,
                },
                {
                    $set: data,
                },
                { new: true },
            )
            .select("-__v")
            .lean()
            .exec() as Promise<StaffDocument | null>;
    }

    async updateStaffStatus(
        restaurantId: Types.ObjectId,
        staffId: Types.ObjectId,
        status: StaffStatus,
    ): Promise<StaffDocument | null> {
        return this.staffModel
            .findOneAndUpdate(
                {
                    _id: staffId,
                    restaurant_id: restaurantId,
                    deleted_at: null,
                },
                {
                    $set: {
                        status,
                    },
                },
                { new: true },
            )
            .select("-__v")
            .lean()
            .exec() as Promise<StaffDocument | null>;
    }

    async updatePermissions(
        restaurantId: Types.ObjectId,
        staffId: Types.ObjectId,
        permissions: Record<StaffPermissionKey, boolean>,
    ): Promise<StaffDocument | null> {
        return this.staffModel
            .findOneAndUpdate(
                {
                    _id: staffId,
                    restaurant_id: restaurantId,
                    deleted_at: null,
                },
                {
                    $set: {
                        permissions: permissions,
                    },
                },
                { new: true },
            )
            .select("-__v")
            .lean()
            .exec() as Promise<StaffDocument | null>;
    }

    async linkUserAccount(
        restaurantId: Types.ObjectId,
        staffId: Types.ObjectId,
        userId: Types.ObjectId,
    ): Promise<StaffDocument | null> {
        return this.staffModel
            .findOneAndUpdate(
                {
                    _id: staffId,
                    restaurant_id: restaurantId,
                    deleted_at: null,
                },
                {
                    $set: {
                        user_id: userId,
                    },
                },
                { new: true },
            )
            .select("-__v")
            .lean()
            .exec() as Promise<StaffDocument | null>;
    }

    async softDeleteInRestaurant(
        restaurantId: Types.ObjectId,
        staffId: Types.ObjectId,
    ): Promise<StaffDocument | null> {
        return this.staffModel
            .findOneAndUpdate(
                {
                    _id: staffId,
                    restaurant_id: restaurantId,
                    deleted_at: null,
                },
                {
                    $set: {
                        deleted_at: new Date(),
                        status: StaffStatus.TERMINATED,
                    },
                },
                { new: true },
            )
            .select("-__v")
            .lean()
            .exec() as Promise<StaffDocument | null>;
    }

}
