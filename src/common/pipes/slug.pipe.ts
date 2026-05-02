import { Injectable, PipeTransform } from "@nestjs/common";
import { callbackPromise } from "nodemailer/lib/shared";
import { SlugUtil } from "../utils/slug.util";
import { BadRequestException } from "../exceptions";
import { ERROR_CODE } from "../constants/error-code.constant";


@Injectable()
export class SlugValidationPipe implements PipeTransform {
    async transform(value: string) {
        const isValidSlug = SlugUtil.isValidSlug(value);
        if (!isValidSlug) {
            throw new BadRequestException(ERROR_CODE.INVALID_SLUG_FORMAT, 'Invalid slug format. Slug must be lowercase, alphanumeric, and can include hyphens (but not at the start or end).');
        }
        return value;
    }
}