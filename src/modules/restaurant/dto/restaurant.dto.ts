import { ApiProperty, ApiPropertyOptional, OmitType, PartialType, PickType } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import { ArrayUnique, IsBoolean, IsEmail, IsEnum, IsIn, IsInt, IsLatitude, IsLongitude, IsMongoId, IsNotEmpty, IsNotEmptyObject, IsNumber, IsObject, IsOptional, IsPhoneNumber, IsString, IsTimeZone, IsUrl, Length, Matches, Max, Min, ValidateIf, ValidateNested } from "class-validator";
import { IsTimeBefore } from "src/common/pipes/operating-hours.pipe";
import { SLUG_REGEX } from "src/common/utils/slug.util";


export class DayHours {
    @ApiProperty({
        example: false,
        description: "true nếu ngày đó đóng cửa",
        type: Boolean,
    })
    @IsBoolean()
    closed: boolean;

    @ApiProperty({
        example: "08:00",
        description: "Giờ mở cửa theo định dạng HH:mm",
        pattern: "^([01]\\d|2[0-3]):([0-5]\\d)$",
        type: String,
    })
    @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'Giờ mở cửa phải có định dạng HH:mm' })
    @IsNotEmpty({ message: 'Giờ mở cửa không được để trống' })
    open: string;

    @ApiProperty({
        example: "22:00",
        description: "Giờ đóng cửa theo định dạng HH:mm",
        pattern: "^([01]\\d|2[0-3]):([0-5]\\d)$",
        type: String,
    })
    @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'Giờ đóng cửa phải có định dạng HH:mm' })
    @IsNotEmpty({ message: 'Giờ đóng cửa không được để trống' })
    close: string;
}

export class OperatingHours {
    @ApiProperty({ type: () => DayHours, description: "Thứ Hai" })
    @IsTimeBefore({ message: 'Thứ Hai - Giờ mở cửa phải trước giờ đóng cửa' })
    @ValidateNested()
    @Type(() => DayHours)
    @IsNotEmpty()
    mon: DayHours;

    @ApiProperty({ type: () => DayHours, description: "Thứ Ba" })
    @IsTimeBefore({ message: 'Thứ Ba - Giờ mở cửa phải trước giờ đóng cửa' })
    @ValidateNested()
    @Type(() => DayHours)
    @IsNotEmpty()
    tue: DayHours;

    @ApiProperty({ type: () => DayHours, description: "Thứ Tư" })
    @IsTimeBefore({ message: 'Thứ Tư - Giờ mở cửa phải trước giờ đóng cửa' })   
    @ValidateNested()
    @Type(() => DayHours)
    @IsNotEmpty()
    wed: DayHours;

    @ApiProperty({ type: () => DayHours, description: "Thứ Năm" })
    @IsTimeBefore({ message: 'Thứ Năm - Giờ mở cửa phải trước giờ đóng cửa' })
    @ValidateNested()
    @Type(() => DayHours)
    @IsNotEmpty()
    thu: DayHours;

    @ApiProperty({ type: () => DayHours, description: "Thứ Sáu" })
    @IsTimeBefore({ message: 'Thứ Sáu - Giờ mở cửa phải trước giờ đóng cửa' })
    @ValidateNested()
    @Type(() => DayHours)
    @IsNotEmpty()
    fri: DayHours;

    @ApiProperty({ type: () => DayHours, description: "Thứ Bảy" })
    @IsTimeBefore({ message: 'Thứ Bảy - Giờ mở cửa phải trước giờ đóng cửa' })
    @ValidateNested()
    @Type(() => DayHours)
    @IsNotEmpty()
    sat: DayHours;
    
    @ApiProperty({ type: () => DayHours, description: "Chủ Nhật" })
    @IsTimeBefore({ message: 'Chủ Nhật - Giờ mở cửa phải trước giờ đóng cửa' })
    @ValidateNested()
    @Type(() => DayHours)
    @IsNotEmpty()
    sun: DayHours;
}

export class CreateRestaurantDto {
    @ApiProperty({
        example: "Bep Nha Viet",
        description: "Tên nhà hàng hiển thị cho khách hàng",
        minLength: 3,
        maxLength: 100,
    })
    @IsString()
    @Length(3, 100, { message: 'Tên nhà hàng phải từ 3-100 ký tự' })
    name: string;

