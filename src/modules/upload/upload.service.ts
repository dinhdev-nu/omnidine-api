import { Inject, Injectable } from '@nestjs/common';
import { INJECTION_TOKEN } from 'src/common/constants/injection-token.constant';
import { UploadResponseDto } from './dto/upload-response.dto';
import { UploadApiResponse } from 'cloudinary';
import { ERROR_CODE } from 'src/common/constants/error-code.constant';
import {
  BadRequestException,
  TooManyRequestException,
} from 'src/common/exceptions';
import { existsSync, unlinkSync } from 'fs';
import Redis from 'ioredis';

const RATE_LIMIT_UPLOAD_KEY_PREFIX = 'rate_limit:upload:';
const RATE_LIMIT_UPLOAD_MULTI_KEY_PREFIX = 'rate_limit:upload:multi:';
const RATE_LIMIT_UPLOAD_REPLACE_KEY_PREFIX = 'rate_limit:upload:replace:';
const RATE_LIMIT_UPLOAD_TTL_SECONDS = 3600; // 1 hour in seconds
const RATE_LIMIT_MAX_UPLOADS = 100;
@Injectable()
export class UploadService {
  constructor(
    @Inject(INJECTION_TOKEN.CLOUDINARY)
    private readonly cloudinary: typeof import('cloudinary').v2,

    @Inject(INJECTION_TOKEN.REDIS_CLIENT)
    private readonly redis: Redis,
  ) {}

  async upload(
    file: Express.Multer.File,
    userId: string,
  ): Promise<UploadResponseDto> {
    // Rate limit
    const uploadKey = `${RATE_LIMIT_UPLOAD_KEY_PREFIX}${userId}`;
    const currentUploads = await this.redis.incr(uploadKey);
    if (currentUploads === 1)
      await this.redis.expire(uploadKey, RATE_LIMIT_UPLOAD_TTL_SECONDS);
    if (currentUploads > RATE_LIMIT_MAX_UPLOADS) {
      throw new TooManyRequestException(
        ERROR_CODE.TOO_MANY_REQUESTS,
        'Upload rate limit exceeded. Please try again later.',
      );
    }

    try {
      const result: UploadApiResponse = await this.cloudinary.uploader.upload(
        file.path,
        { resource_type: 'auto', folder: 'multi-restaurant-manager/uploads' },
      );

      return {
        url: result.secure_url,
        filename: result.public_id,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      };
    } catch (error) {
      console.error('Upload error:', error);
      throw new BadRequestException(
        ERROR_CODE.UPLOAD_ERROR,
        'Failed to upload file',
      );
    } finally {
      if (existsSync(file.path)) {
        unlinkSync(file.path);
      }
    }
  }

  async multipleUpload(
    files: Express.Multer.File[],
    userId: string,
  ): Promise<UploadResponseDto[]> {
    // Rate limit for multiple uploads
    const multiUploadKey = `${RATE_LIMIT_UPLOAD_MULTI_KEY_PREFIX}${userId}`;
    const currentMultiUploads = await this.redis.incr(multiUploadKey);
    if (currentMultiUploads === 1) {
      await this.redis.expire(multiUploadKey, RATE_LIMIT_UPLOAD_TTL_SECONDS);
    }
    if (currentMultiUploads > RATE_LIMIT_MAX_UPLOADS) {
      throw new TooManyRequestException(
        ERROR_CODE.TOO_MANY_REQUESTS,
        'Multiple upload rate limit exceeded. Please try again later.',
      );
    }

    const uploadPromises = files.map((file) => this.upload(file, userId));
    return Promise.allSettled(uploadPromises).then((results) => {
      const successfulUploads = results.filter(
        (result) => result.status === 'fulfilled',
      );
      const failedUploads = results.filter(
        (result) => result.status === 'rejected',
      );
      if (failedUploads.length > 0) {
        throw new BadRequestException(
          ERROR_CODE.UPLOAD_ERROR,
          `${failedUploads.length} out of ${files.length} files failed to upload`,
        );
      }
      return successfulUploads.map((result) => result.value);
    });
  }

  async replaceUpload(
    oldImgUrl: string,
    newFile: Express.Multer.File,
    userId: string,
  ): Promise<UploadResponseDto> {
    // Race limit for replace uploads
    const uploadKey = `${RATE_LIMIT_UPLOAD_REPLACE_KEY_PREFIX}${userId}`;
    const currentUploads = await this.redis.incr(uploadKey);
    if (currentUploads === 1)
      await this.redis.expire(uploadKey, RATE_LIMIT_UPLOAD_TTL_SECONDS);
    if (currentUploads > RATE_LIMIT_MAX_UPLOADS) {
      throw new TooManyRequestException(
        ERROR_CODE.TOO_MANY_REQUESTS,
        'Upload rate limit exceeded. Please try again later.',
      );
    }

    try {
      await this.delete(oldImgUrl);
      return await this.upload(newFile, userId);
    } catch (error) {
      console.error('Replace upload error:', error);
      throw new BadRequestException(
        ERROR_CODE.UPLOAD_ERROR,
        'Failed to replace file',
      );
    }
  }

  async delete(imgUrl: string): Promise<void> {
    let publicId = imgUrl.split('/').slice(-1)[0].split('.')[0];
    publicId = `multi-restaurant-manager/uploads/${publicId}`;
    try {
      await this.cloudinary.uploader.destroy(publicId);
    } catch {
      throw new BadRequestException(
        ERROR_CODE.DELETE_ERROR,
        'Failed to delete file',
      );
    }
  }
}
