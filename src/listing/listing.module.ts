import { Module } from '@nestjs/common';
import { ListingController } from './listing.controller';
import { ListingService } from './listing.service';
import { SupabaseModule } from 'nestjs-supabase-js';

@Module({
  imports: [SupabaseModule.injectClient()],
  controllers: [ListingController],
  providers: [ListingService],
  exports: [ListingService],
})
export class ListingModule {}
