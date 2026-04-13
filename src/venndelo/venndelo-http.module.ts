import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { VenndeloHttpService } from './venndelo-http.service';

@Module({
  imports: [
    HttpModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        timeout: configService.get<number>('venndelo.timeout', 10000),
        maxRedirects: 5,
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [VenndeloHttpService],
  exports: [VenndeloHttpService],
})
export class VenndeloHttpModule {}
