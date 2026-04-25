import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import { Response, Request } from "express";
import { BaseException } from "../exceptions";
import { ERROR_CODE } from "../constants/error-code.constant";
import { CORRELATION_ID_HEADER } from "../middlewares/correlation-id.middleware";
import { AppLoggerService } from "../../logger/logger.service";
import { ApiErrorRessponse } from "../interfaces/api-response.interface";
import { AppConfigService } from "src/config/config.service";



@Catch(HttpException) // Bắt tất cả các lỗi HttpException
export class HttpExceptionFilter implements ExceptionFilter {

    constructor(
        private readonly loggerService: AppLoggerService,
        private readonly config: AppConfigService
    ) {}

    catch(exception: HttpException, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const res = ctx.getResponse<Response>();
        const req = ctx.getRequest<Request>();

        const status = exception.getStatus();
        const correlationId = req[CORRELATION_ID_HEADER] || 'N/A';
       
        if (exception instanceof BaseException) {
            const errResponse: ApiErrorRessponse = {
                success: false,
                errorCode: exception.errorCode,
                message: exception.message,
                details: exception.details || null,
                path: req.url,
                correlationId,
                timestamp: new Date().toISOString()
            };

            if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
                this.loggerService.error(
                    exception.message,
                    { correlationId, method: req.method, url: req.url, status, code: exception.errorCode, stack: exception.stack }
                );
            } else {
                const warnMeta: any = { correlationId, method: req.method, url: req.url, status, code: exception.errorCode };
                if (!this.config.isProduction) {
                    warnMeta.stack = exception.stack;
                }
                this.loggerService.warn(
                    exception.message,
                    warnMeta
                );
            }
            return res.status(status).json(errResponse);
        }

        // Handle Exception for pipe
        const response = exception.getResponse() as any
        if (
            status === HttpStatus.BAD_REQUEST 
            && Array.isArray(response.message)
        ) {
            const errorResponse: ApiErrorRessponse = {
                success: false,
                errorCode: ERROR_CODE.VALIDATION_ERROR,
                message: 'Dư liệu đầu vào không hợp lệ',
                details: response.message,
                path: req.url,
                correlationId,
                timestamp: new Date().toISOString()
            };
            const warnMeta1: any = { correlationId, method: req.method, url: req.url, status, code: errorResponse.errorCode };
            if (!this.config.isProduction) {
                warnMeta1.stack = exception.stack;
            }
            this.loggerService.warn(
                    exception.message,
                    warnMeta1,
            );
            return res.status(status).json(errorResponse);
        }

        // Handle Not Found Exception
       if (status === HttpStatus.NOT_FOUND) {
            const errorResponse: ApiErrorRessponse = {
                success: false,
                errorCode: ERROR_CODE.RESOURCE_NOT_FOUND,
                message: `${req.url} not found`,
                details: response.message || null,
                path: req.url,
                correlationId,
                timestamp: new Date().toISOString()
            };
            const warnMeta2: any = { correlationId, method: req.method, url: req.url, status, code: errorResponse.errorCode };
            if (!this.config.isProduction) {
                warnMeta2.stack = exception.stack;
            }
            this.loggerService.warn(
                exception.message, 
                warnMeta2
            );
            return res.status(status).json(errorResponse);
        }


        // Handle other HttpException
        const errResponse: ApiErrorRessponse = {
            success: false,
            errorCode: status >= HttpStatus.INTERNAL_SERVER_ERROR ? ERROR_CODE.INTERNAL_ERROR : ERROR_CODE.COMMON_ERROR,
            message: typeof response === 'string' ? response : (response.message || 'An error occurred'),
            details: null,
            path: req.url,
            correlationId,
            timestamp: new Date().toISOString()
        };
        if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
            this.loggerService.error(
                exception.message || 'An error occurred',
                { correlationId, method: req.method, url: req.url, status, code: errResponse.errorCode, stack: exception.stack }
            );
        } else {
            const warnMeta3: any = { correlationId, method: req.method, url: req.url, status, code: errResponse.errorCode };
            if (!this.config.isProduction) {
                warnMeta3.stack = exception.stack;
            }
            this.loggerService.warn(
                exception.message || 'An error occurred',
                warnMeta3
            );
        }
        return res.status(status).json(errResponse);
    }

}