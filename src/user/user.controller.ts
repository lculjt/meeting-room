import {
  Body,
  Controller,
  Post,
  Query,
  Get,
  UnauthorizedException,
} from '@nestjs/common';
import { UserService } from './user.service';
import { RegisterUserDto } from './dto/register.dto';
import { RedisService } from 'src/redis/redis.service';
import { EmailService } from 'src/email/email.service';
import { LoginUserDto } from './dto/login-user.dto';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UserInfo } from './vo/login-user.vo';
import {
  RequireLogin,
  RequirePermission,
  UserData,
} from 'src/helper/decorator';

@Controller('user')
export class UserController {
  private generateAccessToken: (info: UserInfo) => string;
  private generateRefreshToken: (info: UserInfo) => string;

  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly emailService: EmailService,
  ) {
    this.generateAccessToken = (info) => {
      return this.jwtService.sign(
        {
          userId: info.id,
          username: info.username,
          roles: info.roles,
          permissions: info.permissions,
        },
        {
          expiresIn: this.configService.get('jwt_access_token_expires_time'),
        },
      );
    };

    this.generateRefreshToken = (info) => {
      return this.jwtService.sign(
        {
          userId: info.id,
        },
        {
          expiresIn: this.configService.get('jwt_refresh_token_expires_time'),
        },
      );
    };
  }

  @Get('init-data')
  async initData() {
    await this.userService.initData();
    return 'done';
  }

  @Post('register')
  async register(@Body() registerUser: RegisterUserDto) {
    return await this.userService.register(registerUser);
  }

  @Post('login')
  async userLogin(@Body() loginUser: LoginUserDto) {
    const vo = await this.userService.login(loginUser, false);

    vo.accessToken = this.generateAccessToken(vo.userInfo);
    vo.refreshToken = this.generateRefreshToken(vo.userInfo);

    return vo;
  }

  @Get('dd')
  @RequireLogin()
  @RequirePermission('ccc')
  dd(@UserData() user: any) {
    // 测试权限
    return user;
  }

  @Post('admin/login')
  async adminLogin(@Body() loginUser: LoginUserDto) {
    const vo = await this.userService.login(loginUser, true);

    vo.accessToken = this.generateAccessToken(vo.userInfo);
    vo.refreshToken = this.generateRefreshToken(vo.userInfo);
    return vo;
  }

  @Get('refresh')
  async refresh(@Query('refreshToken') refreshToken: string) {
    try {
      const data = this.jwtService.verify(refreshToken);

      const user = await this.userService.findUserById(data.userId, false);

      const access_token = this.generateAccessToken(user);

      const refresh_token = this.generateRefreshToken(user);

      return {
        access_token,
        refresh_token,
      };
    } catch (e) {
      throw new UnauthorizedException('token 已失效，请重新登录');
    }
  }

  @Get('admin/refresh')
  async adminRefresh(@Query('refreshToken') refreshToken: string) {
    try {
      const data = this.jwtService.verify(refreshToken);

      const user = await this.userService.findUserById(data.userId, true);

      const access_token = this.generateAccessToken(user);
      const refresh_token = this.generateRefreshToken(user);

      return {
        access_token,
        refresh_token,
      };
    } catch (e) {
      throw new UnauthorizedException('token 已失效，请重新登录');
    }
  }

  @Get('register-captcha')
  async captcha(@Query('address') address: string) {
    const code = Math.random().toString().slice(2, 8);

    await this.redisService.set(`captcha_${address}`, code, 5 * 60);

    await this.emailService.sendMail({
      to: address,
      subject: '注册验证码',
      html: `<p>你的注册验证码是 ${code}</p>`,
    });
    return 'success';
  }
}
