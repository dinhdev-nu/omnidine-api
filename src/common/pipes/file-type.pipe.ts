import { Injectable, PipeTransform } from "@nestjs/common";
import { ERROR_CODE } from "../constants/error-code.constant";
import { BadRequestException } from "../exceptions";


@Injectable()
export class FileTypeValidationPipe implements PipeTransform {
    constructor(private readonly allowedTypes: string[] = []) {}

    transform(value: any) {
        if (!value) return value; // No file provided, skip validation

        const fileArr = Array.isArray(value) ? value : [value];
        
        for (const file of fileArr) {
            if (file.mimetype && !this.allowedTypes.includes(file.mimetype)) {
                throw new BadRequestException(
                    ERROR_CODE.UPLOAD_FILE_TYPE_NOT_ALLOWED,
                    `File type ${file.mimetype} is not allowed. Allowed types: ${this.allowedTypes.join(", ")}`,
                );
            }
        }
        return value;
    }
}