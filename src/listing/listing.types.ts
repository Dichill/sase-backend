export interface UnitRow {
  unit: string;
  price: string;
  sqft: string;
  availability: string;
}

export interface ModelCard {
  modelName: string;
  headlineRent: string;
  details: string[];
  availabilitySummary: string;
  image?: string;
  units: UnitRow[];
  propertyAddress: string;
}

export interface Row {
  name: string;
  value: string;
  tooltip?: string;
}

export interface Card {
  header: string;
  rows: Row[];
  comments?: string | null;
}

export interface TabResult {
  tab: string;
  cards: Card[];
}

export interface DetailsCard {
  header: string;
  items: string[];
}

export interface FeesPoliciesResult {
  tabs: TabResult[];
  details: DetailsCard[];
}

export interface AmenityGroup {
  header: string;
  items: string[];
}

export interface AmenitySection {
  title: string;
  icons: string[];
  groups: AmenityGroup[];
}

export interface AmenitiesResult {
  community?: AmenitySection;
  apartment?: AmenitySection;
}

export interface OfficeHour {
  days: string;
  hours: string;
}

export interface ContactInfo {
  phone?: {
    formatted?: string;
    digits?: string;
  };
  website?: {
    url?: string;
    label?: string;
  };
  language?: string;
  todaysHours?: string;
  officeHours: OfficeHour[];
  logo?: {
    url?: string;
    alt?: string;
    width?: number;
    height?: number;
  };
}

export interface ScrapedData {
  propertyName: string;
  propertyAddress: string;
  bedInfo: Record<string, string>[];
  availability: ModelCard[];
  feesAndPolicies?: FeesPoliciesResult;
  amenities?: AmenitiesResult;
  contactInfo?: ContactInfo;
}

export interface ScrapeApartmentDto {
  url: string;
}

export interface ScrapeApartmentResponseDto {
  success: boolean;
  data?: ScrapedData;
  error?: string;
}