    @ApiPropertyOptional({
        example: "bep-nha-viet",
        description: "Slug thân thiện URL, chỉ gồm chữ thường, số và dấu gạch ngang",
        pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
    })
    @IsOptional()
    @IsString()
    @Matches(SLUG_REGEX, { message: 'Slug không hợp lệ. Chỉ chứa chữ thường, số và dấu gạch ngang' })
    slug?: string;

    @ApiPropertyOptional({
        example: "Nhà hàng chuyên món Việt truyền thống",
        description: "Mô tả ngắn về nhà hàng",
        type: String,
    })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiPropertyOptional({
        example: "https://res.cloudinary.com/demo/image/upload/v1/restaurants/logo.jpg",
        description: "URL logo nhà hàng",
        type: String,
    })
    @IsOptional()
    @IsString()
    logo_url?: string;

    @ApiPropertyOptional({
        example: "https://res.cloudinary.com/demo/image/upload/v1/restaurants/cover.jpg",
        description: "URL ảnh bìa nhà hàng",
        type: String,
    })
    @IsOptional()
    @IsString()
    cover_image_url?: string;

    @ApiPropertyOptional({
        example: [
            "https://res.cloudinary.com/demo/image/upload/v1/restaurants/gallery-1.jpg",
            "https://res.cloudinary.com/demo/image/upload/v1/restaurants/gallery-2.jpg",
        ],
        description: "Danh sách ảnh gallery ban đầu",
        type: [String],
    })
    @IsOptional()
    @IsString({ each: true })
    gallery_urls?: string[];

    @ApiPropertyOptional({
        example: "https://bepnhaviet.vn",
        description: "Website chính thức của nhà hàng",
        type: String,
    })
    @IsOptional()
    @IsString()
    website?: string;

    @ApiPropertyOptional({
        example: "Vietnamese",
        description: "Loại hình ẩm thực",
        type: String,
    })
    @IsOptional()
    @IsString()
    cuisine_type?: string;

    @ApiPropertyOptional({
        example: 2,
        description: "Mức giá trung bình: 1-4",
        minimum: 1,
        maximum: 4,
        type: Number,
    })
    @IsOptional()
    @Min(1, { message: 'Price range phải từ 1 đến 4' })
    @Max(4, { message: 'Price range phải từ 1 đến 4' })
    price_range?: number;

    @ApiProperty({
        example: "123 Nguyen Hue, Quan 1",
        description: "Địa chỉ chi tiết của nhà hàng",
        type: String,
    })
    @IsString()
    address: string;

    @ApiProperty({
        example: "Ho Chi Minh",
        description: "Thành phố của nhà hàng",
        type: String,
    })
    @IsString()
    city: string;

    @ApiPropertyOptional({
        example: "Quan 1",
        description: "Quận/Huyện",
        type: String,
    })
    @IsOptional()
    @IsString()
    district?: string;

    @ApiPropertyOptional({
        example: "Ben Nghe",
        description: "Phường/Xã",
        type: String,
    })
    @IsOptional()
    @IsString()
    ward?: string;

    @ApiPropertyOptional({
        example: 10.7769,
        description: "Vĩ độ từ -90 đến 90. Nếu có latitude thì phải có longitude",
        minimum: -90,
        maximum: 90,
        type: Number,
    })
    @IsOptional()
    @ValidateIf((obj: CreateRestaurantDto) => obj.latitude !== undefined || obj.longitude !== undefined)
    @IsLatitude({ message: 'Latitude phải là số hợp lệ từ -90 đến 90' })
    latitude?: number;

    @ApiPropertyOptional({
        example: 106.7009,
        description: "Kinh độ từ -180 đến 180. Nếu có longitude thì phải có latitude",
        minimum: -180,
        maximum: 180,
        type: Number,
    })
    @IsOptional()
    @ValidateIf((obj: CreateRestaurantDto) => obj.latitude !== undefined || obj.longitude !== undefined)
    @IsLongitude({ message: 'Longitude phải là số hợp lệ từ -180 đến 180' })
    longitude?: number;

    @ApiPropertyOptional({
        example: "+84901234567",
        description: "Số điện thoại liên hệ của nhà hàng (chuẩn VN)",
        type: String,
    })
    @IsOptional()
    @IsPhoneNumber('VN', { message: 'Số điện thoại không hợp lệ' })
    phone?: string;

