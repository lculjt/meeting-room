import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
export class RegisterUserDto {
  @IsNotEmpty({
    message: '用户名不能为空',
  })
  @ApiProperty()
  username: string;

  @IsNotEmpty({
    message: '昵称不能为空',
  })
  @ApiProperty()
  nickName: string;

  @IsNotEmpty({
    message: '密码不能为空',
  })
  @ApiProperty({
    minLength: 6,
  })
  @MinLength(6, {
    message: '密码不能少于 6 位',
  })
  password: string;

  @IsNotEmpty({
    message: '邮箱不能为空',
  })
  @ApiProperty()
  @IsEmail(
    {},
    {
      message: '不是合法的邮箱格式',
    },
  )
  email: string;

  @IsNotEmpty({
    message: '验证码不能为空',
  })
  @ApiProperty()
  captcha: string;
}
