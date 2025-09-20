import {
  Controller,
  Post,
  Body,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ListingService } from './listing.service';
import {
  ScrapeApartmentDto,
  ScrapeApartmentResponseDto,
} from './listing.types';
import { AuthGuard } from 'src/guard/AuthGuard';
import { UseGuards } from '@nestjs/common';
import { GetUser } from 'src/guard/user.decorator';
import { User } from '@supabase/supabase-js';

@Controller('listing')
@UseGuards(AuthGuard)
export class ListingController {
  private readonly logger = new Logger(ListingController.name);

  constructor(private readonly listingService: ListingService) {}

  @Post('scrape')
  async scrapeApartment(
    @Body() scrapeDto: ScrapeApartmentDto,
    @GetUser() user: User,
  ): Promise<ScrapeApartmentResponseDto> {
    if (!scrapeDto.url) {
      throw new HttpException('URL is required', HttpStatus.BAD_REQUEST);
    }

    if (!this.isValidApartmentsUrl(scrapeDto.url)) {
      throw new HttpException(
        'Invalid URL. Please provide a valid apartments.com URL',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const scrapedData = await this.listingService.scrapeApartmentData(
        scrapeDto.url,
        user,
      );

      this.logger.log(
        `Successfully scraped data for property: ${scrapedData.propertyName}`,
      );

      return {
        success: true,
        data: scrapedData,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Error scraping apartment data: ${errorMessage}`,
        errorStack,
      );

      return {
        success: false,
        error: `Failed to scrape apartment data: ${errorMessage}`,
      };
    }
  }

  private isValidApartmentsUrl(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      return (
        parsedUrl.hostname === 'www.apartments.com' ||
        parsedUrl.hostname === 'apartments.com'
      );
    } catch {
      return false;
    }
  }
}