    @ApiPropertyOptional({
        example: "contact@bepnhaviet.vn",
        description: "Email liên hệ của nhà hàng",
        type: String,
    })
    @IsOptional()
    @IsEmail({}, { message: 'Email không hợp lệ' })
    email?: string;

    @ApiPropertyOptional({
        example: "Asia/Ho_Chi_Minh",
        description: "Múi giờ vận hành của nhà hàng",
        default: "Asia/Ho_Chi_Minh",
        type: String,
    })
    @IsOptional()
    @IsTimeZone({ message: 'Timezone không hợp lệ' })
    timezone: string = 'Asia/Ho_Chi_Minh';

    @ApiProperty({
        type: () => OperatingHours,
        description: "Giờ mở cửa theo từng ngày trong tuần",
    })
    @IsNotEmpty({ message: 'Giờ mở cửa không được để trống' })
    @ValidateNested()
    @Type(() => OperatingHours)
    operating_hours: OperatingHours;
}

export class UpdateRestaurantDto extends PartialType(
    OmitType(CreateRestaurantDto, ['slug', 'operating_hours'] as const)
) {}

export class UpdateOperatingHoursDto extends PickType(CreateRestaurantDto, ['operating_hours'] as const) {}
    

export class UpdateRestaurantfinancialDto {
        @ApiPropertyOptional({
                example: 0.08,
                description: "Thuế suất áp dụng cho nhà hàng",
                minimum: 0,
                maximum: 1,
                type: Number,
        })
    @IsOptional()
    @Min(0, { message: 'Tax rate phải từ 0 trở lên' })
    @Max(1, { message: 'Tax rate phải nhỏ hơn hoặc bằng 1' })
    tax_rate?: number;

        @ApiPropertyOptional({
                enum: ["VND", "USD", "EUR"],
                example: "VND",
                description: "Đơn vị tiền tệ được phép",
        })
    @IsOptional()
    @IsEnum(["VND", "USD", "EUR"], { message: 'Currency phải là VND, USD hoặc EUR' })
    currency?: string;

        @ApiPropertyOptional({
                example: 0.05,
                description: "Tỷ lệ phụ phí dịch vụ",
                minimum: 0,
                maximum: 0.1,
                type: Number,
        })
    @IsOptional()
    @Min(0, { message: 'Service charge rate phải từ 0 trở lên' })
    @Max(0.1, { message: 'Service charge rate phải nhỏ hơn hoặc bằng 0.1' })
    service_charge_rate?: number;
}


export class PaginateDto {
        @ApiPropertyOptional({
                example: 1,
                description: "Trang hiện tại (bắt đầu từ 1)",
                minimum: 1,
                default: 1,
                type: Number,
        })
    @IsInt()
    @Type(() => Number)
    @Min(1, { message: 'Page phải từ 1 trở lên' })
    page: number = 1;

        @ApiPropertyOptional({
                example: 10,
                description: "Số bản ghi trên một trang",
                minimum: 1,
                maximum: 30,
                default: 10,
                type: Number,
        })
    @IsInt()
    @Type(() => Number)
    @Min(1, { message: 'Limit phải từ 1 trở lên' })
    @Max(30, { message: 'Limit phải nhỏ hơn hoặc bằng 30' })
    limit: number = 10;

        @ApiPropertyOptional({
                enum: ['name', 'distance', 'price_range'],
                example: 'name',
                description: "Tiêu chí sắp xếp",
                default: 'name',
        })
    @IsOptional()
    @IsEnum(['name', 'distance', 'price_range'], { message: 'Sort phải là name, distance hoặc price_range' })
    sort: 'name' | 'distance' | 'price_range' = 'name';
}

export class SearchRestaurantDto {
    @ApiProperty({
        example: "Ho Chi Minh",
        description: "Thành phố cần tìm nhà hàng",
        type: String,
    })
  @IsOptional()
  @IsString()
  city?: string;
 
    @ApiPropertyOptional({
        example: "Vietnamese",
        description: "Lọc theo loại ẩm thực",
        type: String,
    })
  @IsOptional()
  @IsString()
  cuisine_type?: string;
 
    @ApiPropertyOptional({
        example: [1, 2],
        description: "Lọc nhiều mức giá, truyền dạng 1,2 hoặc mảng số",
        type: [Number],
    })
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
 
