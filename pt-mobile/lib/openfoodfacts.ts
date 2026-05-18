import { FoodItem, OpenFoodFactsProduct } from '@/types';

const BASE_URL = 'https://world.openfoodfacts.org/api/v2';
const USER_AGENT = 'PTApp/1.0 (pt-mobile; contact@monsers-gym.com)';

export async function fetchProductByBarcode(barcode: string): Promise<FoodItem | null> {
  try {
    const response = await fetch(
      `${BASE_URL}/product/${barcode}?fields=product_name,brands,nutriments,serving_size,serving_quantity`,
      {
        headers: { 'User-Agent': USER_AGENT },
      }
    );

    if (!response.ok) return null;

    const data: OpenFoodFactsProduct = await response.json();

    if (data.status !== 1 || !data.product) return null;

    const { product } = data;
    const n = product.nutriments;

    const servingSize = product.serving_quantity || 100;
    const factor = servingSize / 100;

    return {
      name: product.product_name || 'Unknown Product',
      brand: product.brands,
      barcode,
      calories: Math.round((n['energy-kcal_100g'] || 0) * factor),
      protein: Math.round((n.proteins_100g || 0) * factor * 10) / 10,
      carbs: Math.round((n.carbohydrates_100g || 0) * factor * 10) / 10,
      fat: Math.round((n.fat_100g || 0) * factor * 10) / 10,
      fiber: n.fiber_100g ? Math.round(n.fiber_100g * factor * 10) / 10 : undefined,
      sugar: n.sugars_100g ? Math.round(n.sugars_100g * factor * 10) / 10 : undefined,
      salt: n.salt_100g ? Math.round(n.salt_100g * factor * 10) / 10 : undefined,
      serving_size: servingSize,
      serving_unit: 'g',
    };
  } catch (error) {
    console.error('OpenFoodFacts error:', error);
    return null;
  }
}

export async function searchFood(query: string, limit = 20): Promise<FoodItem[]> {
  try {
    const response = await fetch(
      `${BASE_URL}/search?search_terms=${encodeURIComponent(query)}&page_size=${limit}&fields=code,product_name,brands,nutriments,serving_quantity`,
      { headers: { 'User-Agent': USER_AGENT } }
    );

    if (!response.ok) return [];

    const data = await response.json();
    const products = data.products || [];

    return products
      .filter((p: any) => p.product_name && p.nutriments?.['energy-kcal_100g'])
      .map((p: any): FoodItem => {
        const n = p.nutriments;
        const servingSize = p.serving_quantity || 100;
        const factor = servingSize / 100;
        return {
          name: p.product_name,
          brand: p.brands,
          barcode: p.code,
          calories: Math.round((n['energy-kcal_100g'] || 0) * factor),
          protein: Math.round((n.proteins_100g || 0) * factor * 10) / 10,
          carbs: Math.round((n.carbohydrates_100g || 0) * factor * 10) / 10,
          fat: Math.round((n.fat_100g || 0) * factor * 10) / 10,
          serving_size: servingSize,
          serving_unit: 'g',
        };
      });
  } catch (error) {
    console.error('OpenFoodFacts search error:', error);
    return [];
  }
}
