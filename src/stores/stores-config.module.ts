import { Module } from '@nestjs/common';
import { StoresConfigService } from './stores-config.service';

@Module({
  providers: [StoresConfigService],
  exports: [StoresConfigService],
})
export class StoresConfigModule {}
