export interface PdfGenerationDto {
  full_name: string;
  date_of_birth: string;
  gender: string;
  phone: string;
  email: string;
  profile_address: string;
  profile_created_at: string;
  profile_updated_at: string;
  listing_id: string;
  listing_address: string;
  contact_email: string;
  contact_phone: string;
  contact_other: string;
  source_link: string;
  price_rent: string;
  housing_type: string;
  lease_type: string;
  upfront_fees: string;
  utilities: string;
  credit_score_min: string;
  minimum_income: string;
  references_required: string;
  bedrooms: string;
  bathrooms: string;
  square_footage: string;
  layout_description: string;
  amenities: string;
  pet_policy: string;
  furnishing: string;
  listing_notes: string;
  listing_created_at: string;
  listing_updated_at: string;
}

export interface PdfGenerationResponseDto {
  success: boolean;
  error?: string;
  filename?: string;
  fileSize?: number;
  generatedAt?: string;
}

export interface TemplateData {
  FULL_NAME: string;
  DATE_OF_BIRTH: string;
  GENDER: string;
  PHONE: string;
  EMAIL: string;
  PROFILE_ADDRESS: string;
  PROFILE_CREATED_AT: string;
  PROFILE_UPDATED_AT: string;
  LISTING_ID: string;
  LISTING_ADDRESS: string;
  CONTACT_EMAIL: string;
  CONTACT_PHONE: string;
  CONTACT_OTHER: string;
  SOURCE_LINK: string;
  PRICE_RENT: string;
  HOUSING_TYPE: string;
  LEASE_TYPE: string;
  UPFRONT_FEES: string;
  UTILITIES: string;
  CREDIT_SCORE_MIN: string;
  MINIMUM_INCOME: string;
  REFERENCES_REQUIRED: string;
  BEDROOMS: string;
  BATHROOMS: string;
  SQUARE_FOOTAGE: string;
  LAYOUT_DESCRIPTION: string;
  AMENITIES: string;
  PET_POLICY: string;
  FURNISHING: string;
  LISTING_NOTES: string;
  LISTING_CREATED_AT: string;
  LISTING_UPDATED_AT: string;
}

export interface PdfMergeRequestDto {
  basePdf: Express.Multer.File;
  additionalPdfs: Express.Multer.File[];
  headers?: string[];
}

export interface PdfHeaderOptions {
  text: string;
  fontSize?: number;
  color?: string;
  position?: {
    x: number;
    y: number;
  };
}

export interface PdfMergeResponseDto {
  success: boolean;
  error?: string;
  filename?: string;
  fileSize?: number;
  mergedAt?: string;
  totalPages?: number;
  sourceFileCount?: number;
}
