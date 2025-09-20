import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import { ListingModule } from './listing/listing.module';
import { SupabaseModule } from 'nestjs-supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

@Module({
  imports: [
    SupabaseModule.forRoot({
      supabaseUrl: process.env.SUPABASE_URL!,
      supabaseKey: process.env.SUPABASE_KEY!,
    }),
    HealthModule,
    ListingModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
