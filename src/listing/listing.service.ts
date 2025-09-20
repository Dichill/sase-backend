import { Injectable, Logger } from '@nestjs/common';
import puppeteer, { Page } from 'puppeteer';
import {
  ScrapedData,
  ContactInfo,
  AmenitiesResult,
  FeesPoliciesResult,
  AmenitySection,
  AmenityGroup,
  TabResult,
  Card,
  Row,
  DetailsCard,
  ModelCard,
  UnitRow,
  OfficeHour,
} from './listing.types';
import { SupabaseClient, User } from '@supabase/supabase-js';

@Injectable()
export class ListingService {
  constructor(private readonly supabaseClient: SupabaseClient) {}

  private readonly logger = new Logger(ListingService.name);
  private readonly userAgent =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36';

  async scrapeApartmentData(url: string, user: User): Promise<ScrapedData> {
    this.logger.log(`Processing apartment data request from: ${url}`);

    const { data: existingListing, error: fetchError } =
      await this.supabaseClient
        .from('listings')
        .select('data')
        .eq('url', url)
        .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      this.logger.warn('Error checking for existing listing:', fetchError);
    }

    if (existingListing?.data) {
      this.logger.log(
        `Found existing data for URL: ${url}, returning cached data`,
      );
      return existingListing.data as ScrapedData;
    }

    this.logger.log(
      `No existing data found, starting to scrape apartment data from: ${url}`,
    );

    const browser = await puppeteer.launch({
      headless: true,
      args: [`--user-agent=${this.userAgent}`],
    });

