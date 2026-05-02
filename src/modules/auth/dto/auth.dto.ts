import { ApiHideProperty, ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
    IsBoolean,
    IsEmail,
    IsMongoId,
    IsObject,
    IsOptional,
    IsPhoneNumber,
    IsString,
    Length,
    Matches,
} from "class-validator";
import { Types } from "mongoose";
import { IsEmailOrPhone } from "src/common/pipes/identifier.pipe";
import { OTP_LENGTH } from "src/common/utils/otp.util";

const toTrimmedString = ({ value }: { value: unknown }): unknown =>
    typeof value === "string" ? value.trim() : value;

const toNormalizedEmail = ({ value }: { value: unknown }): unknown =>
    typeof value === "string" ? value.trim().toLowerCase() : value;

const toDigitsOnly = ({ value }: { value: unknown }): unknown =>
    typeof value === "string" ? value.replace(/\s+/g, "") : value;

const toNormalizedIdentifier = ({ value }: { value: unknown }): unknown => {
    if (typeof value !== "string") {
        return value;
    }

    const normalized = value.trim();
    return normalized.includes("@") ? normalized.toLowerCase() : normalized;
};

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


export class CheckEmailDTO {
    @ApiProperty({
        example: "alice@example.com",
        description: "Email can kiem tra ton tai trong he thong",
        type: String,
    })
    @Transform(toNormalizedEmail)
    @IsEmail()
    email: string;
}

export class RegisterDTO {
    @ApiProperty({
        example: "alice@example.com",
        description: "Email dang ky tai khoan",
        type: String,
    })
    @Transform(toNormalizedEmail)
    @IsEmail()
    email: string;

    @ApiProperty({
        example: "Secret@123",
        description: "Mat khau dang ky",
        type: String,
        minLength: 6,
        maxLength: 32,
    })
    @IsString()
    @Length(6, 32)
    password: string;

    @ApiProperty({
        example: "Nguyen Thi Alice",
        description: "Ho ten day du cua nguoi dung",
        type: String,
        minLength: 5,
        maxLength: 100,
    })
    @Transform(toTrimmedString)
    @IsString()
    @Length(5, 100)
    full_name: string;

    @ApiPropertyOptional({
        example: "+84901234567",
        description: "So dien thoai Viet Nam, optional",
        type: String,
    })
    @Transform(toTrimmedString)
    @IsOptional()
    @IsPhoneNumber('VN')
    phone?: string;
}

export class VerifyOTPDTO {
    @ApiProperty({
        example: "alice@example.com",
        description: "Email da dang ky can xac minh OTP",
        type: String,
    })
    @Transform(toNormalizedEmail)
    @IsEmail()
    email: string;

    @ApiProperty({
        example: "482931",
        description: `Ma OTP ${OTP_LENGTH} chu so duoc gui qua email`,
        type: String,
        minLength: OTP_LENGTH,
        maxLength: OTP_LENGTH,
    })
    @Transform(toDigitsOnly)
    @IsString()
    @Length(OTP_LENGTH, OTP_LENGTH)
    @Matches(/^\d+$/, { message: "otp must contain digits only" })
    otp: string;
}

export class ResendOTPDTO extends CheckEmailDTO {}
export class ForgotPasswordDTO extends CheckEmailDTO {}

export class VerifyForgotPasswordOTPDTO {
    @ApiProperty({
        example: "eyJzZXNzaW9uIjoidHJ1ZSJ9...",
        description: "Session token nhan duoc tu buoc forgot-password",
        type: String,
    })
    @Transform(toTrimmedString)
    @IsString()
    session_token: string;

    @ApiProperty({
        example: "192837",
        description: `Ma OTP ${OTP_LENGTH} chu so cho reset password`,
        type: String,
        minLength: OTP_LENGTH,
        maxLength: OTP_LENGTH,
    })
    @Transform(toDigitsOnly)
    @IsString()
    @Length(OTP_LENGTH, OTP_LENGTH)
    @Matches(/^\d+$/, { message: "otp must contain digits only" })
    otp: string;
}

export class ResetPasswordDTO {
    @ApiProperty({
        example: "eyJncmFudCI6InRydWUifQ...",
        description: "Grant token nhan duoc sau khi verify OTP reset password",
        type: String,
    })
    @Transform(toTrimmedString)
    @IsString()
    grant_token: string;

