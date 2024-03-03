import { Module, Global } from '@nestjs/common';
import { RedisService } from './redis.service';
import { createClient } from 'redis';
@Global()
@Module({
  providers: [
    RedisService,
    {
      provide: 'REDIS_CLIENT',
      useFactory: async () => {
        const client = createClient({
          socket: {
            host: '127.0.0.1',
            port: 6379,
          },
          database: 1, // redis 不同的命名空间
        });
        await client.connect();
        return client;
      },
    },
  ],
  exports: [RedisService],
})
export class RedisModule {}
