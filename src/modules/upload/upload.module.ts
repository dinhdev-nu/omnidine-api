import { Module } from '@nestjs/common';
import { UploadService } from './upload.service';
import { UploadController } from './upload.controller';
import { MulterModule } from '@nestjs/platform-express';
import { AppConfigService } from 'src/config/config.service';
import { multerConfig } from 'src/common/configs/multer.config';
import { CloudinaryProvider } from 'src/common/configs/cloudinary.config';


@Module({
  imports: [MulterModule.registerAsync({
    inject: [AppConfigService],
    useFactory: (config: AppConfigService) => multerConfig(config),
  })],
  controllers: [UploadController],
  providers: [
    UploadService,
    CloudinaryProvider,
  ],
})
export class UploadModule {}
