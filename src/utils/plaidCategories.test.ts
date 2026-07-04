import { describe, it, expect } from 'vitest';
import { mapPlaidCategory } from './plaidCategories';

describe('mapPlaidCategory', () => {
  it('returns Other for unknown primary with no detailed category', () => {
    expect(mapPlaidCategory('UNKNOWN_PRIMARY')).toBe('Other');
  });

  it('maps known primary category without detailed', () => {
    expect(mapPlaidCategory('FOOD_AND_DRINK')).toBe('Food');
    expect(mapPlaidCategory('TRAVEL')).toBe('Travel');
    expect(mapPlaidCategory('TRANSPORTATION')).toBe('Commute/Car');
    expect(mapPlaidCategory('MEDICAL')).toBe('Health');
    expect(mapPlaidCategory('ENTERTAINMENT')).toBe('Entertainment');
  });

  it('detailed category overrides primary', () => {
    expect(mapPlaidCategory('FOOD_AND_DRINK', 'FOOD_AND_DRINK_GROCERIES')).toBe('Groceries');
    expect(mapPlaidCategory('FOOD_AND_DRINK', 'FOOD_AND_DRINK_RESTAURANT')).toBe('Food');
  });

  it('maps streaming/TV to OTT/Streaming Fees via detailed', () => {
    expect(mapPlaidCategory('ENTERTAINMENT', 'ENTERTAINMENT_MUSIC_AND_AUDIO')).toBe('OTT/Streaming Fees');
    expect(mapPlaidCategory('ENTERTAINMENT', 'ENTERTAINMENT_TV_AND_MOVIES')).toBe('OTT/Streaming Fees');
  });

  it('maps rent and utilities sub-categories correctly', () => {
    expect(mapPlaidCategory('RENT_AND_UTILITIES', 'RENT_AND_UTILITIES_RENT')).toBe('Rent');
    expect(mapPlaidCategory('RENT_AND_UTILITIES', 'RENT_AND_UTILITIES_INTERNET_AND_CABLE')).toBe('Internet');
    expect(mapPlaidCategory('RENT_AND_UTILITIES', 'RENT_AND_UTILITIES_TELEPHONE')).toBe('Mobile');
    expect(mapPlaidCategory('RENT_AND_UTILITIES', 'RENT_AND_UTILITIES_GAS_AND_ELECTRICITY')).toBe('Utilities');
  });

  it('maps transportation sub-categories correctly', () => {
    expect(mapPlaidCategory('TRANSPORTATION', 'TRANSPORTATION_TAXIS_AND_RIDE_SHARING')).toBe('Commute/Car');
    expect(mapPlaidCategory('TRANSPORTATION', 'TRANSPORTATION_GAS')).toBe('Commute/Car');
  });

  it('maps apparel via detailed merchandise category', () => {
    expect(mapPlaidCategory('GENERAL_MERCHANDISE', 'GENERAL_MERCHANDISE_CLOTHING_AND_ACCESSORIES')).toBe('Apparel');
  });

  it('maps sporting goods and gyms to Sports', () => {
    expect(mapPlaidCategory('GENERAL_MERCHANDISE', 'GENERAL_MERCHANDISE_SPORTING_GOODS')).toBe('Sports');
    expect(mapPlaidCategory('PERSONAL_CARE', 'PERSONAL_CARE_GYMS_AND_FITNESS_CENTERS')).toBe('Sports');
  });

  it('falls back to primary when detailed is unrecognized', () => {
    expect(mapPlaidCategory('FOOD_AND_DRINK', 'FOOD_AND_DRINK_UNKNOWN')).toBe('Food');
  });

  it('maps grocery superstores via detailed', () => {
    expect(mapPlaidCategory('GENERAL_MERCHANDISE', 'GENERAL_MERCHANDISE_SUPERSTORES')).toBe('Groceries');
  });
});
