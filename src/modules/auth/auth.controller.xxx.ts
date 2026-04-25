import { Body, Controller, Delete, Get, Param, Post, Req, Res } from "@nestjs/common";
import {
    ApiBadRequestResponse,
    ApiBearerAuth,
    ApiBody,
    ApiConflictResponse,
    ApiCookieAuth,
    ApiForbiddenResponse,
    ApiInternalServerErrorResponse,
    ApiNotFoundResponse,
    ApiOkResponse,
    ApiOperation,
    ApiParam,
    ApiQuery,
    ApiResponse,
    ApiTags,
    ApiTooManyRequestsResponse,
    ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { AuthService } from "./auth.service.xxx";
import { Cookie, CurrentUser, Public } from "src/common/decorators";
import { ThrottleCustom } from "src/common/decorators/throttler/throttler.decorator";
import {
    RegisterDTO, CheckEmailDTO, VerifyOTPDTO, ResendOTPDTO, LoginDTO, DeviceInfo,
    Send2FAOtpDTO, Verify2FAOTPDTO, ForgotPasswordDTO, VerifyForgotPasswordOTPDTO,
    ResetPasswordDTO, ChangePasswordDTO, Enable2FADTO, Disable2FADTO, RevokeSessionDTO,
    SendPhoneOTPDTO, VerifyPhoneOTPDTO,
} from "./dto/auth.dto";
import { SuccessResponse } from "src/common/interceptors/transform-response.interceptor";
import { UserIP } from "src/common/decorators/user/ip.decorator";
import { UserDevice } from "src/common/decorators/user/device.decotator";
import { Request, Response } from "express";
import { Types } from "mongoose";
import { AppConfigService } from "src/config/config.service";
import { ObjectIdUtil } from "src/common/utils/object-id.util";
import { swWrap } from "src/common/swagger/api-response.util";

@ApiTags('auth')
@Controller('auths')
export class AuthController {
    constructor(
        private readonly authService: AuthService,
        private readonly config: AppConfigService
    ) {}

    // ─── Registration flow ────────────────────────────────────────────────────

    @ApiOperation({ summary: 'Check if an email is already registered' })
    @ApiBody({ type: CheckEmailDTO })
    @ApiOkResponse({
        description: 'Email availability check result',
        schema: swWrap({
            type: 'object',
            required: ['available'],
            properties: {
                available: { type: 'boolean', example: true, description: 'Email is available to register or not' },
                acction: {
                    type: 'string',
                    example: 'resend_otp',
                    nullable: true,
                    description: 'Next action suggested by server when account is pending',
                },
                hint: {
                    type: 'string',
                    example: 'alice@example.com',
                    nullable: true,
                    description: 'Identifier hint for follow-up request',
                },
            },
        }),
    })
    @ApiBadRequestResponse({ description: 'Invalid request body' })
    @ApiConflictResponse({ description: 'Email already exists with active/inactive/banned status' })
    @ApiTooManyRequestsResponse({ description: 'Rate limit: 20 requests per 60 seconds' })
    @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
    @Public()
    @ThrottleCustom('check-email', { ttl: 60000, limit: 20 })
    @Post("/check-email")
    async checkEmailExist(
        @Body() dto: CheckEmailDTO
    ): Promise<{ available: boolean, acction?: string, hint?: string }> {
        return this.authService.checkEmailExist(dto)
    }

    @ApiOperation({
        summary: 'Register a new account',
        description: 'Creates account and sends OTP verification email. **Rate limit: 5 req / hour**.',
    })
    @ApiBody({ type: RegisterDTO })
    @ApiResponse({
        status: 201,
        description: 'Account created — OTP sent to email',
        schema: swWrap(
            {
                type: 'object',
                required: ['message'],
                properties: {
                    message: { type: 'string', example: 'OTP sent' },
                    acction: { type: 'string', example: 'resend_otp', nullable: true },
                    hint: { type: 'string', example: 'alice@example.com', nullable: true },
                },
            },
            'Registration successful, OTP sent to your email'
        ),
    })
    @ApiBadRequestResponse({ description: 'Invalid request body' })
    @ApiConflictResponse({ description: 'Email already registered' })
    @ApiTooManyRequestsResponse({ description: 'Rate limit: 5 requests per hour' })
    @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
    @Public()
    @ThrottleCustom('register', { ttl: 3600000, limit: 5 })
    @Post("/register")
    async register(@Body() dto: RegisterDTO) {
        const res = await this.authService.register(dto)
        return {
            data: res,
            message: "Registration successful, OTP sent to your email"
        } as SuccessResponse
    }

    @ApiOperation({ summary: 'Verify email OTP after registration' })
    @ApiBody({ type: VerifyOTPDTO })
    @ApiOkResponse({
        description: 'Email verified — account is now active',
        schema: swWrap({
            type: 'object',
            required: ['verified'],
            properties: {
                verified: { type: 'boolean', example: true },
            },
        }),
    })
    @ApiBadRequestResponse({ description: 'Invalid or expired OTP' })
    @ApiNotFoundResponse({ description: 'Pending user or OTP not found/expired' })
    @ApiTooManyRequestsResponse({ description: 'OTP attempts exceeded' })
    @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
    @Public()
    @Post("/verify-otp")
    async verifyOTP(@Body() dto: VerifyOTPDTO) {
        return this.authService.verifyOTP(dto)
    }

    @ApiOperation({ summary: 'Resend email verification OTP' })
    @ApiBody({ type: ResendOTPDTO })
    @ApiOkResponse({
        description: 'OTP resent',
        schema: swWrap(
            {
                type: 'object',
                required: ['message'],
                properties: {
                    message: { type: 'string', example: 'Sent' },
                },
            },
            'Sent'
        ),
    })
    @ApiBadRequestResponse({ description: 'Invalid request body' })
    @ApiNotFoundResponse({ description: 'Pending user not found' })
    @ApiTooManyRequestsResponse({ description: 'Too many resend attempts' })
    @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
    @Public()
    @Post("/resend-otp")
    async resendOTP(@Body() dto: ResendOTPDTO) {
        return this.authService.resendOTP(dto)
    }

    // ─── Login flow ───────────────────────────────────────────────────────────

    @ApiOperation({
        summary: 'Login with email or phone number',
        description: [
            'Authenticates the user and returns an `access_token`.',
            'An `httpOnly` **refresh_token** cookie is set automatically on success.',
            'If the account has 2FA enabled, a `temp_token` is returned instead — use it to complete login via the 2FA endpoints.',
            '',
            '**Rate limit:** 10 requests per 5 minutes.',
        ].join('\n'),
    })
    @ApiBody({ type: LoginDTO })
    @ApiOkResponse({
        description: 'Login successful or requires 2FA',
        schema: {
            oneOf: [
                swWrap({
                    type: 'object',
                    required: ['access_token'],
                    properties: {
                        access_token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
                    },
                }),
                swWrap({
                    type: 'object',
                    required: ['state', 'temp_token', 'method'],
                    properties: {
                        state: { type: 'string', example: '2fa_required' },
                        temp_token: { type: 'string', example: 'f31b08f0d43b4ea08fce4d356a4d2cf8' },
                        method: { type: 'string', example: 'email' },
                    },
                }),
            ],
        },
    })
    @ApiBadRequestResponse({ description: 'Invalid request body' })
    @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
    @ApiNotFoundResponse({ description: 'User account not found' })
    @ApiForbiddenResponse({ description: 'User status invalid or login method not allowed' })
    @ApiTooManyRequestsResponse({ description: 'Rate limit: 10 requests per 5 minutes' })
    @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
    @Public()
    @ThrottleCustom('login', { ttl: 300000, limit: 10 })
    @Post("/login")
    async login(
        @UserIP() user_ip: string, @UserDevice() user_device: DeviceInfo, @Body() dto: LoginDTO,
        @Res({ passthrough: true }) res: Response
    ) {
        dto.identifier_type = dto.identifier.includes('@') ? 'email' : 'phone';
        dto.user_ip = user_ip;
        dto.device_info = user_device;
        const response = await this.authService.login(dto)
        if ('refresh_token' in response && response.refresh_token) {
            res.cookie('refresh_token', response.refresh_token, {
                httpOnly: true,
                secure: true,
                sameSite: 'none',
                maxAge: dto.remember_me ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000,
            });
            return { access_token: response.access_token }
        }
        return response;
    }

    // ─── 2FA flow ─────────────────────────────────────────────────────────────

    @ApiOperation({
        summary: 'Send 2FA OTP to registered email',
        description: 'Use the `temp_token` received from the login step when the account has 2FA enabled.',
    })
    @ApiBody({ type: Send2FAOtpDTO })
    @ApiOkResponse({
        description: '2FA OTP sent to email',
        schema: swWrap(
            {
                type: 'object',
                required: ['message', 'expires_in'],
                properties: {
                    message: { type: 'string', example: 'OTP đã được gửi lại' },
                    expires_in: { type: 'number', example: 300 },
                },
            },
            'OTP đã được gửi lại'
        ),
    })
    @ApiBadRequestResponse({ description: 'Invalid or expired temp_token / invalid ip address' })
    @ApiTooManyRequestsResponse({ description: 'Too many requests for 2FA OTP' })
    @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
    @Public()
    @Post("2fa/send-otp")
    async send2FAOTP(@UserIP() user_ip: string, @Body() dto: Send2FAOtpDTO) {
        return this.authService.send2FAEmailOTP(dto.temp_token, user_ip)
    }

    @ApiOperation({
        summary: 'Verify 2FA OTP and complete login',
        description: 'On success, sets an `httpOnly` **refresh_token** cookie and returns an `access_token`.',
    })
    @ApiBody({ type: Verify2FAOTPDTO })
    @ApiOkResponse({
        description: 'Login completed — refresh_token set as httpOnly cookie',
        schema: swWrap({
            type: 'object',
            required: ['access_token'],
            properties: {
                access_token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
            },
        }),
    })
    @ApiBadRequestResponse({ description: 'Invalid or expired OTP / temp_token / invalid ip address' })
    @ApiNotFoundResponse({ description: 'User not found for pending 2FA flow' })
    @ApiTooManyRequestsResponse({ description: 'Too many invalid OTP attempts' })
    @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
    @Public()
    @Post("2fa/verify-otp")
    async verify2FAOTP(
        @UserIP() user_ip: string, @Body() dto: Verify2FAOTPDTO,
        @Res({ passthrough: true }) res: Response
    ) {
        const response = await this.authService.verify2FAOTP(dto.temp_token, dto.otp, user_ip)
        res.cookie('refresh_token', response.refresh_token, {
            httpOnly: true, secure: true, sameSite: 'none',
            maxAge: this.getTimeToLifeCookies(response.remember_me),
        });
        return { access_token: response.access_token }
    }

    // ─── Token management ─────────────────────────────────────────────────────

    @ApiOperation({
        summary: 'Refresh access token',
        description: 'Exchanges the `refresh_token` httpOnly cookie for a new `access_token`. The cookie is rotated automatically.',
    })
    @ApiCookieAuth('refresh_token')
    @ApiOkResponse({
        description: 'New access token issued — refresh_token cookie rotated',
        schema: swWrap({
            type: 'object',
            required: ['access_token'],
            properties: {
                access_token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
            },
        }),
    })
    @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired refresh_token cookie' })
    @ApiForbiddenResponse({ description: 'User status invalid (banned or inactive)' })
    @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
    @Public()
    @Post("/refresh-token")
    async refreshToken(
        @Cookie('REFRESH_TOKEN') refresh_token: string,
        @Res({ passthrough: true }) res: Response
    ) {
        const response = await this.authService.refreshToken(refresh_token)
        if (response.refresh_token) {
            res.cookie('refresh_token', response.refresh_token, {
                httpOnly: true, secure: true, sameSite: 'none',
                maxAge: this.getTimeToLifeCookies(response.remember_me ?? false),
            });
        }
        return { access_token: response.access_token };
    }

    @ApiOperation({ summary: 'Logout — invalidate current session' })
    @ApiBearerAuth()
    @ApiCookieAuth('refresh_token')
    @ApiOkResponse({
        description: 'Session invalidated — refresh_token cookie cleared',
        schema: swWrap({
            type: 'object',
            required: ['logged_out'],
            properties: {
                logged_out: { type: 'boolean', example: true },
            },
        }),
    })
    @ApiUnauthorizedResponse({ description: 'Unauthorized request or missing token context' })
    @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
    @Post("/logout")
    async logout(
        @Cookie('REFRESH_TOKEN') refresh_token: string,
        @CurrentUser('jti') jti: string,
        @Res({ passthrough: true }) res: Response
    ) {
        res.clearCookie('refresh_token', { httpOnly: true, secure: true, sameSite: 'none' });
        return this.authService.logout(refresh_token, jti)
    }

    @ApiOperation({ summary: 'Logout all sessions across every device' })
    @ApiBearerAuth()
    @ApiCookieAuth('refresh_token')
    @ApiOkResponse({
        description: 'All sessions revoked',
        schema: swWrap({
            type: 'object',
            required: ['logged_out_count'],
            properties: {
                logged_out_count: { type: 'number', example: 4 },
            },
        }),
    })
    @ApiUnauthorizedResponse({ description: 'Unauthorized request or missing token context' })
    @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
    @Post("/logout-all")
    async logoutAllSessions(
        @CurrentUser('sub') user_id: Types.ObjectId,
        @CurrentUser('jti') jti: string,
        @Cookie('REFRESH_TOKEN') refresh_token: string,
        @Res({ passthrough: true }) res: Response
    ) {
        res.clearCookie('refresh_token', { httpOnly: true, secure: true, sameSite: 'none' });
        return this.authService.logoutAllSessions(user_id, refresh_token, jti)
    }

    // ─── Password management ─────────────────────────────────────────────────

    @ApiOperation({
        summary: 'Request password reset — sends OTP to email',
        description: '**Rate limit:** 5 requests per hour.',
    })
    @ApiBody({ type: ForgotPasswordDTO })
    @ApiOkResponse({
        description: 'OTP sent — use session_token in the next step',
        schema: swWrap(
            {
                type: 'object',
                required: ['message', 'session_token'],
                properties: {
                    message: { type: 'string', example: 'OTP đã được gửi đến email của bạn' },
                    session_token: {
                        type: 'string',
                        example: '8f2477b4726f4f9b9d6b8fa54f0f0b74',
                        description: 'TTL: 15 minutes',
                    },
                },
            },
            'OTP sent to your email'
        ),
    })
    @ApiBadRequestResponse({ description: 'Invalid request body' })
    @ApiNotFoundResponse({ description: 'User email not found or account banned' })
    @ApiTooManyRequestsResponse({ description: 'Rate limit: 5 requests per hour' })
    @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
    @Public()
    @ThrottleCustom('forgot-password', { ttl: 3600000, limit: 5 })
    @Post("/forgot-password")
    async forgotPassword(@Body() dto: ForgotPasswordDTO) {
        return this.authService.forgotPassword(dto.email)
    }

    @ApiOperation({ summary: 'Verify reset-password OTP — exchange for a grant_token' })
    @ApiBody({ type: VerifyForgotPasswordOTPDTO })
    @ApiOkResponse({
        description: 'OTP verified — use grant_token in the reset-password step',
        schema: swWrap({
            type: 'object',
            required: ['verified', 'reset_grant_token'],
            properties: {
                verified: { type: 'boolean', example: true },
                reset_grant_token: {
                    type: 'string',
                    example: 'a03f0c3d2d62444da7ca10942be1d9d1',
                    description: 'TTL: 15 minutes',
                },
            },
        }),
    })
    @ApiBadRequestResponse({ description: 'Invalid or expired OTP / session_token' })
    @ApiNotFoundResponse({ description: 'OTP not found or expired' })
    @ApiTooManyRequestsResponse({ description: 'OTP attempts exceeded' })
    @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
    @Public()
    @Post("/reset-password/verify-otp")
    async verifyForgotPasswordOTP(@Body() dto: VerifyForgotPasswordOTPDTO) {
        return this.authService.verifyForgotPasswordOTP(dto.session_token, dto.otp)
    }

    @ApiOperation({ summary: 'Set a new password using the grant_token' })
    @ApiBody({ type: ResetPasswordDTO })
    @ApiOkResponse({
        description: 'Password reset successfully',
        schema: swWrap({
            type: 'object',
            required: ['reset'],
            properties: {
                reset: { type: 'boolean', example: true },
            },
        }),
    })
    @ApiBadRequestResponse({ description: 'Invalid or expired grant_token / invalid request body' })
    @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
    @Public()
    @Post("/reset-password")
    async resetPassword(@Body() dto: ResetPasswordDTO) {
        return this.authService.resetPassword(dto.grant_token, dto.new_password)
    }

    @ApiOperation({ summary: 'Change password while authenticated' })
    @ApiBearerAuth()
    @ApiCookieAuth('refresh_token')
    @ApiBody({ type: ChangePasswordDTO })
    @ApiOkResponse({
        description: 'Password changed',
        schema: swWrap({
            type: 'object',
            required: ['changed'],
            properties: {
                changed: { type: 'boolean', example: true },
            },
        }),
    })
    @ApiBadRequestResponse({ description: 'Invalid request body' })
    @ApiUnauthorizedResponse({ description: 'Current password is incorrect' })
    @ApiNotFoundResponse({ description: 'User not found' })
    @ApiTooManyRequestsResponse({ description: 'Too many change-password attempts' })
    @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
    @Post("/change-password")
    async changePassword(
        @CurrentUser('sub') user_id: Types.ObjectId,
        @Cookie('REFRESH_TOKEN') refresh_token: string,
        @Body() dto: ChangePasswordDTO
    ) {
        return this.authService.changePassword(user_id, refresh_token, dto.current_password, dto.new_password)
    }

    // ─── 2FA management ───────────────────────────────────────────────────────

    @ApiOperation({ summary: 'Enable two-factor authentication', description: 'Requires password confirmation.' })
    @ApiBearerAuth()
    @ApiBody({ type: Enable2FADTO })
    @ApiOkResponse({
        description: '2FA enabled',
        schema: swWrap({
            type: 'object',
            required: ['enabled'],
            properties: {
                enabled: { type: 'boolean', example: true },
            },
        }),
    })
    @ApiBadRequestResponse({ description: 'Password not set or email not verified' })
    @ApiUnauthorizedResponse({ description: 'Password is incorrect' })
    @ApiNotFoundResponse({ description: 'User not found' })
    @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
    @Post("/2fa/enable")
    async enable2FA(
        @CurrentUser('sub') user_id: Types.ObjectId,
        @Body() dto: Enable2FADTO
    ) {
        return this.authService.enable2FA(user_id, dto.password)
    }

    @ApiOperation({ summary: 'Disable two-factor authentication', description: 'Requires password confirmation.' })
    @ApiBearerAuth()
    @ApiBody({ type: Disable2FADTO })
    @ApiOkResponse({
        description: '2FA disabled',
        schema: swWrap({
            type: 'object',
            required: ['disabled'],
            properties: {
                disabled: { type: 'boolean', example: true },
            },
        }),
    })
    @ApiUnauthorizedResponse({ description: 'Password is incorrect' })
    @ApiNotFoundResponse({ description: 'User not found' })
    @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
    @Post("/2fa/disable")
    async disable2FA(
        @CurrentUser('sub') user_id: Types.ObjectId,
        @Body() dto: Disable2FADTO
    ) {
        return this.authService.disable2FA(user_id, dto.password)
    }

    // ─── Session management ───────────────────────────────────────────────────

    @ApiOperation({ summary: 'List all active sessions for the current user' })
    @ApiBearerAuth()
    @ApiCookieAuth('refresh_token')
    @ApiOkResponse({
        description: 'Session list',
        schema: swWrap({
            type: 'object',
            required: ['sessions'],
            properties: {
                sessions: {
                    type: 'array',
                    items: {
                        type: 'object',
                        required: ['session_id', 'created_at', 'expires_at', 'is_current'],
                        properties: {
                            session_id: { type: 'string', example: '664f1a2b3c4d5e6f7a8b9c0d' },
                            device_info: {
                                type: 'object',
                                nullable: true,
                                properties: {
                                    browser: { type: 'string', nullable: true, example: 'Chrome 124' },
                                    os: { type: 'string', nullable: true, example: 'Windows 11' },
                                    device: { type: 'string', nullable: true, example: 'Desktop' },
                                    user_agent: { type: 'string', nullable: true, example: 'Mozilla/5.0 ...' },
                                },
                            },
                            ip_address: { type: 'string', nullable: true, example: '14.240.102.55' },
                            created_at: { type: 'string', format: 'date-time', example: '2026-03-10T08:30:00.000Z' },
                            expires_at: { type: 'string', format: 'date-time', example: '2026-03-13T14:22:10.000Z' },
                            is_current: {
                                type: 'boolean',
                                example: true,
                                description: 'true = session being used right now',
                            },
                        },
                    },
                },
            },
        }),
    })
    @ApiUnauthorizedResponse({ description: 'Unauthorized request' })
    @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
    @Get("/sessions")
    async getSessions(
        @CurrentUser('sub') user_id: Types.ObjectId,
        @Cookie('REFRESH_TOKEN') refresh_token: string
    ) {
        return this.authService.getSessions(user_id, refresh_token)
    }

    @ApiOperation({
        summary: 'Revoke a specific session',
        description: 'If the revoked session is the current one, the `refresh_token` cookie is also cleared.',
    })
    @ApiBearerAuth()
    @ApiCookieAuth('refresh_token')
    @ApiBody({ type: RevokeSessionDTO })
    @ApiOkResponse({
        description: 'Session revoked',
        schema: swWrap({
            type: 'object',
            required: ['revoked'],
            properties: {
                revoked: { type: 'boolean', example: true },
            },
        }),
    })
    @ApiBadRequestResponse({ description: 'Invalid request body' })
    @ApiUnauthorizedResponse({ description: 'Unauthorized request' })
    @ApiNotFoundResponse({ description: 'Session not found' })
    @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
    @Delete("/sessions")
    async revokeSession(
        @CurrentUser('sub') user_id: Types.ObjectId,
        @Body() dto: RevokeSessionDTO,
        @Cookie('REFRESH_TOKEN') refresh_token: string,
        @CurrentUser('jti') jti: string,
        @Res({ passthrough: true }) res: Response
    ) {
        const sessionId = ObjectIdUtil.toObjectId(dto.session_id, 'session_id');
        const { revoked, isCurrentSession } = await this.authService.revokeSession(user_id, sessionId, refresh_token, jti)
         if (revoked && isCurrentSession) {
            res.clearCookie('refresh_token', { httpOnly: true, secure: true, sameSite: 'none' });
        }
        return  { revoked }
    }

    // ─── Phone verification ───────────────────────────────────────────────────

    @ApiOperation({ summary: 'Send OTP to verify a phone number', description: 'Binds a Vietnamese phone number to the authenticated account.' })
    @ApiBearerAuth()
    @ApiBody({ type: SendPhoneOTPDTO })
    @ApiOkResponse({
        description: 'OTP sent to phone',
        schema: swWrap(
            {
                type: 'object',
                required: ['message', 'expires_in'],
                properties: {
                    message: { type: 'string', example: 'Sent' },
                    expires_in: { type: 'number', example: 300 },
                },
            },
            'Sent'
        ),
    })
    @ApiBadRequestResponse({ description: 'Invalid phone format' })
    @ApiConflictResponse({ description: 'Phone number already used by another account' })
    @ApiTooManyRequestsResponse({ description: 'Too many SMS OTP requests' })
    @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
    @Post('/phone/send-otp')
    async sendPhoneOTP(
        @CurrentUser('sub') user_id: Types.ObjectId,
        @Body() dto: SendPhoneOTPDTO
    ) {
        return this.authService.sendPhoneOTP(user_id, dto.phone)
    }

    @ApiOperation({ summary: 'Verify the phone OTP' })
    @ApiBearerAuth()
    @ApiBody({ type: VerifyPhoneOTPDTO })
    @ApiOkResponse({
        description: 'Phone number verified and bound to account',
        schema: swWrap({
            type: 'object',
            required: ['verified'],
            properties: {
                verified: { type: 'boolean', example: true },
            },
        }),
    })
    @ApiBadRequestResponse({ description: 'Invalid or expired OTP' })
    @ApiTooManyRequestsResponse({ description: 'OTP attempts exceeded' })
    @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
    @Post('/phone/verify-otp')
    async verifyPhoneOTP(
        @CurrentUser('sub') user_id: Types.ObjectId,
        @Body() dto: VerifyPhoneOTPDTO
    ) {
        return this.authService.verifyPhoneOTP(user_id, dto.otp)
    }

    // ─── OAuth ────────────────────────────────────────────────────────────────

    @ApiOperation({ summary: 'Initiate OAuth login — redirects to provider login page' })
    @ApiParam({ name: 'provider', description: 'OAuth provider name', enum: ['google'], example: 'google' })
    @ApiResponse({ status: 302, description: 'Redirects to the OAuth provider authorization URL' })
    @ApiBadRequestResponse({ description: 'Invalid provider' })
    @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
    @Public()
    @Get('/oauth/:provider')
    async oauthLogin(@Param('provider') provider: string, @Res() res: Response) {
        const { redirect_url } = await this.authService.oauthInit(provider)
        return res.redirect(redirect_url);
    }

    @ApiOperation({ summary: 'OAuth callback endpoint from provider' })
    @ApiParam({ name: 'provider', description: 'OAuth provider name', enum: ['google'], example: 'google' })
    @ApiQuery({ name: 'code', type: String, required: true, description: 'Authorization code from OAuth provider' })
    @ApiQuery({ name: 'state', type: String, required: true, description: 'Anti-CSRF state token from oauth init step' })
    @ApiResponse({ status: 302, description: 'Sets refresh_token cookie and redirects to client oauth callback URL with access_token query param' })
    @ApiBadRequestResponse({ description: 'Invalid provider, state, or oauth code exchange failed' })
    @ApiForbiddenResponse({ description: 'User account blocked or invalid' })
    @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
    @Public()
    @Get('/:provider/callback')
    async oauthCallback(
        @Param('provider') provider: string,
        @UserIP() user_ip: string,
        @UserDevice() user_device: DeviceInfo,
        @Req() req: Request,
        @Res() res: Response
    ) {
        const { code, state } = req.query as { code: string, state: string }
        const dto: LoginDTO = {
            identifier: '',
            identifier_type: 'email',
            password: '',
            remember_me: false,
            user_ip,
            device_info: user_device
        }
        const response = await this.authService.oauthCallback(provider, code, state, dto)
        res.cookie('refresh_token', response.refresh_token, {
            httpOnly: true, secure: true, sameSite: 'none',
            maxAge: this.getTimeToLifeCookies(false),
        });
        const url = this.config.client.clientUrl + "/oauth/callback?access_token=" + response.access_token
        return res.redirect(url);
    }

    private getTimeToLifeCookies(rememberMe: boolean): number {
        return rememberMe ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
    }
}
