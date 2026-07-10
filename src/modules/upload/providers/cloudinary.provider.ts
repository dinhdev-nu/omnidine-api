import { Provider } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { AppConfigService } from 'src/config/config.service';
import { INJECTION_TOKEN } from 'src/common/constants/injection-token.constant';

export const CloudinaryProvider: Provider = {
  provide: INJECTION_TOKEN.CLOUDINARY,
  inject: [AppConfigService],
  useFactory: (config: AppConfigService) => {
    cloudinary.config({
      cloud_name: config.upload.cloudinaryName,
      api_key: config.upload.cloudinaryApiKey,
      api_secret: config.upload.cloudinaryApiSecret,
    });
    return cloudinary;
  },
};
