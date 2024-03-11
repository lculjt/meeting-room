import { BadRequestException, ParseIntPipe } from '@nestjs/common';
import * as crypto from 'crypto';

export function md5(str: string) {
  return crypto.createHash('md5').update(str).digest('hex');
}

export function generateParseIntPipe(name: string) {
  return new ParseIntPipe({
    exceptionFactory: () => {
      throw new BadRequestException(name + ' should be a number');
    },
  });
}
