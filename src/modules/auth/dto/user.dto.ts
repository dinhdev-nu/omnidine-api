import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
    IsBoolean,
    IsEnum,
    IsISO8601,
    IsObject,
    IsOptional,
    IsString,
    Length,
    ValidateNested,
} from "class-validator";

const toTrimmedString = ({ value }: { value: unknown }): unknown =>
    typeof value === "string" ? value.trim() : value;

const toLowerTrimmedString = ({ value }: { value: unknown }): unknown =>
    typeof value === "string" ? value.trim().toLowerCase() : value;

const toBooleanValue = ({ value }: { value: unknown }): unknown => {
    if (typeof value === "boolean") {
        return value;
    }

    if (typeof value === "string") {
        if (value.toLowerCase() === "true") {
            return true;
        }
        if (value.toLowerCase() === "false") {
            return false;
        }
    }

    return value;
};

const GENDERS = ["male", "female", "other"] as const;
const LANGUAGES = ["en", "vi"] as const;
const THEMES = ["light", "dark", "system"] as const;

export class UpdateUserNotificationPreferencesDTO {
    @ApiPropertyOptional({ example: true, description: 'Receive email notifications' })
    @IsOptional()
    @Transform(toBooleanValue)
    @IsBoolean()
    email?: boolean;

    @ApiPropertyOptional({ example: true, description: 'Receive SMS notifications' })
    @IsOptional()
    @Transform(toBooleanValue)
    @IsBoolean()
    phone?: boolean;

    @ApiPropertyOptional({ example: true, description: 'Receive SMS notifications (alias of phone)' })
    @IsOptional()
    @Transform(toBooleanValue)
    @IsBoolean()
    sms?: boolean;

    @ApiPropertyOptional({ example: false, description: 'Receive push notifications' })
    @IsOptional()
    @Transform(toBooleanValue)
    @IsBoolean()
    push?: boolean;
}

export class UpdateUserProfileDTO {
    @ApiPropertyOptional({ example: 'Nguyen Thi Alice', minLength: 6, maxLength: 32 })
    @IsOptional()
    @Transform(toTrimmedString)
    @IsString()
    @Length(2, 100)
    full_name?: string;

    @ApiPropertyOptional({ example: '1995-06-15', description: 'ISO 8601 date format (YYYY-MM-DD)' })
    @IsOptional()
    @Transform(toTrimmedString)
    @IsISO8601()
    date_of_birth?: string;

    @ApiPropertyOptional({ enum: ['male', 'female', 'other'], example: 'female' })
    @IsOptional()
    @Transform(toLowerTrimmedString)
    @IsEnum(GENDERS)
    gender?: 'male' | 'female' | 'other';
}

export class UpdateUserPreferencesDTO {
    @ApiPropertyOptional({ enum: ['en', 'vi'], example: 'vi', description: 'UI language' })
    @IsOptional()
    @Transform(toLowerTrimmedString)
    @IsEnum(LANGUAGES)
    language?: 'en' | 'vi';

    @ApiPropertyOptional({ enum: ['light', 'dark', 'system'], example: 'dark', description: 'UI theme' })
    @IsOptional()
    @Transform(toLowerTrimmedString)
    @IsEnum(THEMES)
    theme?: 'light' | 'dark' | 'system';

    @ApiPropertyOptional({ type: () => UpdateUserNotificationPreferencesDTO, description: 'Notification channel preferences' })
    @IsOptional()
    @IsObject()
    @ValidateNested()
    @Type(() => UpdateUserNotificationPreferencesDTO)
    notifications?: UpdateUserNotificationPreferencesDTO;
}
