import { ValidationArguments, ValidationOptions, ValidatorConstraint, ValidatorConstraintInterface, registerDecorator } from "class-validator";

type DayHours = {
    open: string; // "HH:mm" format
    close: string; // "HH:mm" format
    closed: boolean;
}

@ValidatorConstraint({ name: 'isTimeBefore', async: false })
export class IsTimeBeforeConstraint implements ValidatorConstraintInterface {
    validate(value: any, args?: ValidationArguments): boolean {
        const dayHours = value as DayHours;

        if (!dayHours || typeof dayHours !== 'object') return false;
        if (dayHours.closed) return true; // Nếu ngày đó đóng cửa thì không cần so sánh giờ
        if (!dayHours.open || !dayHours.close) return false;

        const [openHour, openMinute] = dayHours.open.split(':').map(Number);
        const [closeHour, closeMinute] = dayHours.close.split(':').map(Number);

        if (
            Number.isNaN(openHour) || Number.isNaN(openMinute) ||
            Number.isNaN(closeHour) || Number.isNaN(closeMinute)
        ) {
            return false;
        }
        
        const openTime = openHour * 60 + openMinute;
        const closeTime = closeHour * 60 + closeMinute;
        return openTime < closeTime; // Giờ mở cửa phải trước giờ đóng cửa
    }

    defaultMessage(args: ValidationArguments) {
        return 'Giờ mở cửa phải trước giờ đóng cửa';
    }
}

export function IsTimeBefore(validationOptions?: ValidationOptions) {
    return function (object: Object, propertyName: string) {
        registerDecorator({
            target: object.constructor,
            propertyName: propertyName,
            options: validationOptions,
            constraints: [],
            validator: IsTimeBeforeConstraint,
        });
    }
}
