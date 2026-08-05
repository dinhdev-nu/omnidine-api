import { randomInt } from 'crypto';

export const OTP_LENGTH = 6;

export const OtpUtils = {
    generateOTP: (): string => {
        return randomInt(0, 10 ** OTP_LENGTH)
            .toString()
            .padStart(OTP_LENGTH, "0");
    },

    isValidOTP: (otp: string): boolean => {
        if (!otp || otp.length !== OTP_LENGTH) return false;

        return !isNaN(Number(otp));
    },

    isEqual: (otp1: string, otp2: string): boolean => {
        return otp1 === otp2;
    }


} as const;