    try {
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      const title = await page.title();

      this.logger.log(`Page title: ${title}`);

      const availabilityData = await this.scrapeAvailabilityData(page);

      let contactInfo: ContactInfo | undefined;
      try {
        contactInfo = await this.scrapeContactInfo(page);
        this.logger.log('Successfully scraped contact info');
      } catch (error) {
        this.logger.warn('Could not scrape contact info:', error);
      }

      let amenities: AmenitiesResult | undefined;
      try {
        amenities = await this.scrapeAmenities(page);
        this.logger.log('Successfully scraped amenities');
      } catch (error) {
        this.logger.warn('Could not scrape amenities:', error);
      }

      let feesAndPolicies: FeesPoliciesResult | undefined;
      try {
        feesAndPolicies = await this.scrapeFeesAndPolicies(page);
        this.logger.log('Successfully scraped fees and policies');
      } catch (error) {
        this.logger.warn('Could not scrape fees and policies:', error);
      }

      this.logger.log(`Scraping data for authenticated user: ${user.id}`);

      const result: ScrapedData = {
        ...availabilityData,
        contactInfo,
        amenities,
        feesAndPolicies,
      };

      // Save newly scraped data to database
      const { error: insertError } = await this.supabaseClient
        .from('listings')
        .insert({
          data: result,
          url: url,
          requested_by: user.id,
        });

      if (insertError) {
        this.logger.warn('Error saving scraped data to database:', insertError);
      }

      this.logger.log(
        'Successfully completed scraping and saving apartment data',
      );
      return result;
    } finally {
      await browser.close();
    }
  }

  private async scrapeAvailabilityData(
    page: Page,
  ): Promise<
    Omit<ScrapedData, 'contactInfo' | 'amenities' | 'feesAndPolicies'>
  > {
    return await page.evaluate(() => {
      function clean(input?: string | null): string {
        return input?.replace(/\s+/g, ' ').trim() ?? '';
      }

      const propertyName = clean(
        document.querySelector('#propertyName')?.textContent,
      );
      const propertyAddress = clean(
        document.querySelector('#propertyAddressRow')?.textContent,
      );

      const items: Array<Record<string, string>> = [];
      document
        .querySelectorAll<HTMLLIElement>('.priceBedRangeInfo li')
        .forEach((li) => {
          const label =
            clean(li.querySelector('.rentInfoLabel')?.textContent) ?? '';
          const detail =
            clean(li.querySelector('.rentInfoDetail')?.textContent) ?? '';
          if (label) {
            items.push({ [label]: detail });
          }
        });

      const modelCards = Array.from(
        document.querySelectorAll<HTMLDivElement>('.pricingGridItem'),
      ).map((card) => {
        const modelName = clean(card.querySelector('.modelName')?.textContent);
        const headlineRent = clean(
          card.querySelector('.rentLabel')?.textContent,
        );
        const availabilitySummary = clean(
          card.querySelector('.availability')?.textContent,
        );
        const details = Array.from(
          card.querySelectorAll('.detailsTextWrapper span'),
        )
          .map((s) => clean(s.textContent))
          .filter(Boolean);

        const imgDiv = card.querySelector<HTMLElement>('.floorPlanButtonImage');
        const styleBg = imgDiv?.style?.backgroundImage || '';
        const styleUrlMatch = styleBg.match(/url\(["']?(.*?)["']?\)/i);
        const dataBg = (imgDiv as HTMLElement)?.dataset?.backgroundImage;
        const image = styleUrlMatch?.[1] || dataBg || undefined;

        const units: UnitRow[] = Array.from(
          card.querySelectorAll<HTMLLIElement>(
            '.unitGridContainer ul > li.unitContainer',
          ),
        ).map((li) => {
          const unit =
            clean(li.getAttribute('data-unit')) ||
            clean(
              li.querySelector('.unitColumn .js-viewUnitDetails-modal')
                ?.textContent,
            );

          const price = clean(
            li.querySelector('.pricingColumn span:not(.screenReaderOnly)')
              ?.textContent,
          );

          const sqft = clean(
            li.querySelector('.sqftColumn span:not(.screenReaderOnly)')
              ?.textContent,
          );

          const availability = clean(
            li.querySelector('.availableColumn .dateAvailable')?.textContent,
          );

          return { unit, price, sqft, availability };
        });

        return {
          modelName,
          headlineRent,
          details,
          availabilitySummary,
          image,
          units,
          propertyAddress,
        };
      });

      return {
        propertyName,
        propertyAddress,
        bedInfo: items,
        availability: modelCards as ModelCard[],
      };
    });
  }

  private async scrapeContactInfo(page: Page): Promise<ContactInfo> {
    const viewAll = await page.$('.contactInfo .js-viewAllHours');
    if (viewAll) {
      try {
        await viewAll.click();
        await new Promise((resolve) => setTimeout(resolve, 250));
      } catch {
        // Ignore click errors
      }
    }

    return await page.evaluate(() => {
      const clean = (s?: string | null) =>
        (s ?? '').replace(/\s+/g, ' ').trim();

      const root = document.querySelector('.contactInfo');
      if (!root) return { officeHours: [] } as ContactInfo;

      // Phone
      const phoneBtn = root.querySelector<HTMLButtonElement>(
        '.propertyPhone.js-propertyPhoneNumber',
      );
      const phoneDigits = phoneBtn?.getAttribute('phone-data') || undefined;
      const phoneFormatted = clean(
        phoneBtn?.querySelector('span')?.textContent || '',
      );

      // Website
      const webA = root.querySelector<HTMLAnchorElement>(
        '.propertyWebsiteLink.js-externalUrl',
      );
      const website = webA
        ? { url: webA.href, label: clean(webA.textContent || '') }
        : undefined;

      // Language
      const language =
        clean(
          root
            .querySelector('.languages span')
            ?.textContent?.replace(/^Language:\s*/i, '') || '',
        ) || undefined;

      // Today's hours
      const todaysHours =
        clean(root.querySelector('.todaysHours span')?.textContent || '') ||
        undefined;

      // Office hours list
      const officeHours: OfficeHour[] = Array.from(
        root.querySelectorAll('.officeHoursContainer .daysHoursContainer'),
      ).map((li) => {
        const days = clean(li.querySelector('.days')?.textContent || '');
        const hours = clean(li.querySelector('.hours')?.textContent || '');
        return { days, hours };
      });

      // Logo
      const logoImg = root.querySelector<HTMLImageElement>('img.logo');
      const logo = logoImg
        ? {
            url: logoImg.src,
            alt: clean(logoImg.alt || ''),
            width: logoImg.width || undefined,
            height: logoImg.height || undefined,
          }
        : undefined;

      const phone =
        phoneDigits || phoneFormatted
          ? { formatted: phoneFormatted || undefined, digits: phoneDigits }
          : undefined;

      return {
        phone,
        website,
        language,
        todaysHours,
        officeHours,
        logo,
      } as ContactInfo;
    });
  }

  private async scrapeAmenities(page: Page): Promise<AmenitiesResult> {
    await page.evaluate(() => window.scrollBy(0, 1200));
    await new Promise((resolve) => setTimeout(resolve, 200));

    const amenities: AmenitiesResult = await page.evaluate(() => {
      const clean = (s?: string | null) =>
        (s ?? '').replace(/\s+/g, ' ').trim();
      const uniq = (arr: string[]) => Array.from(new Set(arr.filter(Boolean)));

      const parseSectionByTitle = (
        sectionTitleText: string,
      ): AmenitySection | undefined => {
        const titleEl = Array.from(
          document.querySelectorAll<HTMLHeadingElement>('h3.sectionTitle'),
        ).find(
          (h) =>
            clean(h.textContent).toLowerCase() ===
            sectionTitleText.toLowerCase(),
        );
        if (!titleEl) return undefined;

        const container = titleEl.parentElement;
        if (!container) return undefined;

        const icons = Array.from(
          container.querySelectorAll(
            '.amenitiesIconGridContainer .amenityCard .amenityLabel',
          ),
        ).map((n) => clean(n.textContent || ''));

        const groups: AmenityGroup[] = [];
        container.querySelectorAll('.spec .specGroup').forEach((group) => {
          const header = clean(
            group.querySelector('.specGroupName')?.textContent || '',
          );
          const items = Array.from(
            group.querySelectorAll('.subSpec li.specInfo > span'),
          ).map((s) => clean(s.textContent || ''));
          if (header || items.length)
            groups.push({ header, items: uniq(items) });
        });

        return {
          title: clean(titleEl.textContent || sectionTitleText),
          icons: uniq(icons),
          groups,
        };
      };

      const community = parseSectionByTitle('Community Amenities');
      const apartment = parseSectionByTitle('Apartment Features');

      return { community, apartment };
    });

    const dedupe = <T>(arr: T[]) => Array.from(new Set(arr));
    if (amenities.community) {
      amenities.community.icons = dedupe(amenities.community.icons);
      amenities.community.groups = amenities.community.groups.map((g) => ({
        ...g,
        items: dedupe(g.items),
      }));
    }
    if (amenities.apartment) {
      amenities.apartment.icons = dedupe(amenities.apartment.icons);
      amenities.apartment.groups = amenities.apartment.groups.map((g) => ({
        ...g,
        items: dedupe(g.items),
      }));
    }

    return amenities;
  }

  private async scrapeFeesAndPolicies(page: Page): Promise<FeesPoliciesResult> {
    await page.evaluate(() => window.scrollBy(0, 1200));

    // Click fees toggle if available
    const feesToggle = await page.$('#allInPrice, .js-allInPrice');
    if (feesToggle) {
      await feesToggle.click();
      await new Promise((resolve) => setTimeout(resolve, 400));
    }

    const data: FeesPoliciesResult = await page.evaluate(() => {
      const clean = (s?: string | null) =>
        (s ?? '').replace(/\s+/g, ' ').trim();

      const getTooltipText = (container: Element | null) => {
        const tt = container?.querySelector(
          ".mortar-tooltip-text [role='tooltip']",
        );
        return clean(tt?.textContent || '');
      };

      const parseCard = (cardEl: Element): Card => {
        const header =
          clean(cardEl.querySelector('.header-column')?.textContent) ||
          clean(
            cardEl.querySelector('.component-header .header-column')
              ?.textContent,
          ) ||
          '';

        const rows: Row[] = [];
        cardEl
          .querySelectorAll(':scope .component-body .component-list > li')
          .forEach((li) => {
            const isHeader = li.querySelector('.header-column');
            const isComment =
              li.classList.contains('no-border') ||
              li.querySelector('.comments');
            if (isHeader) return;

            if (isComment) return;

            const left = li.querySelector(
              '.component-row .feeName, .component-row .column',
            );
            const right = li.querySelector('.component-row .column-right');
            const tooltip = getTooltipText(li);

            const name = clean(left?.textContent || '');
            const value = clean(right?.textContent || '');
            if (name || value)
              rows.push({ name, value, tooltip: tooltip || undefined });
          });

        const comments =
          clean(cardEl.querySelector('.comments')?.textContent || '') || null;

        return { header, rows, comments };
      };

      const parseTabPanel = (panelEl: Element, tabName: string): TabResult => {
        const cards: Card[] = [];
        panelEl.querySelectorAll('.feesPoliciesCard').forEach((card) => {
          cards.push(parseCard(card));
        });
        const filtered = cards.filter(
          (c) => c.header || c.rows.length || (c.comments && c.comments.length),
        );
        return { tab: tabName, cards: filtered };
      };

      const parseDetails = (): DetailsCard[] => {
        const detailCards: DetailsCard[] = [];
        document
          .querySelectorAll(
            '.detailsContainer .feesPoliciesCard.with-bullets-card',
          )
          .forEach((card) => {
            const header = clean(
              card.querySelector('.component-header .header-column')
                ?.textContent,
            );
            const items: string[] = [];
            card
              .querySelectorAll(
                '.component-body .component-list .with-bullets .column',
              )
              .forEach((c) => {
                const text = clean(c.textContent || '');
                if (text) items.push(text);
              });
            if (header || items.length) detailCards.push({ header, items });
          });
        return detailCards;
      };

      const tabs: TabResult[] = [];
      const tabNav =
        document.querySelector('.feesPoliciesTabContainer .tabs-nav') ||
        document.querySelector('#tabWrapper.tabs-nav');
      const tabButtons = tabNav
        ? Array.from(tabNav.querySelectorAll("button[role='tab']"))
        : [];

      if (tabButtons.length) {
        for (const btn of tabButtons) {
          (btn as HTMLButtonElement).click();
          const panelId = btn.getAttribute('aria-controls') || '';
          const tabName = clean(btn.textContent || btn.id || panelId);
          const panel = panelId ? document.getElementById(panelId) : null;
          if (panel) {
            panel.removeAttribute('hidden');
            tabs.push(parseTabPanel(panel, tabName));
          }
        }
      } else {
        // Fallback for different tab structures
        const petsPanel = document.querySelector('#fees-policies-pets-tab');
        const parkingPanel = document.querySelector(
          '#fees-policies-parking-tab',
        );
        const reqPanel = document.querySelector(
          '#fees-policies-required-fees-tab',
        );
        const storagePanel = document.querySelector(
          '#fees-policies-storage-tab',
        );

        if (petsPanel) tabs.push(parseTabPanel(petsPanel, 'Pets'));
        if (parkingPanel) tabs.push(parseTabPanel(parkingPanel, 'Parking'));
        if (reqPanel) tabs.push(parseTabPanel(reqPanel, 'Required Fees'));
        if (storagePanel) tabs.push(parseTabPanel(storagePanel, 'Storage'));

        if (!tabs.length) {
          document
            .querySelectorAll("#pricingView [role='tabpanel']")
            .forEach((panel) => {
              const labelId = panel.getAttribute('aria-labelledby') || '';
              const label =
                clean(
                  document.getElementById(labelId || '')?.textContent || '',
                ) || clean(panel.id || '');
              tabs.push(parseTabPanel(panel, label || 'Fees/Policies'));
            });
        }
      }

      const details = parseDetails();

      return { tabs, details };
    });

    return data;
  }
}
