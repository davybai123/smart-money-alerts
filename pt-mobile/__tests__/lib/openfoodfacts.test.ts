import { fetchProductByBarcode, searchFood } from '../../lib/openfoodfacts';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

const validProductResponse = {
  status: 1,
  code: '1234567890123',
  product: {
    product_name: 'Test Chicken Breast',
    brands: 'Test Brand',
    nutriments: {
      'energy-kcal_100g': 165,
      proteins_100g: 31,
      carbohydrates_100g: 0,
      fat_100g: 3.6,
      fiber_100g: 0,
      sugars_100g: 0,
      salt_100g: 0.1,
    },
    serving_size: '100g',
    serving_quantity: 100,
  },
};

const productWithServing = {
  status: 1,
  code: '9876543210987',
  product: {
    product_name: 'Protein Bar',
    brands: 'Protein Co',
    nutriments: {
      'energy-kcal_100g': 400,
      proteins_100g: 30,
      carbohydrates_100g: 40,
      fat_100g: 10,
      fiber_100g: 5,
    },
    serving_quantity: 60,
  },
};

describe('fetchProductByBarcode', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  it('returns a FoodItem for a valid barcode', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => validProductResponse,
    });

    const result = await fetchProductByBarcode('1234567890123');

    expect(result).not.toBeNull();
    expect(result?.name).toBe('Test Chicken Breast');
    expect(result?.brand).toBe('Test Brand');
    expect(result?.barcode).toBe('1234567890123');
    expect(result?.calories).toBe(165);
    expect(result?.protein).toBe(31);
    expect(result?.carbs).toBe(0);
    expect(result?.fat).toBe(3.6);
    expect(result?.serving_size).toBe(100);
    expect(result?.serving_unit).toBe('g');
  });

  it('scales macros correctly for non-100g serving size', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => productWithServing,
    });

    const result = await fetchProductByBarcode('9876543210987');

    // serving is 60g, factor = 0.6
    expect(result?.calories).toBe(240); // 400 * 0.6 = 240
    expect(result?.protein).toBe(18); // 30 * 0.6 = 18
    expect(result?.carbs).toBe(24); // 40 * 0.6 = 24
    expect(result?.fat).toBe(6); // 10 * 0.6 = 6
    expect(result?.serving_size).toBe(60);
  });

  it('returns null when product status is 0 (not found)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 0, product: null }),
    });

    const result = await fetchProductByBarcode('0000000000000');
    expect(result).toBeNull();
  });

  it('returns null when fetch fails with non-OK response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });

    const result = await fetchProductByBarcode('badbarcode');
    expect(result).toBeNull();
  });

  it('returns null and does not throw on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const result = await fetchProductByBarcode('1234567890123');
    expect(result).toBeNull();
  });

  it('uses correct API URL format', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => validProductResponse,
    });

    await fetchProductByBarcode('1234567890123');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('world.openfoodfacts.org/api/v2/product/1234567890123'),
      expect.objectContaining({
        headers: expect.objectContaining({ 'User-Agent': expect.stringContaining('PTApp') }),
      })
    );
  });

  it('handles missing nutriments gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 1,
        product: {
          product_name: 'Sparse Product',
          nutriments: {
            'energy-kcal_100g': 100,
            proteins_100g: 5,
            carbohydrates_100g: 15,
            fat_100g: 2,
          },
        },
      }),
    });

    const result = await fetchProductByBarcode('1111111111111');
    expect(result).not.toBeNull();
    expect(result?.fiber).toBeUndefined();
    expect(result?.sugar).toBeUndefined();
    expect(result?.salt).toBeUndefined();
  });
});

describe('searchFood', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  it('returns array of FoodItems for valid search', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        products: [
          {
            code: 'aaa111',
            product_name: 'Oats',
            brands: 'Oatly',
            nutriments: {
              'energy-kcal_100g': 370,
              proteins_100g: 13,
              carbohydrates_100g: 58,
              fat_100g: 7,
            },
            serving_quantity: 40,
          },
          {
            code: 'bbb222',
            product_name: 'Oatmeal Cookies',
            brands: null,
            nutriments: {
              'energy-kcal_100g': 450,
              proteins_100g: 6,
              carbohydrates_100g: 65,
              fat_100g: 18,
            },
          },
        ],
      }),
    });

    const results = await searchFood('oats');

    expect(results).toHaveLength(2);
    expect(results[0].name).toBe('Oats');
    expect(results[0].brand).toBe('Oatly');
    // 370 * 0.4 = 148
    expect(results[0].calories).toBe(148);
    expect(results[1].name).toBe('Oatmeal Cookies');
  });

  it('returns empty array on API error', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });

    const results = await searchFood('something');
    expect(results).toEqual([]);
  });

  it('returns empty array on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const results = await searchFood('chicken');
    expect(results).toEqual([]);
  });

  it('filters out products without a name', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        products: [
          {
            code: 'ccc333',
            product_name: null,
            nutriments: { 'energy-kcal_100g': 100, proteins_100g: 5, carbohydrates_100g: 15, fat_100g: 2 },
          },
          {
            code: 'ddd444',
            product_name: 'Valid Product',
            nutriments: { 'energy-kcal_100g': 200, proteins_100g: 10, carbohydrates_100g: 30, fat_100g: 5 },
          },
        ],
      }),
    });

    const results = await searchFood('test');
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Valid Product');
  });

  it('filters out products without calorie data', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        products: [
          {
            code: 'eee555',
            product_name: 'No Calories Product',
            nutriments: { proteins_100g: 5, carbohydrates_100g: 15, fat_100g: 2 },
          },
        ],
      }),
    });

    const results = await searchFood('test');
    expect(results).toHaveLength(0);
  });

  it('encodes search query properly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ products: [] }),
    });

    await searchFood('chicken breast');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('chicken%20breast'),
      expect.any(Object)
    );
  });

  it('respects the limit parameter', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ products: [] }),
    });

    await searchFood('protein', 5);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('page_size=5'),
      expect.any(Object)
    );
  });
});
