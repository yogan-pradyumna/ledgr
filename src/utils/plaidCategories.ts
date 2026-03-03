import type { Category } from '../types';

// Maps Plaid's personal_finance_category.primary to our 20 categories
const PLAID_PRIMARY_MAP: Record<string, Category> = {
  FOOD_AND_DRINK:           'Food',
  TRAVEL:                   'Travel',
  TRANSPORTATION:           'Commute/Car',
  GENERAL_MERCHANDISE:      'Household',
  HOME_IMPROVEMENT:         'Household',
  RENT_AND_UTILITIES:       'Utilities',
  MEDICAL:                  'Health',
  PERSONAL_CARE:            'Health',
  ENTERTAINMENT:            'Entertainment',
  GENERAL_SERVICES:         'Other',
  GOVERNMENT_AND_NON_PROFIT:'Other',
  INCOME:                   'Other',
  TRANSFER_IN:              'Other',
  TRANSFER_OUT:             'Other',
  LOAN_PAYMENTS:            'Other',
  BANK_FEES:                'Other',
};

// More specific overrides using Plaid's detailed category
const PLAID_DETAILED_MAP: Record<string, Category> = {
  FOOD_AND_DRINK_GROCERIES:                        'Groceries',
  FOOD_AND_DRINK_RESTAURANT:                       'Food',
  FOOD_AND_DRINK_FAST_FOOD:                        'Food',
  FOOD_AND_DRINK_COFFEE:                           'Food',
  GENERAL_MERCHANDISE_SUPERSTORES:                 'Groceries',
  GENERAL_MERCHANDISE_CLOTHING_AND_ACCESSORIES:    'Apparel',
  GENERAL_MERCHANDISE_SPORTING_GOODS:              'Sports',
  ENTERTAINMENT_MUSIC_AND_AUDIO:                   'OTT/Streaming Fees',
  ENTERTAINMENT_TV_AND_MOVIES:                     'OTT/Streaming Fees',
  ENTERTAINMENT_SPORTING_EVENTS_AMUSEMENT_PARKS:   'Entertainment',
  RENT_AND_UTILITIES_RENT:                         'Rent',
  RENT_AND_UTILITIES_INTERNET_AND_CABLE:           'Internet',
  RENT_AND_UTILITIES_TELEPHONE:                    'Mobile',
  RENT_AND_UTILITIES_GAS_AND_ELECTRICITY:          'Utilities',
  RENT_AND_UTILITIES_WATER:                        'Utilities',
  TRANSPORTATION_GAS:                              'Commute/Car',
  TRANSPORTATION_PARKING:                          'Commute/Car',
  TRANSPORTATION_PUBLIC_TRANSIT:                   'Commute/Car',
  TRANSPORTATION_TAXIS_AND_RIDE_SHARING:           'Commute/Car',
  PERSONAL_CARE_GYMS_AND_FITNESS_CENTERS:          'Sports',
  MEDICAL_PHARMACIES_AND_SUPPLEMENTS:              'Health',
};

export function mapPlaidCategory(primary: string, detailed?: string): Category {
  if (detailed && PLAID_DETAILED_MAP[detailed]) {
    return PLAID_DETAILED_MAP[detailed];
  }
  return PLAID_PRIMARY_MAP[primary] ?? 'Other';
}
