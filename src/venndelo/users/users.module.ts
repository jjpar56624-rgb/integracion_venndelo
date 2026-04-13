import { Module } from '@nestjs/common';
import { VenndeloHttpModule } from '../venndelo-http.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [VenndeloHttpModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
