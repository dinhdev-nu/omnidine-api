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
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
};

class BaseCreatePaymentDto {
  @IsEnum(PaymentMethod, { message: 'method is invalid' })
  method: PaymentMethod;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'amount must be a number' })
  @Min(0.01, { message: 'amount must be greater than 0' })
  amount: number;

  @IsString()
  @IsNotEmpty()
  @IsUUID('4', { message: 'idempotency_key must be a valid UUID v4' })
  idempotency_key: string;

  @IsOptional()
  @IsString()
  @Transform(transformNullableString)
  @MaxLength(1000, { message: 'notes must be at most 1000 characters' })
  notes?: string;
}

export class CreatePaymentByCashDto extends BaseCreatePaymentDto {
  @IsIn([PaymentMethod.CASH], { message: 'method must be "cash" for cash payment' })
  declare method: PaymentMethod;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'cash_tendered must be a number' })
  @Min(0.01, { message: 'cash_tendered must be greater than 0' })
  cash_tendered: number;
}

export class CreatePaymentDto extends BaseCreatePaymentDto {
  @IsOptional()
  @IsString()
  @Transform(transformNullableString)
  @MaxLength(500, { message: 'return_url must be at most 500 characters' })
  return_url?: string;
}

export class RefundPaymentDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'refund_amount must be a number' })
  @Min(0.01, { message: 'refund_amount must be greater than 0' })
  refund_amount: number;

  @IsString()
  @Transform(transformNullableString)
  @IsNotEmpty({ message: 'refund_reason is required' })
  @MaxLength(500, { message: 'refund_reason must be at most 500 characters' })
  refund_reason: string;
}

export const PAYMENT_METHODS_REQUIRE_REFERENCE = REFERENCE_NUMBER_REQUIRED_METHODS;