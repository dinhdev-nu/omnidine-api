import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { MailModule } from '../../shared/mail/mail.module';
import { User, UserSchema } from './schemas/user.schema';
import { UserSession, UserSessionSchema } from './schemas/user-session.schema';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OAuthProvider, OAuthProviderSchema } from './schemas/oauth-provider.schema';
import { INJECTION_TOKEN } from 'src/common/constants/injection-token.constant';
import { UserRepository } from './repositories/user.repository';
import { SessionRepository } from './repositories/session.repository';
import { OAuthProviderRepository } from './repositories/oauth-provider.repository';
import { UserController } from './user.controller';
import { UserService } from './user.service';

@Module({

  imports: [
    JwtModule,
    MongooseModule.forFeature([
    { name: User.name, schema: UserSchema },
    { name: UserSession.name, schema: UserSessionSchema },
    { name: OAuthProvider.name, schema: OAuthProviderSchema }
  ]),
    MailModule
  ],

  controllers: [AuthController, UserController],
  providers: [
    AuthService,
    UserService,
    {
      provide: INJECTION_TOKEN.USER_REPOSITORY,
      useClass: UserRepository
    },
    {
      provide: INJECTION_TOKEN.SESSION_REPOSITORY,
      useClass: SessionRepository
    },
    {
      provide: INJECTION_TOKEN.OAUTH_PROVIDER_REPOSITORY,
      useClass: OAuthProviderRepository
    }
  ],
  exports: [AuthService, JwtModule, INJECTION_TOKEN.USER_REPOSITORY]
})
export class AuthModule {}
   
