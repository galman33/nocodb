import { promisify } from 'util';
import { Injectable, Optional } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-google-oauth20';
import bcrypt from 'bcryptjs';
import { Plugin, ProjectUser, User } from '../../models';
import { UsersService } from '../../services/users/users.service';
import type { VerifyCallback } from 'passport-google-oauth20';
import type { FactoryProvider } from '@nestjs/common/interfaces/modules/provider.interface';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    @Optional() clientConfig: any,
    private usersService: UsersService,
  ) {
    super(clientConfig);
  }

  async validate(
    req: any,
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    // mostly copied from older code
    const email = profile.emails[0].value;
    try {
      const user = await User.getByEmail(email);
      if (user) {
        // if project id defined extract project level roles
        if (req.ncProjectId) {
          ProjectUser.get(req.ncProjectId, user.id)
            .then(async (projectUser) => {
              user.roles = projectUser?.roles || user.roles;
              user.roles =
                user.roles === 'owner' ? 'owner,creator' : user.roles;
              // + (user.roles ? `,${user.roles}` : '');

              done(null, user);
            })
            .catch((e) => done(e));
        } else {
          return done(null, user);
        }
        // if user not found create new user if allowed
        // or return error
      } else {
        const salt = await promisify(bcrypt.genSalt)(10);
        const user = await this.usersService.registerNewUserIfAllowed({
          firstname: null,
          lastname: null,
          email_verification_token: null,
          email: profile.emails[0].value,
          password: '',
          salt,
        });
        return done(null, user);
      }
    } catch (err) {
      return done(err);
    }
  }

  authorizationParams(options: any) {
    const params = super.authorizationParams(options) as Record<string, any>;

    if (options.state) {
      params.state = options.state;
    }

    return params;
  }
}

export const GoogleStrategyProvider: FactoryProvider = {
  provide: GoogleStrategy,
  inject: [UsersService],
  useFactory: async (usersService: UsersService) => {
    // const googlePlugin = await Plugin.getPluginByTitle('Google');
    //
    // if (googlePlugin && googlePlugin.input) {
    //   const settings = JSON.parse(googlePlugin.input);
    //   process.env.NC_GOOGLE_CLIENT_ID = settings.client_id;
    //   process.env.NC_GOOGLE_CLIENT_SECRET = settings.client_secret;
      process.env.NC_GOOGLE_CLIENT_ID = '618215793166-fr1niicbc4eljt03gu5hr95pqd6q2ccb.apps.googleusercontent.com';
      process.env.NC_GOOGLE_CLIENT_SECRET = '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'
    // }
    if (
      !process.env.NC_GOOGLE_CLIENT_ID ||
      !process.env.NC_GOOGLE_CLIENT_SECRET
    )
      return null;

    const clientConfig = {
      clientID: process.env.NC_GOOGLE_CLIENT_ID,
      clientSecret: process.env.NC_GOOGLE_CLIENT_SECRET,
      // todo: update url
      callbackURL: 'http://localhost:3000',
      passReqToCallback: true,
    };

    return new GoogleStrategy(clientConfig, usersService);
  },
};
