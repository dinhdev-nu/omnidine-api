import { Injectable, PipeTransform } from "@nestjs/common";
import { BadRequestException } from "../exceptions";
import { ERROR_CODE } from "../constants/error-code.constant";

@Injectable()
export class FileSizeValidationPipe implements PipeTransform {
    
    constructor( private readonly maxSizeInMB: number = 5) {} // Default max size is 5MB

    transform(value: any) {
        if (!value) return value; // No file provided, skip validation

        const maxSize = this.maxSizeInMB * 1024 * 1024; // Convert MB to bytes

        const fileArr = Array.isArray(value) ? value : [value]; 

        for (const file of fileArr) {
            if (file.size && file.size > maxSize) {
                throw new BadRequestException(
                    ERROR_CODE.UPLOAD_FILE_TOO_LARGE,
                    `File size should not exceed ${this.maxSizeInMB} MB`,
                )
            }
        }

        return value; 
    }
}