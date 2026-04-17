import { Transform, Type } from 'class-transformer';
import { Types } from 'mongoose';
import {
    IsEnum,
    IsIn,
    IsMongoId,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    IsUUID,
    MaxLength,
    Min,
} from 'class-validator';
import {
    PaymentMethod,
    REFERENCE_NUMBER_REQUIRED_METHODS,
} from '../schemas/payment.schema';

const transformObjectIdToString = ({ value }: { value: unknown }) =>
    value instanceof Types.ObjectId ? value.toString() : value;

const transformNullableString = ({ value }: { value: unknown }) => {
    if (value === undefined || value === null) {
        return undefined;
    }

    if (typeof value !== 'string') {
        return value;
    }

    const trimmed = value.trim();
    return trimmed.length ? trimmed : undefined;
};

class BaseCreatePaymentDto {
    @Transform(transformObjectIdToString)
    @IsMongoId({ message: 'restaurantId must be a valid ObjectId' })
    restaurantId: string | Types.ObjectId;

    @Transform(transformObjectIdToString)
    @IsMongoId({ message: 'orderId must be a valid ObjectId' })
    orderId: string | Types.ObjectId;

    @IsString()
    @IsNotEmpty()
    @IsUUID('4', { message: 'idempotencyKey must be a valid UUID v4' })
    idempotencyKey: string;

    @IsOptional()
    @IsString()
    @Transform(transformNullableString)
    @MaxLength(1000, { message: 'notes must be at most 1000 characters' })
    notes?: string;

    @IsOptional()
    @Transform(transformObjectIdToString)
    @IsMongoId({ message: 'processedBy must be a valid ObjectId' })
    processedBy?: string | Types.ObjectId;
}

export class CreatePaymentByCashDto extends BaseCreatePaymentDto {
    @IsEnum(PaymentMethod)
    @IsIn([PaymentMethod.CASH], { message: 'cash endpoint only accepts method=cash' })
    method: PaymentMethod;

    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 }, { message: 'paidAmount must be a number' })
    @Min(0.01, { message: 'paidAmount must be greater than 0' })
    paidAmount: number;

    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 }, { message: 'cashTendered must be a number' })
    @Min(0.01, { message: 'cashTendered must be greater than 0' })
    cashTendered: number;

}

export class CreatePaymentDto extends BaseCreatePaymentDto {
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 }, { message: 'amount must be a number' })
    @Min(0.01, { message: 'amount must be greater than 0' })
    amount: number;

    @IsEnum(PaymentMethod, { message: 'method is invalid' })
    method: PaymentMethod;

    @IsOptional()
    @IsString()
    @Transform(transformNullableString)
    @MaxLength(100, { message: 'referenceNumber must be at most 100 characters' })
    referenceNumber?: string;

    @IsOptional()
    @IsString()
    @Transform(transformNullableString)
    @MaxLength(500, { message: 'returnUrl must be at most 500 characters' })
    returnUrl?: string;
}

export class RefundPaymentDto {
    @Transform(transformObjectIdToString)
    @IsMongoId({ message: 'restaurantId must be a valid ObjectId' })
    restaurantId: string | Types.ObjectId;

    @Transform(transformObjectIdToString)
    @IsMongoId({ message: 'orderId must be a valid ObjectId' })
    orderId: string | Types.ObjectId;

    @Transform(transformObjectIdToString)
    @IsMongoId({ message: 'paymentId must be a valid ObjectId' })
    paymentId: string | Types.ObjectId;

    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 }, { message: 'refundAmount must be a number' })
    @Min(0.01, { message: 'refundAmount must be greater than 0' })
    refundAmount: number;

    @IsString()
    @Transform(transformNullableString)
    @IsNotEmpty({ message: 'refundReason is required' })
    @MaxLength(500, { message: 'refundReason must be at most 500 characters' })
    refundReason: string;
}


export const PAYMENT_METHODS_REQUIRE_REFERENCE = REFERENCE_NUMBER_REQUIRED_METHODS;