    @ApiPropertyOptional({
        example: true,
        description: "Lọc nhà hàng có nhận đơn online",
        type: Boolean,
    })
  @IsOptional()
    @Transform(({ value }) => {
        if (typeof value === 'boolean') {
            return value;
        }
        if (typeof value === 'string') {
            return value.toLowerCase() === 'true';
        }
        return value;
    })
  @IsBoolean()
  accepts_online?: boolean;
 
    @ApiPropertyOptional({
        example: 10.7769,
        description: "Vĩ độ. Bắt buộc khi có lng",
        minimum: -90,
        maximum: 90,
        type: Number,
    })
        @ValidateIf((obj: SearchRestaurantDto) => obj.lat !== undefined || obj.lng !== undefined)
  @Type(() => Number)
    @IsNumber({}, { message: 'lat là bắt buộc khi có lng' })
  @Min(-90)
  @Max(90)
  lat?: number;
 
    @ApiPropertyOptional({
        example: 106.7009,
        description: "Kinh độ. Bắt buộc khi có lat",
        minimum: -180,
        maximum: 180,
        type: Number,
    })
        @ValidateIf((obj: SearchRestaurantDto) => obj.lat !== undefined || obj.lng !== undefined)
  @Type(() => Number)
  @IsNumber({}, { message: 'lng là bắt buộc khi có lat' })
  @Min(-180)
  @Max(180)
  lng?: number;
 
    @ApiPropertyOptional({
        example: 10,
        description: "Bán kính tìm kiếm theo km khi dùng lat/lng",
        minimum: 1,
        maximum: 50,
        default: 10,
        type: Number,
    })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  radius_km?: number = 10;
 
    @ApiPropertyOptional({
        example: "pho",
        description: "Từ khóa tìm theo tên nhà hàng (không phân biệt hoa thường)",
        type: String,
    })
  @IsOptional()
  @IsString()
  q?: string;
 
    @ApiPropertyOptional({
        enum: ['distance', 'name'],
        example: 'name',
        description: "Tiêu chí sắp xếp kết quả",
        default: 'name',
    })
  @IsOptional()
  @IsIn(['distance', 'name'])
  sort?: 'distance' | 'name' = 'name';
 
    @ApiPropertyOptional({
        example: 1,
        description: "Trang hiện tại",
        minimum: 1,
        default: 1,
        type: Number,
    })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;
 
    @ApiPropertyOptional({
        example: 20,
        description: "Số lượng phần tử mỗi trang",
        minimum: 1,
        maximum: 50,
        default: 20,
        type: Number,
    })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}

