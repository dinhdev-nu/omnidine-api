import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { randomUUID } from 'crypto';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { AppConfigService } from 'src/config/config.service';
import { BadRequestException } from 'src/common/exceptions';
import { ERROR_CODE } from 'src/common/constants/error-code.constant';

export const multerConfig = (config: AppConfigService): MulterOptions => ({
  storage: diskStorage({
    destination: config.upload.destination,
    filename: (req, file, cb) => {
      cb(null, `${Date.now()}-${randomUUID()}-${extname(file.originalname)}`);
    },
  }),
  limits: {
    fileSize: config.upload.maxFileSize,
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = config.upload.allowedMimeTypes;
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return cb(
        new BadRequestException(
          ERROR_CODE.UPLOAD_FILE_TYPE_NOT_ALLOWED,
          `File type ${file.mimetype} is not allowed`,
        ),
        false,
      );
    }
    cb(null, true);
  },
});
