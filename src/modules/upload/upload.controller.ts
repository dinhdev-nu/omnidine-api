import { Body, Controller, Delete, ParseFilePipe, Post, Query, UploadedFile, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { UploadService } from './upload.service';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { swWrap } from 'src/common/swagger/api-response.util';
import { FileSizeValidationPipe } from 'src/common/pipes/file-size.pipe';
import { FileTypeValidationPipe } from 'src/common/pipes/file-type.pipe';
import { CurrentUser } from 'src/common/decorators';

const uploadedFileSchema = {
  type: 'object',
  properties: {
    url: {
      type: 'string',
      example:
        'https://res.cloudinary.com/demo/image/upload/v1719999999/multi-restaurant-manager/uploads/menu.jpg',
    },
    filename: {
      type: 'string',
      example: 'multi-restaurant-manager/uploads/menu_abc123',
    },
    originalname: { type: 'string', example: 'menu.jpg' },
    mimetype: { type: 'string', example: 'image/jpeg' },
    size: { type: 'number', example: 24567 },
  },
};

@ApiTags('upload')
@ApiBearerAuth()
@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @ApiOperation({ summary: 'Upload a single file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Attach one file in the "file" field.',
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiOkResponse({
    description: 'File uploaded successfully',
    schema: swWrap(uploadedFileSchema, 'File uploaded successfully'),
  })
  @ApiBadRequestResponse({ description: 'Invalid file or upload failed' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @Post('single')
  @UseInterceptors(FileInterceptor('file'))
  async uploadSingle(
    @UploadedFile( 
      new FileSizeValidationPipe(5), 
      new FileTypeValidationPipe(['image/jpeg', 'image/png', 'application/pdf']),
    ) file: Express.Multer.File,
    @CurrentUser('sub') userId: string
  ) {
    return this.uploadService.upload(file, userId);
  }

  @ApiOperation({ summary: 'Upload multiple files' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Attach multiple files in the "files" field.',
    schema: {
      type: 'object',
      required: ['files'],
      properties: {
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
    },
  })
  @ApiOkResponse({
    description: 'All files uploaded successfully',
    schema: swWrap({ type: 'array', items: uploadedFileSchema }, 'Files uploaded successfully'),
  })
  @ApiBadRequestResponse({ description: 'One or more files failed to upload' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @Post('multiple')
  @UseInterceptors(FilesInterceptor('files', 10))
  async uploadMultiple(
    @UploadedFiles(
      new FileSizeValidationPipe(5),
      new FileTypeValidationPipe(['image/jpeg', 'image/png', 'application/pdf']),
    ) files: Express.Multer.File[],
    @CurrentUser('sub') userId: string
  ) {
    return this.uploadService.multipleUpload(files, userId);
  }

@ApiOperation({ summary: 'Replace an uploaded file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Provide the publicId (or full URL) of the file to replace and attach the new file.',
    schema: {
      type: 'object',
      required: ['imgUrl', 'file'], // Đổi tên cho khớp với code
      properties: {
        imgUrl: { 
          type: 'string', 
          description: 'The Public ID or URL of the old file' 
        },
        file: { 
          type: 'string', 
          format: 'binary',
          description: 'The new file to upload'
        },
      },
    },
  })
  @ApiOkResponse({
    description: 'File replaced successfully',
    schema: swWrap(uploadedFileSchema, 'File replaced successfully'),
  })
  @ApiBadRequestResponse({ description: 'Invalid file, imgUrl, or replace failed' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @Post('replace')
  @UseInterceptors(FileInterceptor('file'))
  async replaceFile(
    @Body('imgUrl') imgUrl: string, 
    @UploadedFile(
      new FileSizeValidationPipe(5),
      new FileTypeValidationPipe(['image/jpeg', 'image/png', 'application/pdf']),
    ) file: Express.Multer.File,
    @CurrentUser('sub') userId: string
  ) {
    return this.uploadService.replaceUpload(imgUrl, file, userId);
  }

  @ApiOperation({ summary: 'Delete an uploaded file by public id' })
  @ApiQuery({
    name: 'imgUrl', // Sửa từ publicId thành imgUrl
    required: true,
    type: String,
    description: 'Cloudinary public_id or full URL.',
    example: 'multi-restaurant-manager/uploads/il77n5fsaz4lipxu6xge',
  })
  @ApiOkResponse({
    description: 'Delete request processed',
    schema: swWrap(),
  })
  @ApiBadRequestResponse({ description: 'Failed to delete file' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @Delete()
  async deleteFile(
    @Query('imgUrl') imgUrl: string
  ) {
    return this.uploadService.delete(imgUrl);
  }
}
