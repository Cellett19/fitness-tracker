export type Meal = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snacks';

export type Food = {
  id: string;
  name: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
};

export type FoodLog = {
  id: string;
  foodId: string;
  date: string;
  meal: Meal;
  quantityGrams: number;
};