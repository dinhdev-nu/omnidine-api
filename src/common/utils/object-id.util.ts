import { Types } from 'mongoose';
import { ERROR_CODE } from 'src/common/constants/error-code.constant';
import { BadRequestException } from 'src/common/exceptions';

export const ObjectIdUtil = {
  toObjectId(input: Types.ObjectId | string, fieldName: string): Types.ObjectId {
    if (input instanceof Types.ObjectId) {
      return input;
    }

    if (!Types.ObjectId.isValid(input)) {
      throw new BadRequestException(
        ERROR_CODE.INVALID_ID_ERROR,
        `${fieldName} is invalid`,
        { [fieldName]: input },
      );
    }

    return new Types.ObjectId(input);
  },

  tryToObjectId(input: unknown): Types.ObjectId | null {
    if (input instanceof Types.ObjectId) {
      return input;
    }

    if (typeof input !== 'string' || !Types.ObjectId.isValid(input)) {
      return null;
    }

    return new Types.ObjectId(input);
  },

  isSameObjectId(
    left: Types.ObjectId | string,
    right: Types.ObjectId | string,
  ): boolean {
    return String(left) === String(right);
  },
} as const;
