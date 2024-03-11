import {
  Body,
  Controller,
  Post,
  Query,
  Get,
  UnauthorizedException,
  DefaultValuePipe,
  HttpStatus,
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
import { UserDetailVo } from './vo/user-info.vo';
import { UpdateUserPasswordDto } from './dto/update-user-password.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { generateParseIntPipe } from 'src/utils';
import {
  ApiQuery,
  ApiResponse,
  ApiTags,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';

@ApiTags('用户管理模块')
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

  @ApiBody({ type: RegisterUserDto })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: '验证码已失效/验证码不正确/用户已存在',
    type: String,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '注册成功/失败',
    type: String,
  })
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

  @ApiQuery({
    name: 'address',
    type: String,
    required: true,
    description: '邮箱地址',
    example: 'xxx@xx.com',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '发送成功',
    type: String,
  })
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

  @Get('update_password/captcha')
  async updatePasswordCaptcha(@Query('address') address: string) {
    const code = Math.random().toString().slice(2, 8);

    await this.redisService.set(
      `update_password_captcha_${address}`,
      code,
      10 * 60,
    );

    await this.emailService.sendMail({
      to: address,
      subject: '更改密码验证码',
      html: `<p>你的更改密码验证码是 ${code}</p>`,
    });
    return '发送成功';
  }

  @Get('info')
  @ApiBearerAuth()
  @RequireLogin()
  async getInfo(@UserData('userId') userId: number) {
    const userInfo = await this.userService.findUserDetailById(userId);

    const vo = new UserDetailVo();
    vo.id = userInfo.id;
    vo.email = userInfo.email;
    vo.username = userInfo.username;
    vo.headPic = userInfo.headPic;
    vo.phoneNumber = userInfo.phoneNumber;
    vo.nickName = userInfo.nickName;
    vo.createTime = userInfo.createTime;
    vo.isFrozen = userInfo.isFrozen;

    return vo;
  }

  @Post(['update_password', 'admin/update_password'])
  @RequireLogin()
  async updatePassword(
    @UserData('userId') userId: number,
    @Body() passwordDto: UpdateUserPasswordDto,
  ) {
    await this.userService.updatePassword(userId, passwordDto);
    return 'success';
  }

  @Post(['update', 'admin/update'])
  @RequireLogin()
  async update(
    @UserData('userId') userId: number,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return await this.userService.update(userId, updateUserDto);
  }

  @Get('update/captcha')
  async updateCaptcha(@Query('address') address: string) {
    const code = Math.random().toString().slice(2, 8);

    await this.redisService.set(
      `update_user_captcha_${address}`,
      code,
      10 * 60,
    );

    await this.emailService.sendMail({
      to: address,
      subject: '更改用户信息验证码',
      html: `<p>你的验证码是 ${code}</p>`,
    });
    return '发送成功';
  }

  @Get('freeze')
  async freeze(@Query('id') userId: number) {
    await this.userService.freezeUserById(userId);
    return 'success';
  }

  @Get('list')
  async list(
    @Query('pageNo', new DefaultValuePipe(1), generateParseIntPipe('pageNo'))
    pageNo?: number,
    @Query(
      'pageSize',
      new DefaultValuePipe(2),
      generateParseIntPipe('pageSize'),
    )
    pageSize?: number,
    @Query('username') username?: string,
    @Query('nickName') nickName?: string,
    @Query('email') email?: string,
  ) {
    return await this.userService.findUsersByPage(
      pageNo,
      pageSize,
      username,
      nickName,
      email,
    );
  }
}
