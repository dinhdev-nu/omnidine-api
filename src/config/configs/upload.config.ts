import { registerAs } from "@nestjs/config";

export interface IUploadConfig {
    destination: string;
    maxFileSize: number;
    allowedMimeTypes: string[];
    cloudinaryName: string;
    cloudinaryApiKey: string;
    cloudinaryApiSecret: string;
}

export default registerAs('upload', () => ({
    destination: process.env.UPLOAD_DESTINATION,
    maxFileSize: Number(process.env.UPLOAD_MAX_FILE_SIZE),
    allowedMimeTypes: process.env.UPLOAD_ALLOWED_MIME_TYPES?.split(',').map(type => type.trim()),
    cloudinaryName: process.env.CLOUDINARY_CLOUD_NAME,
    cloudinaryApiKey: process.env.CLOUDINARY_API_KEY,
    cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET,
}))
