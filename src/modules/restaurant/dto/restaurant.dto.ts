import { IntersectionType, OmitType, PartialType, PickType } from "@nestjs/mapped-types";
import { Transform, Type } from "class-transformer";
import { ArrayUnique, IsBoolean, IsEmail, IsEnum, IsIn, IsInt, IsLatitude, IsLongitude, IsMongoId, IsNotEmpty, IsNotEmptyObject, IsNumber, IsObject, IsOptional, IsPhoneNumber, IsString, IsTimeZone, IsUrl, Length, Matches, Max, Min, ValidateIf, ValidateNested } from "class-validator";
import { IsTimeBefore } from "src/common/pipes/operating-hours.pipe";
import { SLUG_REGEX } from "src/common/utils/slug.util";


export class CreateRestaurantDto {
    
    @IsString()
    @Length(3, 100, { message: 'Tên nhà hàng phải từ 3-100 ký tự' })
    name: string;

    @IsOptional()
    @IsString()
    @Matches(SLUG_REGEX, { message: 'Slug không hợp lệ. Chỉ chứa chữ thường, số và dấu gạch ngang' })
    slug?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsString()
    logo_url?: string;
    @IsOptional()
    @IsString()
    cover_image_url?: string;

    @IsOptional()
    @IsString({ each: true })
    gallery_urls?: string[];
    @IsOptional()
    @IsString()
    website?: string;

    @IsOptional()
    @IsString()
    cuisine_type?: string;

    @IsOptional()
    @Min(1, { message: 'Price range phải từ 1 đến 4' })
    @Min(4, { message: 'Price range phải từ 1 đến 4' })
    price_range?: number;

    @IsString()
    address: string;
    @IsString()
    city: string;
    @IsOptional()
    @IsString()
    district?: string;
    @IsOptional()
    @IsString()
    ward?: string;

    @IsOptional()
    @ValidateIf(o => o.latitude !== undefined || o.longitude !== undefined)
    @IsLatitude({ message: 'Latitude phải là số hợp lệ từ -90 đến 90' })
    latitude?: number;
    @IsOptional()
    @ValidateIf(o => o.latitude !== undefined || o.longitude !== undefined)
    @IsLongitude({ message: 'Longitude phải là số hợp lệ từ -180 đến 180' })
    longitude?: number;

    @IsOptional()
    @IsPhoneNumber('VN', { message: 'Số điện thoại không hợp lệ' })
    phone?: string;
    @IsOptional()
    @IsEmail({}, { message: 'Email không hợp lệ' })
    email?: string;

    @IsOptional()
    @IsTimeZone({ message: 'Timezone không hợp lệ' })
    timezone: string = 'Asia/Ho_Chi_Minh';

    @IsNotEmpty({ message: 'Giờ mở cửa không được để trống' })
    @ValidateNested()
    @Type(() => OperatingHours)
    operating_hours: OperatingHours;
}

export class OperatingHours {
    @IsTimeBefore({ message: 'Thứ Hai - Giờ mở cửa phải trước giờ đóng cửa' })
    @ValidateNested()
    @Type(() => DayHours)
    @IsNotEmpty()
    mon: DayHours;

    @IsTimeBefore({ message: 'Thứ Ba - Giờ mở cửa phải trước giờ đóng cửa' })
    @ValidateNested()
    @Type(() => DayHours)
    @IsNotEmpty()
    tue: DayHours;

    @IsTimeBefore({ message: 'Thứ Tư - Giờ mở cửa phải trước giờ đóng cửa' })   
    @ValidateNested()
    @Type(() => DayHours)
    @IsNotEmpty()
    wed: DayHours;

    @IsTimeBefore({ message: 'Thứ Năm - Giờ mở cửa phải trước giờ đóng cửa' })
    @ValidateNested()
    @Type(() => DayHours)
    @IsNotEmpty()
    thu: DayHours;

    @IsTimeBefore({ message: 'Thứ Sáu - Giờ mở cửa phải trước giờ đóng cửa' })
    @ValidateNested()
    @Type(() => DayHours)
    @IsNotEmpty()
    fri: DayHours;

    @IsTimeBefore({ message: 'Thứ Bảy - Giờ mở cửa phải trước giờ đóng cửa' })
    @ValidateNested()
    @Type(() => DayHours)
    @IsNotEmpty()
    sat: DayHours;
    
    @IsTimeBefore({ message: 'Chủ Nhật - Giờ mở cửa phải trước giờ đóng cửa' })
    @ValidateNested()
    @Type(() => DayHours)
    @IsNotEmpty()
    sun: DayHours;
}

export class DayHours {
    @IsBoolean()
    closed: boolean;