export class OwnerRestaurantListQueryDto {
    @ApiPropertyOptional({
        example: 1,
        description: "Trang hiện tại",
        minimum: 1,
        default: 1,
        type: Number,
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1, { message: 'Page phải từ 1 trở lên' })
    page: number = 1;

    @ApiPropertyOptional({
        example: 10,
        description: "Số nhà hàng trên một trang",
        minimum: 1,
        maximum: 50,
        default: 10,
        type: Number,
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1, { message: 'Limit phải từ 1 trở lên' })
    @Max(50, { message: 'Limit phải nhỏ hơn hoặc bằng 50' })
    limit: number = 10;

    @ApiPropertyOptional({
        enum: ['published'],
        example: 'published',
        description: "Lọc theo trạng thái xuất bản",
    })
    @IsOptional()
    @IsIn(['published'], { message: 'Status chỉ hỗ trợ giá trị published' })
    status?: 'published';

    @ApiPropertyOptional({
        example: '664f1a2b3c4d5e6f7a8b9c0d',
        description: "Chỉ admin dùng để lấy danh sách theo owner cụ thể",
        type: String,
    })
    @IsOptional()
    @IsMongoId({ message: 'owner_id phải là ObjectId hợp lệ' })
    owner_id?: string;
}

export class UpdatePublishStatusDto {
    @ApiProperty({
        example: true,
        description: "Trạng thái xuất bản mong muốn",
        type: Boolean,
    })
    @IsBoolean({ message: 'is_published phải là boolean' })
    is_published: boolean;
}

export class UpdateOnlineOrdersDto {
    @ApiProperty({
        example: true,
        description: "Trạng thái nhận đơn online mong muốn",
        type: Boolean,
    })
    @IsBoolean({ message: 'accepts_online_orders phải là boolean' })
    accepts_online_orders: boolean;
}

export class UpdateRestaurantSettingsDto {
    @ApiProperty({
        description: "Patch settings theo whitelist: auto_confirm_orders, min_order_amount, delivery_radius_km, max_advance_booking_days",
        type: Object,
        example: {
            auto_confirm_orders: true,
            min_order_amount: 150000,
            delivery_radius_km: 8,
            max_advance_booking_days: 14,
        },
    })
    @IsObject({ message: 'settings phải là object' })
    @IsNotEmptyObject({}, { message: 'settings không được rỗng' })
    settings: Record<string, unknown>;
}

export class UpdateRestaurantLogoDto {
    @ApiProperty({
        example: "https://res.cloudinary.com/demo/image/upload/v1/restaurants/new-logo.png",
        description: "HTTPS URL của logo",
        type: String,
    })
    @IsString()
    @IsUrl(
        { require_protocol: true, protocols: ['https'] },
        { message: 'logo_url phải là HTTPS URL hợp lệ' },
    )
    logo_url: string;
}

export class UpdateRestaurantCoverDto {
    @ApiProperty({
        example: "https://res.cloudinary.com/demo/image/upload/v1/restaurants/new-cover.webp",
        description: "HTTPS URL của ảnh bìa",
        type: String,
    })
    @IsString()
    @IsUrl(
        { require_protocol: true, protocols: ['https'] },
        { message: 'cover_image_url phải là HTTPS URL hợp lệ' },
    )
    cover_image_url: string;
}

export class AddRestaurantGalleryImageDto {
    @ApiProperty({
        example: "https://res.cloudinary.com/demo/image/upload/v1/restaurants/gallery-3.jpg",
        description: "HTTPS URL ảnh cần thêm vào gallery",
        type: String,
    })
    @IsString()
    @IsUrl(
        { require_protocol: true, protocols: ['https'] },
        { message: 'image_url phải là HTTPS URL hợp lệ' },
    )
    image_url: string;
}

export class RestaurantLocationDto {
    @ApiProperty({
        enum: ['Point'],
        example: 'Point',
        description: "GeoJSON type cho vị trí nhà hàng",
    })
    type: string;

    @ApiProperty({
        type: [Number],
        example: [106.7009, 10.7769],
        description: "Toạ độ [longitude, latitude]",
    })
    coordinates: [number, number];
}

export class RestaurantSettingsResponseDto {
    @ApiPropertyOptional({
        example: true,
        description: "Tự động xác nhận đơn hàng",
        type: Boolean,
    })
    auto_confirm_orders?: boolean;

    @ApiPropertyOptional({
        example: 150000,
        description: "Giá trị đơn tối thiểu (VNĐ)",
        type: Number,
    })
    min_order_amount?: number;

    @ApiPropertyOptional({
        example: 8,
        description: "Bán kính giao hàng tối đa theo km",
        type: Number,
    })
    delivery_radius_km?: number;

    @ApiPropertyOptional({
        example: 14,
        description: "Số ngày tối đa cho phép đặt trước",
        type: Number,
    })
    max_advance_booking_days?: number;
}

export class RestaurantDocumentResponseDto {
    @ApiProperty({
        example: '664f1a2b3c4d5e6f7a8b9c0d',
        description: "ID nhà hàng",
        type: String,
    })
    _id: string;

    @ApiProperty({
        example: '664f1a2b3c4d5e6f7a8b9c0a',
        description: "ID chủ sở hữu nhà hàng",
        type: String,
    })
    owner_id: string;

    @ApiProperty({
        example: 'Bep Nha Viet',
        description: "Tên nhà hàng",
        type: String,
    })
    name: string;

    @ApiProperty({
        example: 'bep-nha-viet',
        description: "Slug public của nhà hàng",
        type: String,
    })
    slug: string;

    @ApiPropertyOptional({
        example: 'Nhà hàng chuyên món Việt truyền thống',
        description: "Mô tả nhà hàng",
        nullable: true,
        type: String,
    })
    description: string | null;

    @ApiPropertyOptional({
        example: 'Vietnamese',
        description: "Loại ẩm thực",
        nullable: true,
        type: String,
    })
    cuisine_type: string | null;

    @ApiPropertyOptional({
        example: 2,
        description: "Mức giá từ 1 đến 4",
        nullable: true,
        type: Number,
    })
    price_range: number | null;

    @ApiPropertyOptional({
        example: 'https://res.cloudinary.com/demo/image/upload/v1/restaurants/logo.jpg',
        description: "URL logo",
        nullable: true,
        type: String,
    })
    logo_url: string | null;

    @ApiPropertyOptional({
        example: 'https://res.cloudinary.com/demo/image/upload/v1/restaurants/cover.jpg',
        description: "URL ảnh bìa",
        nullable: true,
        type: String,
    })
    cover_image_url: string | null;

    @ApiProperty({
        type: [String],
        example: [
            'https://res.cloudinary.com/demo/image/upload/v1/restaurants/gallery-1.jpg',
            'https://res.cloudinary.com/demo/image/upload/v1/restaurants/gallery-2.jpg',
        ],
        description: "Danh sách ảnh gallery",
    })
    gallery_urls: string[];

    @ApiProperty({
        example: '123 Nguyen Hue, Quan 1',
        description: "Địa chỉ chi tiết",
        type: String,
    })
    address: string;

    @ApiProperty({
        example: 'Ho Chi Minh',
        description: "Thành phố",
        type: String,
    })
    city: string;

    @ApiPropertyOptional({
        example: 'Quan 1',
        description: "Quận/Huyện",
        nullable: true,
        type: String,
    })
    district: string | null;

    @ApiPropertyOptional({
        example: 'Ben Nghe',
        description: "Phường/Xã",
        nullable: true,
        type: String,
    })
    ward: string | null;

    @ApiPropertyOptional({
        example: 10.7769,
        description: "Vĩ độ",
        nullable: true,
        type: Number,
    })
    latitude: number | null;

    @ApiPropertyOptional({
        example: 106.7009,
        description: "Kinh độ",
        nullable: true,
        type: Number,
    })
    longitude: number | null;

    @ApiProperty({
        type: () => RestaurantLocationDto,
        description: "Dữ liệu vị trí GeoJSON dùng cho tìm kiếm không gian",
    })
    location: RestaurantLocationDto;

    @ApiPropertyOptional({
        example: '+84901234567',
        description: "Số điện thoại liên hệ",
        nullable: true,
        type: String,
    })
    phone: string | null;

    @ApiPropertyOptional({
        example: 'contact@bepnhaviet.vn',
        description: "Email liên hệ",
        nullable: true,
        type: String,
    })
    email: string | null;

    @ApiPropertyOptional({
        example: 'https://bepnhaviet.vn',
        description: "Website nhà hàng",
        nullable: true,
        type: String,
    })
    website: string | null;

    @ApiProperty({
        type: () => OperatingHours,
        description: "Giờ hoạt động theo ngày",
    })
    operating_hours: OperatingHours;

    @ApiProperty({
        example: 'Asia/Ho_Chi_Minh',
        description: "Múi giờ",
        type: String,
    })
    timezone: string;

    @ApiProperty({
        example: 'VND',
        description: "Đơn vị tiền tệ",
        type: String,
    })
    currency: string;

    @ApiProperty({
        example: 0.1,
        description: "Thuế suất",
        type: Number,
    })
    tax_rate: number;

    @ApiProperty({
        example: 0,
        description: "Tỷ lệ phụ phí dịch vụ",
        type: Number,
    })
    service_charge_rate: number;

    @ApiProperty({
        example: false,
        description: "Trạng thái xuất bản",
        type: Boolean,
    })
    is_published: boolean;

    @ApiProperty({
        example: false,
        description: "Trạng thái nhận đơn online",
        type: Boolean,
    })
    accepts_online_orders: boolean;

    @ApiProperty({
        type: () => RestaurantSettingsResponseDto,
        description: "Cài đặt nội bộ của nhà hàng",
    })
    settings: RestaurantSettingsResponseDto;

    @ApiPropertyOptional({
        example: null,
        nullable: true,
        type: String,
        format: 'date-time',
        description: "Thời điểm soft-delete, null nếu chưa xoá",
    })
    deleted_at: string | null;

    @ApiProperty({
        example: '2026-04-17T03:20:56.000Z',
        type: String,
        format: 'date-time',
        description: "Thời điểm tạo nhà hàng",
    })
    created_at: string;

    @ApiProperty({
        example: '2026-04-17T03:20:56.000Z',
        type: String,
        format: 'date-time',
        description: "Thời điểm cập nhật gần nhất",
    })
    updated_at: string;
}

export class RestaurantStaffDetailResponseDto extends OmitType(
    RestaurantDocumentResponseDto,
    ['tax_rate', 'service_charge_rate', 'settings'] as const,
) {}

export class RestaurantPublicDetailResponseDto extends OmitType(
    RestaurantDocumentResponseDto,
    ['owner_id', 'settings'] as const,
) {}

export class RestaurantOwnerListItemDto {
    @ApiProperty({ example: '664f1a2b3c4d5e6f7a8b9c0d', description: "ID nhà hàng", type: String })
    _id: string;

    @ApiProperty({ example: 'Bep Nha Viet', description: "Tên nhà hàng", type: String })
    name: string;

    @ApiProperty({ example: 'bep-nha-viet', description: "Slug nhà hàng", type: String })
    slug: string;

    @ApiProperty({ example: true, description: "Trạng thái xuất bản", type: Boolean })
    is_published: boolean;

    @ApiProperty({ example: true, description: "Trạng thái nhận đơn online", type: Boolean })
    accepts_online_orders: boolean;

    @ApiPropertyOptional({
        example: 'https://res.cloudinary.com/demo/image/upload/v1/restaurants/logo.jpg',
        description: "URL logo",
        nullable: true,
        type: String,
    })
    logo_url: string | null;

    @ApiProperty({
        example: '2026-04-17T03:20:56.000Z',
        type: String,
        format: 'date-time',
        description: "Thời điểm tạo nhà hàng",
    })
    created_at: string;
}

export class PaginationMetaDto {
    @ApiProperty({ example: 1, description: "Trang hiện tại", type: Number })
    page: number;

    @ApiProperty({ example: 10, description: "Số bản ghi một trang", type: Number })
    limit: number;

    @ApiProperty({ example: 34, description: "Tổng số bản ghi", type: Number })
    total: number;

    @ApiProperty({ example: 4, description: "Tổng số trang", type: Number })
    total_pages: number;
}

export class OwnerRestaurantListResponseDto {
    @ApiProperty({
        type: () => [RestaurantOwnerListItemDto],
        description: "Danh sách nhà hàng của owner",
    })
    data: RestaurantOwnerListItemDto[];

    @ApiProperty({ type: () => PaginationMetaDto, description: "Thông tin phân trang" })
    pagination: PaginationMetaDto;
}

export class PublicRestaurantSearchItemDto {
    @ApiProperty({ example: '664f1a2b3c4d5e6f7a8b9c0d', description: "ID nhà hàng", type: String })
    _id: string;

    @ApiProperty({ example: 'Bep Nha Viet', description: "Tên nhà hàng", type: String })
    name: string;

    @ApiProperty({ example: 'bep-nha-viet', description: "Slug nhà hàng", type: String })
    slug: string;

    @ApiPropertyOptional({
        example: 'Nhà hàng chuyên món Việt truyền thống',
        description: "Mô tả nhà hàng",
        nullable: true,
        type: String,
    })
    description: string | null;

    @ApiPropertyOptional({
        example: 'Vietnamese',
        description: "Loại ẩm thực",
        nullable: true,
        type: String,
    })
    cuisine_type: string | null;

    @ApiPropertyOptional({
        example: 2,
        description: "Mức giá 1-4",
        nullable: true,
        type: Number,
    })
    price_range: number | null;

    @ApiPropertyOptional({
        example: 'https://res.cloudinary.com/demo/image/upload/v1/restaurants/logo.jpg',
        description: "URL logo",
        nullable: true,
        type: String,
    })
    logo_url: string | null;

    @ApiPropertyOptional({
        example: 'https://res.cloudinary.com/demo/image/upload/v1/restaurants/cover.jpg',
        description: "URL ảnh bìa",
        nullable: true,
        type: String,
    })
    cover_image_url: string | null;

    @ApiProperty({ example: '123 Nguyen Hue, Quan 1', description: "Địa chỉ chi tiết", type: String })
    address: string;

    @ApiProperty({ example: 'Ho Chi Minh', description: "Thành phố", type: String })
    city: string;

    @ApiPropertyOptional({ example: 'Quan 1', description: "Quận/Huyện", nullable: true, type: String })
    district: string | null;

    @ApiPropertyOptional({ example: 'Ben Nghe', description: "Phường/Xã", nullable: true, type: String })
    ward: string | null;

    @ApiPropertyOptional({ example: 10.7769, description: "Vĩ độ", nullable: true, type: Number })
    latitude: number | null;

    @ApiPropertyOptional({ example: 106.7009, description: "Kinh độ", nullable: true, type: Number })
    longitude: number | null;

    @ApiPropertyOptional({
        example: '+84901234567',
        description: "Số điện thoại liên hệ",
        nullable: true,
        type: String,
    })
    phone: string | null;

    @ApiProperty({ type: () => OperatingHours, description: "Giờ mở cửa theo ngày" })
    operating_hours: OperatingHours;

    @ApiProperty({
        example: true,
        description: "Nhà hàng có nhận đơn online không",
        type: Boolean,
    })
    accepts_online_orders: boolean;

    @ApiPropertyOptional({
        example: 2.4,
        description: "Khoảng cách theo km (chỉ có khi tìm theo lat/lng)",
        nullable: true,
        type: Number,
    })
    distance_km: number | null;
}

export class SearchRestaurantResponseDto {
    @ApiProperty({
        type: () => [PublicRestaurantSearchItemDto],
        description: "Danh sách nhà hàng khớp điều kiện tìm kiếm",
    })
    data: PublicRestaurantSearchItemDto[];

    @ApiProperty({ type: () => PaginationMetaDto, description: "Thông tin phân trang" })
    pagination: PaginationMetaDto;
}

export class SlugAvailabilityResponseDto {
    @ApiProperty({ example: true, description: "Slug còn khả dụng hay không", type: Boolean })
    available: boolean;
}

export class UpdatedResponseDto {
    @ApiProperty({ example: true, description: "Trạng thái cập nhật thành công", type: Boolean })
    updated: boolean;
}

export class RestaurantSettingsUpdateResponseDto {
    @ApiProperty({ example: true, description: "Đánh dấu cập nhật settings thành công", type: Boolean })
    updated: boolean;

    @ApiProperty({ type: () => RestaurantSettingsResponseDto, description: "Settings sau khi merge" })
    settings: RestaurantSettingsResponseDto;
}

export class UpdateRestaurantLogoResponseDto {
    @ApiProperty({
        example: 'https://res.cloudinary.com/demo/image/upload/v1/restaurants/new-logo.png',
        description: "URL logo mới",
        type: String,
    })
    logo_url: string;
}

export class UpdateRestaurantCoverResponseDto {
    @ApiProperty({
        example: 'https://res.cloudinary.com/demo/image/upload/v1/restaurants/new-cover.webp',
        description: "URL ảnh bìa mới",
        type: String,
    })
    cover_image_url: string;
}

export class GalleryMutationResponseDto {
    @ApiProperty({
        type: [String],
        example: [
            'https://res.cloudinary.com/demo/image/upload/v1/restaurants/gallery-1.jpg',
            'https://res.cloudinary.com/demo/image/upload/v1/restaurants/gallery-3.jpg',
        ],
        description: "Danh sách ảnh gallery sau cập nhật",
    })
    gallery_urls: string[];

    @ApiProperty({ example: 2, description: "Tổng số ảnh trong gallery", type: Number })
    count: number;
}

export class UpdatePublishStatusResponseDto {
    @ApiProperty({ example: true, description: "Trạng thái xuất bản hiện tại", type: Boolean })
    is_published: boolean;

    @ApiProperty({
        example: 'Trạng thái xuất bản đã được cập nhật.',
        description: "Thông điệp nghiệp vụ",
        type: String,
    })
    message: string;
}

export class UpdateOnlineOrdersResponseDto {
    @ApiProperty({ example: true, description: "Trạng thái nhận đơn online hiện tại", type: Boolean })
    accepts_online_orders: boolean;

    @ApiProperty({
        example: 'Trạng thái nhận đơn online đã được cập nhật.',
        description: "Thông điệp nghiệp vụ",
        type: String,
    })
    message: string;
}

export class DeleteRestaurantResponseDto {
    @ApiProperty({ example: true, description: "Đánh dấu xoá mềm thành công", type: Boolean })
    deleted: boolean;

    @ApiProperty({ example: 'Nhà hàng đã được xóa.', description: "Thông điệp nghiệp vụ", type: String })
    message: string;
}
 