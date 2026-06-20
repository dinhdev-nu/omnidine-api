import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { ClientSession, FilterQuery, Model, Types } from "mongoose";
import { BaseRepository, IBaseRepository } from "src/common/repositories/base.repository";
import { Table, TableDocument, TableStatus } from "../schemas/table.schema";

const ACTIVE_ORDER_STATUSES = [
    "pending",
    "confirmed",
    "preparing",
    "ready",
    "delivering",
    "progress",
];

const CLOSED_ORDER_STATUSES = [
    "completed",
    "cancelled",
    "refunded",
];

const UNPAID_PAYMENT_STATUSES = [
    "unpaid",
    "partial",
];

export interface ITableQueryFilters {
    status?: TableStatus;
    is_active?: boolean;
    capacity_min?: number;
    capacity_max?: number;
}

export interface IUpdateTablePayload {
    table_number?: string;
    name?: string | null;
    capacity?: number;
    notes?: string | null;
}

export interface ITableRepository extends IBaseRepository<TableDocument> {
    countByRestaurant(restaurantId: Types.ObjectId): Promise<number>;
    listByRestaurant(
        restaurantId: Types.ObjectId,
        filters?: ITableQueryFilters,
    ): Promise<TableDocument[]>;
    findByIdInRestaurant(
        restaurantId: Types.ObjectId,
        tableId: Types.ObjectId,
    ): Promise<TableDocument | null>;
    findByQrCode(qrCode: string): Promise<TableDocument | null>;
    findByTableNumber(
        restaurantId: Types.ObjectId,
        tableNumber: string,
        excludeTableId?: Types.ObjectId,
    ): Promise<TableDocument | null>;
    createOne(data: Partial<Table>): Promise<TableDocument>;
    updateInRestaurant(
        restaurantId: Types.ObjectId,
        tableId: Types.ObjectId,
        data: IUpdateTablePayload,
    ): Promise<TableDocument | null>;
    updateStatus(
        restaurantId: Types.ObjectId,
        tableId: Types.ObjectId,
        status: TableStatus,
        options?: { session?: ClientSession },
    ): Promise<TableDocument | null>;
    occupyIfAvailable(
        restaurantId: Types.ObjectId,
        tableId: Types.ObjectId,
        options?: { session?: ClientSession },
    ): Promise<TableDocument | null>;
    toggleActive(
        restaurantId: Types.ObjectId,
        tableId: Types.ObjectId,
        isActive: boolean,
    ): Promise<TableDocument | null>;
    updateQrCode(
        restaurantId: Types.ObjectId,
        tableId: Types.ObjectId,
        qrCode: string,
    ): Promise<TableDocument | null>;
    deleteInRestaurant(
        restaurantId: Types.ObjectId,
        tableId: Types.ObjectId,
        options?: { session?: ClientSession },
    ): Promise<boolean>;
}