    @ApiProperty({
        example: "NewPass@456",
        description: "Mat khau moi",
        type: String,
        minLength: 6,
        maxLength: 32,
    })
    @IsString()
    @Length(6, 32)
    new_password: string;
}

export class ChangePasswordDTO {
    @ApiProperty({
        example: "Secret@123",
        description: "Mat khau hien tai",
        type: String,
        minLength: 6,
        maxLength: 32,
    })
    @IsString()
    @Length(6, 32)
    current_password: string;

    @ApiProperty({
        example: "NewPass@456",
        description: "Mat khau moi",
        type: String,
        minLength: 6,
        maxLength: 32,
    })
    @IsString()
    @Length(6, 32)
    new_password: string;
}

export class LoginDTO {
    @ApiProperty({
        example: "alice@example.com",
        description: "Email hoac so dien thoai Viet Nam (+84...)",
        type: String,
    })
    @Transform(toNormalizedIdentifier)
    @IsEmailOrPhone({ message: 'Invalid identifier format' })
    identifier: string; // email or phone

    @ApiHideProperty()
    @IsOptional()
    identifier_type?: 'email' | 'phone';

    @ApiProperty({
        example: "Secret@123",
        description: "Mat khau dang nhap",
        type: String,
        minLength: 6,
        maxLength: 32,
    })
    @IsString()
    @Length(6, 32)
    password: string;

    @ApiProperty({
        example: false,
        description: "true de nho dang nhap lau hon, false de dung thoi gian mac dinh",
        type: Boolean,
    })
    @Transform(toBooleanValue)
    @IsBoolean()
    remember_me: boolean;

    @ApiHideProperty()
    @IsOptional()
    @IsObject()
    device_info?: DeviceInfo | null;

    @ApiHideProperty()
    @IsOptional()
    user_ip?: string;
}

export interface DeviceInfo {
    browser: string | null;
    os: string | null;
    device: string | null;
    user_agent: string | null;
}

export class Send2FAOtpDTO {
    @ApiProperty({
        example: "eyJ0bXAiOiJ0cnVlIn0...",
        description: "Temp token nhan duoc tu login khi tai khoan bat 2FA",
        type: String,
    })
    @Transform(toTrimmedString)
    @IsString()
    temp_token: string;
}

export class Verify2FAOTPDTO extends Send2FAOtpDTO {
    @ApiProperty({
        example: "739104",
        description: `Ma OTP ${OTP_LENGTH} chu so cho 2FA`,
        type: String,
        minLength: OTP_LENGTH,
        maxLength: OTP_LENGTH,
    })
    @Transform(toDigitsOnly)
    @IsString()
    @Length(OTP_LENGTH, OTP_LENGTH)
    @Matches(/^\d+$/, { message: "otp must contain digits only" })
    otp: string;
}

export class Enable2FADTO {
    @ApiProperty({
        example: "Secret@123",
        description: "Mat khau hien tai de xac nhan danh tinh",
        type: String,
        minLength: 6,
        maxLength: 32,
    })
    @IsString()
    @Length(6, 32)
    password: string;
}

export class Disable2FADTO extends Enable2FADTO {}

export class RevokeSessionDTO {
    @ApiProperty({
        example: "664f1a2b3c4d5e6f7a8b9c0e",
        description: "ObjectId cua session can thu hoi",
        type: String,
    })
    @Transform(({ value }: { value: unknown }) => {
        if (value instanceof Types.ObjectId) {
            return value.toHexString();
        }
        return typeof value === "string" ? value.trim() : value;
    })
    @IsMongoId()
    session_id: string;
}

export class SendPhoneOTPDTO {
    @ApiProperty({
        example: "+84901234567",
        description: "So dien thoai Viet Nam can xac minh va lien ket",
        type: String,
    })
    @Transform(toTrimmedString)
    @IsPhoneNumber('VN')
    phone: string;
}

export class VerifyPhoneOTPDTO {
    @ApiProperty({
        example: "482931",
        description: `Ma OTP ${OTP_LENGTH} chu so xac minh so dien thoai`,
        type: String,
        minLength: OTP_LENGTH,
        maxLength: OTP_LENGTH,
    })
    @Transform(toDigitsOnly)
    @IsString()
    @Length(OTP_LENGTH, OTP_LENGTH)
    @Matches(/^\d+$/, { message: "otp must contain digits only" })
    otp: string;
}
