import {
  Injectable,
  Logger,
  Inject,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { RegisterUserDto } from './dto/register.dto';
import { RedisService } from 'src/redis/redis.service';
import { md5 } from '../utils';
@Injectable()
export class UserService {
  private logger = new Logger();

  @InjectRepository(User)
  private userRepository: Repository<User>;

  @Inject(RedisService)
  private redisService: RedisService;

  async register(user: RegisterUserDto) {
    const captcha = await this.redisService.get(`captcha_${user.email}`);
    if (!captcha) {
      throw new HttpException('验证码已失效', HttpStatus.BAD_REQUEST);
    }
    if (captcha !== user.captcha) {
      throw new HttpException('验证码错误', HttpStatus.BAD_REQUEST);
    }
    const existUser = await this.userRepository.findOne({
      where: {
        username: user.username,
      },
    });
    if (existUser) {
      throw new HttpException('用户名已存在', HttpStatus.BAD_REQUEST);
    }
    const newUser = new User();
    newUser.username = user.username;
    newUser.password = md5(user.password);
    newUser.email = user.email;
    newUser.nickName = user.nickName;
    try {
      await this.userRepository.save(newUser);
      return 'success';
    } catch (e) {
      this.logger.error(e, UserService);
      return 'fail';
    }
  }
}