@Injectable()
export class TableRepository
    extends BaseRepository<TableDocument>
    implements ITableRepository
{
    constructor(
        @InjectModel(Table.name)
        private readonly tableModel: Model<TableDocument>,
    ) {
        super(tableModel);
    }

    async countByRestaurant(restaurantId: Types.ObjectId): Promise<number> {
        return this.tableModel.countDocuments({ restaurant_id: restaurantId }).exec();
    }

    async listByRestaurant(
        restaurantId: Types.ObjectId,
        filters: ITableQueryFilters = {},
    ): Promise<TableDocument[]> {
        const query: FilterQuery<TableDocument> = {
            restaurant_id: restaurantId,
        };

        if (filters.status !== undefined) query.status = filters.status;
        if (filters.is_active !== undefined) query.is_active = filters.is_active;

        if (
            filters.capacity_min !== undefined ||
            filters.capacity_max !== undefined
        ) {
            query.capacity = {} as any;
            if (filters.capacity_min !== undefined) {
                (query.capacity as any).$gte = filters.capacity_min;
            }
            if (filters.capacity_max !== undefined) {
                (query.capacity as any).$lte = filters.capacity_max;
            }
        }

        return this.tableModel
            .find(query)
            .sort({ table_number: 1, created_at: 1 })
            .lean()
            .exec() as Promise<TableDocument[]>;
    }

    async findByIdInRestaurant(
        restaurantId: Types.ObjectId,
        tableId: Types.ObjectId,
    ): Promise<TableDocument | null> {
        return this.tableModel
            .findOne({
                _id: tableId,
                restaurant_id: restaurantId,
            })
            .lean()
            .exec() as Promise<TableDocument | null>;
    }

    async findByQrCode(qrCode: string): Promise<TableDocument | null> {
        return this.tableModel
            .findOne({ qr_code: qrCode })
            .lean()
            .exec() as Promise<TableDocument | null>;
    }

    async findByTableNumber(
        restaurantId: Types.ObjectId,
        tableNumber: string,
        excludeTableId?: Types.ObjectId,
    ): Promise<TableDocument | null> {
        const query: FilterQuery<TableDocument> = {
            restaurant_id: restaurantId,
            table_number: tableNumber,
        };

        if (excludeTableId) {
            query._id = { $ne: excludeTableId };
        }

        return this.tableModel
            .findOne(query)
            .lean()
            .exec() as Promise<TableDocument | null>;
    }

    async createOne(data: Partial<Table>): Promise<TableDocument> {
        return this.tableModel.create(data) as Promise<TableDocument>;
    }

    async updateInRestaurant(
        restaurantId: Types.ObjectId,
        tableId: Types.ObjectId,
        data: IUpdateTablePayload,
    ): Promise<TableDocument | null> {
        return this.tableModel
            .findOneAndUpdate(
                {
                    _id: tableId,
                    restaurant_id: restaurantId,
                },
                {
                    $set: data,
                },
                { new: true },
            )
            .lean()
            .exec() as Promise<TableDocument | null>;
    }

    async updateStatus(
        restaurantId: Types.ObjectId,
        tableId: Types.ObjectId,
        status: TableStatus,
        options?: { session?: ClientSession },
    ): Promise<TableDocument | null> {
        return this.tableModel
            .findOneAndUpdate(
                {
                    _id: tableId,
                    restaurant_id: restaurantId,
                },
                {
                    $set: { status },
                },
                { new: true, session: options?.session ?? null },
            )
            .lean()
            .exec() as Promise<TableDocument | null>;
    }

    async occupyIfAvailable(
        restaurantId: Types.ObjectId,
        tableId: Types.ObjectId,
        options?: { session?: ClientSession },
    ): Promise<TableDocument | null> {
        return this.tableModel
            .findOneAndUpdate(
                {
                    _id: tableId,
                    restaurant_id: restaurantId,
                    is_active: true,
                    status: { $eq: TableStatus.AVAILABLE },
                },
                {
                    $set: { status: TableStatus.OCCUPIED },
                },
                { new: true, session: options?.session ?? null },
            )
            .lean()
            .exec() as Promise<TableDocument | null>;
    }

    async toggleActive(
        restaurantId: Types.ObjectId,
        tableId: Types.ObjectId,
        isActive: boolean,
    ): Promise<TableDocument | null> {
        return this.tableModel
            .findOneAndUpdate(
                {
                    _id: tableId,
                    restaurant_id: restaurantId,
                },
                {
                    $set: { is_active: isActive },
                },
                { new: true },
            )
            .lean()
            .exec() as Promise<TableDocument | null>;
    }

    async updateQrCode(
        restaurantId: Types.ObjectId,
        tableId: Types.ObjectId,
        qrCode: string,
    ): Promise<TableDocument | null> {
        return this.tableModel
            .findOneAndUpdate(
                {
                    _id: tableId,
                    restaurant_id: restaurantId,
                },
                {
                    $set: { qr_code: qrCode },
                },
                { new: true },
            )
            .lean()
            .exec() as Promise<TableDocument | null>;
    }

    async deleteInRestaurant(
        restaurantId: Types.ObjectId,
        tableId: Types.ObjectId,
        options?: { session?: ClientSession },
    ): Promise<boolean> {
        const result = await this.tableModel.deleteOne({
            _id: tableId,
            restaurant_id: restaurantId,
        }, options).exec();

        return result.deletedCount > 0;
    }
}