    @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'Giờ mở cửa phải có định dạng HH:mm' })
    @IsNotEmpty({ message: 'Giờ mở cửa không được để trống' })
    open: string;
    @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'Giờ đóng cửa phải có định dạng HH:mm' })
    @IsNotEmpty({ message: 'Giờ đóng cửa không được để trống' })
    close: string;
}


export class UpdateRestaurantDto extends PartialType(
    OmitType(CreateRestaurantDto, ['slug', 'operating_hours'] as const)
) {}

export class UpdateOperatingHoursDto extends PickType(CreateRestaurantDto, ['operating_hours'] as const) {}
    

export class UpdateRestaurantfinancialDto {
    @IsOptional()
    @Min(0, { message: 'Tax rate phải từ 0 trở lên' })
    @Min(1, { message: 'Tax rate phải nhỏ hơn 1' })
    tax_rate?: number;

    @IsOptional()
    @IsEnum(["VND", "USD", "EUR"], { message: 'Currency phải là VND, USD hoặc EUR' })
    currency?: string;

    @IsOptional()
    @Min(0, { message: 'Service charge rate phải từ 0 trở lên' })
    @Min(1, { message: 'Service charge rate phải nhỏ hơn 1' })
    service_charge_rate?: number;
}


export class PaginateDto {
    @IsInt()
    @Type(() => Number)
    @Min(1, { message: 'Page phải từ 1 trở lên' })
    page: number = 1;
    @IsInt()
    @Type(() => Number)
    @Min(1, { message: 'Limit phải từ 1 trở lên' })
    @Max(30, { message: 'Limit phải nhỏ hơn hoặc bằng 30' })
    limit: number = 10;
    @IsOptional()
    @IsEnum(['name', 'distance', 'price_range'], { message: 'Sort phải là name, distance hoặc price_range' })
    sort: 'name' | 'distance' | 'price_range' = 'name';
}

export class SearchRestaurantDto {
  @IsString()
  @IsNotEmpty({ message: 'city là bắt buộc' })
  city: string;
 
  @IsOptional()
  @IsString()
  cuisine_type?: string;
 
  @IsOptional()
  @Transform(({ value }) =>
    String(value)
      .split(',')
      .map(v => parseInt(v.trim(), 10)),
  )
  @IsNumber({}, { each: true })
  @IsIn([1, 2, 3, 4], { each: true })
  @ArrayUnique()
  price_range?: number[];
 
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  accepts_online?: boolean;
 
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;
 
  @ValidateIf(o => o.lat !== undefined)
  @Type(() => Number)
  @IsNumber({}, { message: 'lng là bắt buộc khi có lat' })
  @Min(-180)
  @Max(180)
  lng?: number;
 
  @ValidateIf(o => o.lng !== undefined)
  @Type(() => Number)
  @IsNumber({}, { message: 'lat là bắt buộc khi có lng' })
  lat2?: number; 
 
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  radius_km?: number = 10;
 
  @IsOptional()
  @IsString()
  q?: string;
 
  @IsOptional()
  @IsIn(['distance', 'name'])
  sort?: 'distance' | 'name' = 'name';
 
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;
 
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}

export class OwnerRestaurantListQueryDto {
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1, { message: 'Page phải từ 1 trở lên' })
    page: number = 1;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1, { message: 'Limit phải từ 1 trở lên' })
    @Max(50, { message: 'Limit phải nhỏ hơn hoặc bằng 50' })
    limit: number = 10;

    @IsOptional()
    @IsIn(['published'], { message: 'Status chỉ hỗ trợ giá trị published' })
    status?: 'published';

    @IsOptional()
    @IsMongoId({ message: 'owner_id phải là ObjectId hợp lệ' })
    owner_id?: string;
}

export class UpdatePublishStatusDto {
    @IsBoolean({ message: 'is_published phải là boolean' })
    is_published: boolean;
}

export class UpdateOnlineOrdersDto {
    @IsBoolean({ message: 'accepts_online_orders phải là boolean' })
    accepts_online_orders: boolean;
}

export class UpdateRestaurantSettingsDto {
    @IsObject({ message: 'settings phải là object' })
    @IsNotEmptyObject({}, { message: 'settings không được rỗng' })
    settings: Record<string, unknown>;
}

export class UpdateRestaurantLogoDto {
    @IsString()
    @IsUrl(
        { require_protocol: true, protocols: ['https'] },
        { message: 'logo_url phải là HTTPS URL hợp lệ' },
    )
    logo_url: string;
}

export class UpdateRestaurantCoverDto {
    @IsString()
    @IsUrl(
        { require_protocol: true, protocols: ['https'] },
        { message: 'cover_image_url phải là HTTPS URL hợp lệ' },
    )
    cover_image_url: string;
}

export class AddRestaurantGalleryImageDto {
    @IsString()
    @IsUrl(
        { require_protocol: true, protocols: ['https'] },
        { message: 'image_url phải là HTTPS URL hợp lệ' },
    )
    image_url: string;
}
 