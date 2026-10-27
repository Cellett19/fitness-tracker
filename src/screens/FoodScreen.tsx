import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../services/supabase';

const BG = '#111111';
const CARD = '#1B1B1B';
const CARD_LIGHT = '#242424';
const GREEN = '#72D6A0';
const MUTED = '#999999';
const BORDER = '#303030';

type Meal = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snacks';
type PortionMode = 'grams' | 'servings' | 'items';

type Food = {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  defaultUnitWeightG?: number;
  unitName?: string;
  servingWeightG?: number;
  servingName?: string;
  source?: string;
};

type FoodLog = {
  id: string;
  food_id: string;
  food_name: string;
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  quantity_grams: number;
  quantity_label?: string | null;
  recipe_id?: string | null;
  date: string;
  meal: Meal;
  created_at: string;
};

type Recipe = {
  id: string;
  name: string;
  servings: number;
  total_weight_grams: number | null;
  created_at?: string;
  updated_at?: string;
};

type RecipeIngredient = {
  id?: string;
  food_name: string;
  quantity_grams: number;
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
};

type RecipeWithNutrition = Recipe & {
  ingredients: RecipeIngredient[];
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  calculatedWeight: number;
};

const MEALS: Meal[] = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];

const AUSTRALIAN_FOODS: Food[] = [
  {
    id: 'au:egg',
    name: 'Egg, whole, raw',
    calories: 143,
    protein: 12.6,
    carbs: 0.7,
    fat: 9.5,
    defaultUnitWeightG: 55,
    unitName: 'egg',
  },
  {
    id: 'au:banana',
    name: 'Banana',
    calories: 89,
    protein: 1.1,
    carbs: 22.8,
    fat: 0.3,
    defaultUnitWeightG: 120,
    unitName: 'banana',
  },
  {
    id: 'au:oats',
    name: 'Rolled oats, dry',
    calories: 379,
    protein: 13.2,
    carbs: 67.7,
    fat: 6.5,
    servingWeightG: 40,
    servingName: 'serve',
  },
  {
    id: 'au:chicken',
    name: 'Chicken breast, skinless, raw',
    calories: 120,
    protein: 22.5,
    carbs: 0,
    fat: 2.6,
  },
  {
    id: 'au:rice',
    name: 'White rice, cooked',
    calories: 130,
    protein: 2.7,
    carbs: 28.2,
    fat: 0.3,
    servingWeightG: 150,
    servingName: 'cup',
  },
  {
    id: 'au:milk',
    name: 'Full cream milk',
    calories: 64,
    protein: 3.3,
    carbs: 4.8,
    fat: 3.5,
    servingWeightG: 250,
    servingName: 'cup',
  },
  {
    id: 'au:bread',
    name: 'White bread',
    calories: 266,
    protein: 8.9,
    carbs: 49.4,
    fat: 3.3,
    defaultUnitWeightG: 30,
    unitName: 'slice',
  },
  {
    id: 'au:potato',
    name: 'Potato, boiled',
    calories: 87,
    protein: 1.9,
    carbs: 20.1,
    fat: 0.1,
  },
  {
    id: 'au:beef',
    name: 'Beef mince, regular, raw',
    calories: 250,
    protein: 17.2,
    carbs: 0,
    fat: 20,
  },
  {
    id: 'au:greek-yoghurt',
    name: 'Greek yoghurt, plain',
    calories: 97,
    protein: 9,
    carbs: 3.9,
    fat: 5,
    servingWeightG: 170,
    servingName: 'tub',
  },
  {
    id: 'au:apple',
    name: 'Apple, with skin',
    calories: 52,
    protein: 0.3,
    carbs: 13.8,
    fat: 0.2,
    defaultUnitWeightG: 180,
    unitName: 'apple',
  },
  {
    id: 'au:avocado',
    name: 'Avocado',
    calories: 160,
    protein: 2,
    carbs: 8.5,
    fat: 14.7,
  },
];

const todayString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const shiftDate = (date: string, days: number) => {
  const [year, month, day] = date.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const numberValue = (value: unknown, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const round = (value: number, decimals = 1) =>
  Number(value.toFixed(decimals));

const formatDate = (date: string) => {
  if (date === todayString()) return 'Today';
  if (date === shiftDate(todayString(), -1)) return 'Yesterday';

  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const nutritionForGrams = (
  food: Pick<Food, 'calories' | 'protein' | 'carbs' | 'fat'>,
  grams: number,
) => ({
  calories: (food.calories * grams) / 100,
  protein: (food.protein * grams) / 100,
  carbs: (food.carbs * grams) / 100,
  fat: (food.fat * grams) / 100,
});

const logNutrition = (log: FoodLog) => {
  const ratio = numberValue(log.quantity_grams) / 100;

  return {
    calories: numberValue(log.calories_per_100g) * ratio,
    protein: numberValue(log.protein_per_100g) * ratio,
    carbs: numberValue(log.carbs_per_100g) * ratio,
    fat: numberValue(log.fat_per_100g) * ratio,
  };
};

const recipeNutrition = (ingredients: RecipeIngredient[]) => {
  const totals = ingredients.reduce(
    (acc, ingredient) => {
      const nutrition = nutritionForGrams(
        {
          calories: ingredient.calories_per_100g,
          protein: ingredient.protein_per_100g,
          carbs: ingredient.carbs_per_100g,
          fat: ingredient.fat_per_100g,
        },
        ingredient.quantity_grams,
      );

      return {
        calories: acc.calories + nutrition.calories,
        protein: acc.protein + nutrition.protein,
        carbs: acc.carbs + nutrition.carbs,
        fat: acc.fat + nutrition.fat,
      };
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );

  return totals;
};

export default function FoodScreen() {
  const [selectedDate, setSelectedDate] = useState(todayString());
  const [logs, setLogs] = useState<FoodLog[]>([]);
  const [foods, setFoods] = useState<Food[]>([]);
  const [recipes, setRecipes] = useState<RecipeWithNutrition[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searching, setSearching] = useState(false);
  const [databaseResults, setDatabaseResults] = useState<Food[]>([]);
  const [searchText, setSearchText] = useState('');
  const [searchWarning, setSearchWarning] = useState('');

  const [showFoodModal, setShowFoodModal] = useState(false);
  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const [showRecipePicker, setShowRecipePicker] = useState(false);
  const [editingLog, setEditingLog] = useState<FoodLog | null>(null);
  const [editingRecipeId, setEditingRecipeId] = useState<string | null>(null);

  const [foodName, setFoodName] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [portionMode, setPortionMode] = useState<PortionMode>('grams');
  const [quantity, setQuantity] = useState('100');
  const [itemWeight, setItemWeight] = useState('50');
  const [itemName, setItemName] = useState('item');
  const [servingWeight, setServingWeight] = useState('100');
  const [servingName, setServingName] = useState('serving');
  const [selectedMeal, setSelectedMeal] = useState<Meal>('Breakfast');
  const [saveFoodToLibrary, setSaveFoodToLibrary] = useState(false);
  const [activeFood, setActiveFood] = useState<Food | null>(null);

  const [recipeName, setRecipeName] = useState('');
  const [recipeServings, setRecipeServings] = useState('2');
  const [recipeCookedWeight, setRecipeCookedWeight] = useState('');
  const [recipeIngredients, setRecipeIngredients] = useState<RecipeIngredient[]>([]);
  const [ingredientSearch, setIngredientSearch] = useState('');
  const [ingredientQuantity, setIngredientQuantity] = useState('100');
  const [addingIngredient, setAddingIngredient] = useState<Food | null>(null);
  const [recipeLog, setRecipeLog] = useState<RecipeWithNutrition | null>(null);
  const [recipePortionMode, setRecipePortionMode] = useState<'servings' | 'grams'>('servings');
  const [recipePortionQuantity, setRecipePortionQuantity] = useState('1');
  const [recipeMeal, setRecipeMeal] = useState<Meal>('Dinner');

  const loadDiary = useCallback(async () => {
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('food_logs')
        .select('*')
        .eq('date', selectedDate)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setLogs((data ?? []) as FoodLog[]);
    } catch (error) {
      Alert.alert(
        'Could not load diary',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  const loadFoods = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('user_foods')
        .select(
          'id, name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, default_unit_weight_g, unit_name, serving_weight_g, serving_name',
        )
        .order('name', { ascending: true });

      if (error) throw error;

      const savedFoods: Food[] = (data ?? []).map((row: any) => ({
        id: String(row.id),
        name: String(row.name),
        calories: numberValue(row.calories_per_100g),
        protein: numberValue(row.protein_per_100g),
        carbs: numberValue(row.carbs_per_100g),
        fat: numberValue(row.fat_per_100g),
        defaultUnitWeightG: row.default_unit_weight_g
          ? numberValue(row.default_unit_weight_g)
          : undefined,
        unitName: row.unit_name || undefined,
        servingWeightG: row.serving_weight_g
          ? numberValue(row.serving_weight_g)
          : undefined,
        servingName: row.serving_name || undefined,
        source: 'saved',
      }));

      const combined = [...savedFoods, ...AUSTRALIAN_FOODS];
      const seen = new Set<string>();

      setFoods(
        combined.filter((food) => {
          const key = food.name.trim().toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        }),
      );
    } catch (error) {
      setFoods(AUSTRALIAN_FOODS);
      console.warn('Could not load saved foods:', error);
    }
  }, []);

  const loadRecipes = useCallback(async () => {
    try {
      const { data: recipeRows, error: recipeError } = await supabase
        .from('user_recipes')
        .select('id, name, servings, total_weight_grams, created_at, updated_at')
        .order('name', { ascending: true });

      if (recipeError) throw recipeError;

      const recipeIds = (recipeRows ?? []).map((r: any) => r.id);
      let ingredientRows: any[] = [];

      if (recipeIds.length > 0) {
        const { data, error } = await supabase
          .from('recipe_ingredients')
          .select('*')
          .in('recipe_id', recipeIds);

        if (error) throw error;
        ingredientRows = data ?? [];
      }

      const loadedRecipes: RecipeWithNutrition[] = (recipeRows ?? []).map(
        (row: any) => {
          const ingredients: RecipeIngredient[] = ingredientRows
            .filter((ingredient) => ingredient.recipe_id === row.id)
            .map((ingredient) => ({
              id: ingredient.id,
              food_name: String(ingredient.food_name),
              quantity_grams: numberValue(ingredient.quantity_grams),
              calories_per_100g: numberValue(ingredient.calories_per_100g),
              protein_per_100g: numberValue(ingredient.protein_per_100g),
              carbs_per_100g: numberValue(ingredient.carbs_per_100g),
              fat_per_100g: numberValue(ingredient.fat_per_100g),
            }));

          const nutrition = recipeNutrition(ingredients);
          const calculatedWeight = ingredients.reduce(
            (sum, ingredient) => sum + ingredient.quantity_grams,
            0,
          );

          return {
            id: String(row.id),
            name: String(row.name),
            servings: numberValue(row.servings, 1),
            total_weight_grams: row.total_weight_grams
              ? numberValue(row.total_weight_grams)
              : null,
            created_at: row.created_at,
            updated_at: row.updated_at,
            ingredients,
            ...nutrition,
            calculatedWeight,
          };
        },
      );

      setRecipes(loadedRecipes);
    } catch (error) {
      Alert.alert(
        'Could not load recipes',
        error instanceof Error ? error.message : 'Please try again.',
      );
    }
  }, []);

  useEffect(() => {
    void Promise.all([loadDiary(), loadFoods(), loadRecipes()]);
  }, [loadDiary, loadFoods, loadRecipes]);

  const totals = useMemo(
    () =>
      logs.reduce(
        (acc, log) => {
          const n = logNutrition(log);
          return {
            calories: acc.calories + n.calories,
            protein: acc.protein + n.protein,
            carbs: acc.carbs + n.carbs,
            fat: acc.fat + n.fat,
          };
        },
        { calories: 0, protein: 0, carbs: 0, fat: 0 },
      ),
    [logs],
  );

  const filteredFoods = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    const source = databaseResults.length > 0 ? databaseResults : foods;

    if (!query) return source.slice(0, 50);
    return source
      .filter((food) => food.name.toLowerCase().includes(query))
      .slice(0, 50);
  }, [foods, searchText, databaseResults]);

  const filteredIngredientFoods = useMemo(() => {
    const query = ingredientSearch.trim().toLowerCase();
    if (!query) return foods.slice(0, 30);

    return foods
      .filter((food) => food.name.toLowerCase().includes(query))
      .slice(0, 30);
  }, [foods, ingredientSearch]);

  const calculateFoodGrams = () => {
    const amount = numberValue(quantity);
    if (amount <= 0) return 0;

    if (portionMode === 'items') {
      return amount * numberValue(itemWeight);
    }

    if (portionMode === 'servings') {
      return amount * numberValue(servingWeight);
    }

    return amount;
  };

  const currentFoodNutrition = useMemo(() => {
    const grams = calculateFoodGrams();

    return nutritionForGrams(
      {
        calories: numberValue(calories),
        protein: numberValue(protein),
        carbs: numberValue(carbs),
        fat: numberValue(fat),
      },
      grams,
    );
  }, [calories, protein, carbs, fat, quantity, portionMode, itemWeight, servingWeight]);

  const resetFoodForm = () => {
    setEditingLog(null);
    setActiveFood(null);
    setFoodName('');
    setCalories('');
    setProtein('');
    setCarbs('');
    setFat('');
    setQuantity('100');
    setPortionMode('grams');
    setItemWeight('50');
    setItemName('item');
    setServingWeight('100');
    setServingName('serving');
    setSelectedMeal('Breakfast');
    setSaveFoodToLibrary(false);
    setSearchText('');
    setDatabaseResults([]);
    setSearchWarning('');
  };

  const openNewFood = () => {
    resetFoodForm();
    setShowFoodModal(true);
  };

  const openFoodForLogging = (food: Food) => {
    resetFoodForm();
    setActiveFood(food);
    setFoodName(food.name);
    setCalories(String(food.calories));
    setProtein(String(food.protein));
    setCarbs(String(food.carbs));
    setFat(String(food.fat));
    setItemWeight(String(food.defaultUnitWeightG ?? 50));
    setItemName(food.unitName ?? 'item');
    setServingWeight(String(food.servingWeightG ?? 100));
    setServingName(food.servingName ?? 'serving');
    setQuantity('1');
    setPortionMode(food.defaultUnitWeightG ? 'items' : food.servingWeightG ? 'servings' : 'grams');
    setShowFoodModal(true);
  };

  const openEditLog = (log: FoodLog) => {
    setEditingLog(log);
    setActiveFood(null);
    setFoodName(log.food_name);
    setCalories(String(log.calories_per_100g));
    setProtein(String(log.protein_per_100g));
    setCarbs(String(log.carbs_per_100g));
    setFat(String(log.fat_per_100g));
    setQuantity(String(log.quantity_grams));
    setPortionMode('grams');
    setSelectedMeal(log.meal);
    setSaveFoodToLibrary(false);
    setShowFoodModal(true);
  };

  const saveFood = async () => {
    const name = foodName.trim();
    const grams = calculateFoodGrams();

    if (!name) {
      Alert.alert('Food name required', 'Enter a name for this food.');
      return;
    }

    if (grams <= 0) {
      Alert.alert('Invalid amount', 'Enter a quantity greater than zero.');
      return;
    }

    const nutritionNumbers = [calories, protein, carbs, fat].map(Number);
    if (nutritionNumbers.some((n) => !Number.isFinite(n) || n < 0)) {
      Alert.alert('Invalid nutrition', 'Nutrition values must be valid, non-negative numbers per 100 g.');
      return;
    }

    Keyboard.dismiss();
    setSaving(true);

    try {
      if (saveFoodToLibrary && !editingLog) {
        const { error: foodError } = await supabase.from('user_foods').insert({
          name,
          calories_per_100g: numberValue(calories),
          protein_per_100g: numberValue(protein),
          carbs_per_100g: numberValue(carbs),
          fat_per_100g: numberValue(fat),
          default_unit_weight_g:
            portionMode === 'items' ? numberValue(itemWeight) || null : null,
          unit_name: portionMode === 'items' ? itemName.trim() || 'item' : null,
          serving_weight_g:
            portionMode === 'servings' ? numberValue(servingWeight) || null : null,
          serving_name:
            portionMode === 'servings' ? servingName.trim() || 'serving' : null,
        });

        if (foodError) throw foodError;
      }

      const foodId =
        editingLog?.food_id ??
        activeFood?.id ??
        `manual:${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

      const quantityLabel =
        portionMode === 'items'
          ? `${quantity} ${itemName || 'item'}${numberValue(quantity) === 1 ? '' : 's'} (${round(grams)} g)`
          : portionMode === 'servings'
            ? `${quantity} ${servingName || 'serving'}${numberValue(quantity) === 1 ? '' : 's'} (${round(grams)} g)`
            : `${round(grams)} g`;

      const payload = {
        food_id: foodId,
        food_name: name,
        calories_per_100g: numberValue(calories),
        protein_per_100g: numberValue(protein),
        carbs_per_100g: numberValue(carbs),
        fat_per_100g: numberValue(fat),
        quantity_grams: round(grams, 2),
        quantity_label: quantityLabel,
        date: selectedDate,
        meal: selectedMeal,
        recipe_id: null,
      };

      if (editingLog) {
        const { error } = await supabase
          .from('food_logs')
          .update(payload)
          .eq('id', editingLog.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('food_logs').insert(payload);
        if (error) throw error;
      }

      setShowFoodModal(false);
      resetFoodForm();
      await Promise.all([loadDiary(), loadFoods()]);
    } catch (error) {
      Alert.alert(
        'Could not save food',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteLog = (log: FoodLog) => {
    Alert.alert('Delete food entry?', `Remove "${log.food_name}" from your diary?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase
            .from('food_logs')
            .delete()
            .eq('id', log.id);

          if (error) {
            Alert.alert('Could not delete entry', error.message);
            return;
          }

          setLogs((previous) => previous.filter((item) => item.id !== log.id));
        },
      },
    ]);
  };

  const searchFoodDatabase = async () => {
    if (searchText.trim().length < 2) {
      Alert.alert('Search term too short', 'Enter at least two characters.');
      return;
    }

    Keyboard.dismiss();
    setSearching(true);
    setSearchWarning('');
    setDatabaseResults([]);

    try {
      const { data, error } = await supabase.functions.invoke('food-search', {
        body: { query: searchText.trim() },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const results: Food[] = (data?.foods ?? [])
        .filter((item: any) => {
          return (
            item.nutritionComplete === true &&
            Number.isFinite(Number(item.caloriesPer100g)) &&
            Number.isFinite(Number(item.proteinPer100g)) &&
            Number.isFinite(Number(item.carbsPer100g)) &&
            Number.isFinite(Number(item.fatPer100g))
          );
        })
        .map((item: any) => ({
          id: String(item.id),
          name: String(item.name),
          calories: numberValue(item.caloriesPer100g),
          protein: numberValue(item.proteinPer100g),
          carbs: numberValue(item.carbsPer100g),
          fat: numberValue(item.fatPer100g),
          source: item.source,
        }));

      setDatabaseResults(results);
      if (results.length === 0) {
        setSearchWarning(
          'No results with complete nutrition were found. Try a different search or add the food manually.',
        );
      }
    } catch (error) {
      Alert.alert(
        'Food search failed',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setSearching(false);
    }
  };

  const resetRecipeForm = () => {
    setEditingRecipeId(null);
    setRecipeName('');
    setRecipeServings('2');
    setRecipeCookedWeight('');
    setRecipeIngredients([]);
    setIngredientSearch('');
    setIngredientQuantity('100');
    setAddingIngredient(null);
  };

  const openCreateRecipe = () => {
    resetRecipeForm();
    setShowRecipeModal(true);
  };

  const openEditRecipe = (recipe: RecipeWithNutrition) => {
    setEditingRecipeId(recipe.id);
    setRecipeName(recipe.name);
    setRecipeServings(String(recipe.servings));
    setRecipeCookedWeight(
      recipe.total_weight_grams ? String(recipe.total_weight_grams) : '',
    );
    setRecipeIngredients(recipe.ingredients.map((item) => ({ ...item })));
    setIngredientSearch('');
    setAddingIngredient(null);
    setShowRecipeModal(true);
  };

  const addRecipeIngredient = (food: Food) => {
    const grams = numberValue(ingredientQuantity, 100);
    if (grams <= 0) {
      Alert.alert('Invalid amount', 'Enter a quantity greater than zero.');
      return;
    }

    setRecipeIngredients((previous) => [
      ...previous,
      {
        food_name: food.name,
        quantity_grams: grams,
        calories_per_100g: food.calories,
        protein_per_100g: food.protein,
        carbs_per_100g: food.carbs,
        fat_per_100g: food.fat,
      },
    ]);
    setAddingIngredient(null);
    setIngredientQuantity('100');
    setIngredientSearch('');
  };

  const updateIngredientQuantity = (index: number, value: string) => {
    setRecipeIngredients((previous) =>
      previous.map((item, i) =>
        i === index ? { ...item, quantity_grams: numberValue(value) } : item,
      ),
    );
  };

  const saveRecipe = async () => {
    const name = recipeName.trim();
    const servings = numberValue(recipeServings);
    const cookedWeight = recipeCookedWeight.trim()
      ? numberValue(recipeCookedWeight)
      : null;

    if (!name) {
      Alert.alert('Recipe name required', 'Enter a name for this recipe.');
      return;
    }

    if (servings <= 0) {
      Alert.alert('Invalid servings', 'The number of servings must be greater than zero.');
      return;
    }

    if (cookedWeight !== null && cookedWeight <= 0) {
      Alert.alert('Invalid cooked weight', 'Enter a weight greater than zero or leave it blank.');
      return;
    }

    if (recipeIngredients.length === 0) {
      Alert.alert('Add ingredients', 'Add at least one ingredient to your recipe.');
      return;
    }

    if (recipeIngredients.some((item) => item.quantity_grams <= 0)) {
      Alert.alert('Invalid ingredient amount', 'Every ingredient needs a quantity greater than zero.');
      return;
    }

    setSaving(true);
    Keyboard.dismiss();

    try {
      let recipeId = editingRecipeId;

      if (recipeId) {
        const { error } = await supabase
          .from('user_recipes')
          .update({
            name,
            servings,
            total_weight_grams: cookedWeight,
            updated_at: new Date().toISOString(),
          })
          .eq('id', recipeId);

        if (error) throw error;

        const { error: deleteError } = await supabase
          .from('recipe_ingredients')
          .delete()
          .eq('recipe_id', recipeId);

        if (deleteError) throw deleteError;
      } else {
        const { data, error } = await supabase
          .from('user_recipes')
          .insert({
            name,
            servings,
            total_weight_grams: cookedWeight,
          })
          .select('id')
          .single();

        if (error) throw error;
        recipeId = data.id;
      }

      const ingredientPayload = recipeIngredients.map((ingredient) => ({
        recipe_id: recipeId,
        food_name: ingredient.food_name,
        quantity_grams: ingredient.quantity_grams,
        calories_per_100g: ingredient.calories_per_100g,
        protein_per_100g: ingredient.protein_per_100g,
        carbs_per_100g: ingredient.carbs_per_100g,
        fat_per_100g: ingredient.fat_per_100g,
      }));

      const { error: ingredientError } = await supabase
        .from('recipe_ingredients')
        .insert(ingredientPayload);

      if (ingredientError) throw ingredientError;

      setShowRecipeModal(false);
      resetRecipeForm();
      await loadRecipes();

      Alert.alert(
        editingRecipeId ? 'Recipe updated' : 'Recipe saved',
        'Your recipe is ready to log.',
      );
    } catch (error) {
      Alert.alert(
        'Could not save recipe',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteRecipe = (recipe: RecipeWithNutrition) => {
    Alert.alert('Delete recipe?', `Delete "${recipe.name}" from your recipes?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase
            .from('user_recipes')
            .delete()
            .eq('id', recipe.id);

          if (error) {
            Alert.alert('Could not delete recipe', error.message);
            return;
          }

          setRecipes((previous) => previous.filter((item) => item.id !== recipe.id));
        },
      },
    ]);
  };

  const openRecipeLog = (recipe: RecipeWithNutrition) => {
    setRecipeLog(recipe);
    setRecipePortionMode('servings');
    setRecipePortionQuantity('1');
    setRecipeMeal('Dinner');
    setShowRecipePicker(false);
  };

  const logRecipe = async () => {
    if (!recipeLog) return;

    const amount = numberValue(recipePortionQuantity);
    if (amount <= 0) {
      Alert.alert('Invalid amount', 'Enter an amount greater than zero.');
      return;
    }

    const recipeWeight =
      recipeLog.total_weight_grams ?? recipeLog.calculatedWeight;

    if (recipeWeight <= 0) {
      Alert.alert('Missing recipe weight', 'Add ingredient quantities before logging this recipe.');
      return;
    }

    const grams =
      recipePortionMode === 'servings'
        ? (recipeWeight / recipeLog.servings) * amount
        : amount;

    const nutritionPer100g = {
      calories: (recipeLog.calories / recipeWeight) * 100,
      protein: (recipeLog.protein / recipeWeight) * 100,
      carbs: (recipeLog.carbs / recipeWeight) * 100,
      fat: (recipeLog.fat / recipeWeight) * 100,
    };

    const label =
      recipePortionMode === 'servings'
        ? `${amount} serving${amount === 1 ? '' : 's'} (${round(grams)} g)`
        : `${round(grams)} g`;

    setSaving(true);

    try {
      const { error } = await supabase.from('food_logs').insert({
        food_id: `recipe:${recipeLog.id}`,
        food_name: recipeLog.name,
        calories_per_100g: nutritionPer100g.calories,
        protein_per_100g: nutritionPer100g.protein,
        carbs_per_100g: nutritionPer100g.carbs,
        fat_per_100g: nutritionPer100g.fat,
        quantity_grams: round(grams, 2),
        quantity_label: label,
        recipe_id: recipeLog.id,
        date: selectedDate,
        meal: recipeMeal,
      });

      if (error) throw error;

      setRecipeLog(null);
      await loadDiary();
    } catch (error) {
      Alert.alert(
        'Could not log recipe',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  const renderMacro = (label: string, value: number, suffix: string) => (
    <View style={styles.macroItem} key={label}>
      <Text style={styles.macroValue}>
        {round(value, label === 'Calories' ? 0 : 1)}
        {suffix}
      </Text>
      <Text style={styles.macroLabel}>{label}</Text>
    </View>
  );

  const renderFoodRow = (food: Food) => (
    <TouchableOpacity
      key={`${food.id}:${food.name}`}
      style={styles.foodResult}
      onPress={() => openFoodForLogging(food)}
    >
      <View style={styles.foodResultInfo}>
        <Text style={styles.foodResultName}>{food.name}</Text>
        <Text style={styles.foodResultMeta}>
          {Math.round(food.calories)} kcal / 100 g · P {round(food.protein)} g · C{' '}
          {round(food.carbs)} g · F {round(food.fat)} g
        </Text>
      </View>
      <Text style={styles.plus}>+</Text>
    </TouchableOpacity>
  );

  const renderLog = (log: FoodLog) => {
    const n = logNutrition(log);

    return (
      <View key={log.id} style={styles.logCard}>
        <TouchableOpacity
          style={styles.logMain}
          onPress={() => openEditLog(log)}
        >
          <View style={styles.logTitleRow}>
            <Text style={styles.logName}>{log.food_name}</Text>
            <Text style={styles.logCalories}>{Math.round(n.calories)} kcal</Text>
          </View>
          <Text style={styles.logQuantity}>
            {log.quantity_label || `${round(log.quantity_grams)} g`}
          </Text>
          <Text style={styles.logMacros}>
            P {round(n.protein)} g · C {round(n.carbs)} g · F {round(n.fat)} g
          </Text>
        </TouchableOpacity>

        <View style={styles.logActions}>
          <TouchableOpacity
            style={styles.smallAction}
            onPress={() => openEditLog(log)}
          >
            <Text style={styles.smallActionText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.smallAction}
            onPress={() => deleteLog(log)}
          >
            <Text style={[styles.smallActionText, styles.deleteText]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.screenContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>NUTRITION</Text>
            <Text style={styles.title}>Food Diary</Text>
          </View>
          <TouchableOpacity style={styles.headerAdd} onPress={openNewFood}>
            <Text style={styles.headerAddText}>+ Add food</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.dateSelector}>
          <TouchableOpacity
            style={styles.dateArrow}
            onPress={() => setSelectedDate((d) => shiftDate(d, -1))}
          >
            <Text style={styles.arrowText}>‹</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dateCenter}
            onPress={() => setSelectedDate(todayString())}
          >
            <Text style={styles.dateText}>{formatDate(selectedDate)}</Text>
            <Text style={styles.dateSubtext}>
              {selectedDate === todayString() ? 'Tap to refresh today' : 'Tap to return to today'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dateArrow}
            onPress={() => setSelectedDate((d) => shiftDate(d, 1))}
          >
            <Text style={styles.arrowText}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.calorieCard}>
          <Text style={styles.cardEyebrow}>TOTAL CONSUMED</Text>
          <View style={styles.calorieLine}>
            <Text style={styles.calorieNumber}>{Math.round(totals.calories)}</Text>
            <Text style={styles.calorieUnit}>kcal</Text>
          </View>
          <View style={styles.calorieBar}>
            <View
              style={[
                styles.calorieBarFill,
                { width: `${Math.min((totals.calories / 2000) * 100, 100)}%` },
              ]}
            />
          </View>
          <Text style={styles.targetHint}>
            Progress against a 2,000 kcal visual reference
          </Text>
          <View style={styles.macroRow}>
            {renderMacro('Protein', totals.protein, ' g')}
            {renderMacro('Carbs', totals.carbs, ' g')}
            {renderMacro('Fat', totals.fat, ' g')}
          </View>
        </View>

        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickAction} onPress={openNewFood}>
            <Text style={styles.quickActionIcon}>＋</Text>
            <Text style={styles.quickActionTitle}>Add food</Text>
            <Text style={styles.quickActionSubtitle}>Enter nutrition</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => setShowRecipePicker(true)}
          >
            <Text style={styles.quickActionIcon}>▤</Text>
            <Text style={styles.quickActionTitle}>My recipes</Text>
            <Text style={styles.quickActionSubtitle}>Log a meal</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={openCreateRecipe}
          >
            <Text style={styles.quickActionIcon}>✚</Text>
            <Text style={styles.quickActionTitle}>Create recipe</Text>
            <Text style={styles.quickActionSubtitle}>Combine foods</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Your meals</Text>
          <Text style={styles.sectionMeta}>{logs.length} entries</Text>
        </View>

        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={GREEN} size="large" />
            <Text style={styles.mutedText}>Loading your diary…</Text>
          </View>
        ) : (
          MEALS.map((meal) => {
            const mealLogs = logs.filter((log) => log.meal === meal);
            const mealCalories = mealLogs.reduce(
              (sum, log) => sum + logNutrition(log).calories,
              0,
            );

            return (
              <View key={meal} style={styles.mealSection}>
                <View style={styles.mealHeader}>
                  <Text style={styles.mealTitle}>{meal}</Text>
                  <Text style={styles.mealCalories}>
                    {Math.round(mealCalories)} kcal
                  </Text>
                </View>
                {mealLogs.length === 0 ? (
                  <TouchableOpacity
                    style={styles.emptyMeal}
                    onPress={() => {
                      setSelectedMeal(meal);
                      openNewFood();
                      setSelectedMeal(meal);
                    }}
                  >
                    <Text style={styles.emptyMealText}>+ Add food to {meal.toLowerCase()}</Text>
                  </TouchableOpacity>
                ) : (
                  mealLogs.map(renderLog)
                )}
              </View>
            );
          })
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>My recipes</Text>
          <TouchableOpacity onPress={openCreateRecipe}>
            <Text style={styles.linkText}>+ New recipe</Text>
          </TouchableOpacity>
        </View>

        {recipes.length === 0 ? (
          <TouchableOpacity style={styles.emptyRecipe} onPress={openCreateRecipe}>
            <Text style={styles.emptyRecipeTitle}>Build your first recipe</Text>
            <Text style={styles.mutedText}>
              Combine ingredients, set servings and cooked weight, then log portions.
            </Text>
          </TouchableOpacity>
        ) : (
          recipes.map((recipe) => {
            const weight = recipe.total_weight_grams ?? recipe.calculatedWeight;
            const perServing = recipe.servings > 0 ? recipe.calories / recipe.servings : 0;

            return (
              <View key={recipe.id} style={styles.recipeCard}>
                <TouchableOpacity
                  style={styles.recipeMain}
                  onPress={() => openRecipeLog(recipe)}
                >
                  <Text style={styles.recipeName}>{recipe.name}</Text>
                  <Text style={styles.recipeMeta}>
                    {recipe.servings} servings · {Math.round(weight)} g total
                  </Text>
                  <Text style={styles.recipeCalories}>
                    {Math.round(perServing)} kcal per serving
                  </Text>
                </TouchableOpacity>
                <View style={styles.recipeActions}>
                  <TouchableOpacity onPress={() => openRecipeLog(recipe)}>
                    <Text style={styles.linkText}>Log</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => openEditRecipe(recipe)}>
                    <Text style={styles.smallActionText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => deleteRecipe(recipe)}>
                    <Text style={[styles.smallActionText, styles.deleteText]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal
        visible={showFoodModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowFoodModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {editingLog ? 'Edit food entry' : 'Add food'}
                </Text>
                <Text style={styles.modalSubtitle}>
                  Nutrition values are entered per 100 g
                </Text>
              </View>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  Keyboard.dismiss();
                  setShowFoodModal(false);
                }}
              >
                <Text style={styles.closeButtonText}>×</Text>
              </TouchableOpacity>
            </View>

            {!editingLog && (
              <>
                <Text style={styles.fieldLabel}>Find a food</Text>
                <TextInput
                  style={styles.input}
                  value={searchText}
                  onChangeText={(value) => {
                    setSearchText(value);
                    setDatabaseResults([]);
                    setSearchWarning('');
                  }}
                  placeholder="Search eggs, oats, yoghurt, brands…"
                  placeholderTextColor={MUTED}
                  returnKeyType="search"
                  onSubmitEditing={() => void searchFoodDatabase()}
                />
                <View style={styles.searchButtons}>
                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={() => void searchFoodDatabase()}
                    disabled={searching}
                  >
                    {searching ? (
                      <ActivityIndicator color={GREEN} />
                    ) : (
                      <Text style={styles.secondaryButtonText}>Search database</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={() => {
                      setDatabaseResults([]);
                      setSearchText('');
                      setSearchWarning('');
                    }}
                  >
                    <Text style={styles.secondaryButtonText}>Australian foods</Text>
                  </TouchableOpacity>
                </View>

                {!!searchWarning && (
                  <Text style={styles.warningText}>{searchWarning}</Text>
                )}

                <View style={styles.foodResults}>
                  <ScrollView
                    nestedScrollEnabled
                    keyboardShouldPersistTaps="handled"
                  >
                    {filteredFoods.map(renderFoodRow)}
                    {filteredFoods.length === 0 && (
                      <Text style={styles.mutedText}>
                        No matching saved or built-in foods. Enter the food manually below.
                      </Text>
                    )}
                  </ScrollView>
                </View>
              </>
            )}

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalFormContent}
            >
              <Text style={styles.fieldLabel}>Food name</Text>
              <TextInput
                style={styles.input}
                value={foodName}
                onChangeText={setFoodName}
                placeholder="e.g. Chicken breast"
                placeholderTextColor={MUTED}
              />

              <Text style={styles.fieldLabel}>Nutrition per 100 g</Text>
              <View style={styles.nutritionInputs}>
                <View style={styles.nutritionInputWrap}>
                  <Text style={styles.inputHint}>Calories</Text>
                  <TextInput
                    style={styles.input}
                    value={calories}
                    onChangeText={setCalories}
                    keyboardType="decimal-pad"
                    placeholder="kcal"
                    placeholderTextColor={MUTED}
                  />
                </View>
                <View style={styles.nutritionInputWrap}>
                  <Text style={styles.inputHint}>Protein (g)</Text>
                  <TextInput
                    style={styles.input}
                    value={protein}
                    onChangeText={setProtein}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={MUTED}
                  />
                </View>
                <View style={styles.nutritionInputWrap}>
                  <Text style={styles.inputHint}>Carbs (g)</Text>
                  <TextInput
                    style={styles.input}
                    value={carbs}
                    onChangeText={setCarbs}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={MUTED}
                  />
                </View>
                <View style={styles.nutritionInputWrap}>
                  <Text style={styles.inputHint}>Fat (g)</Text>
                  <TextInput
                    style={styles.input}
                    value={fat}
                    onChangeText={setFat}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={MUTED}
                  />
                </View>
              </View>

              <Text style={styles.fieldLabel}>Portion type</Text>
              <View style={styles.segmentRow}>
                {([
                  ['grams', 'Grams'],
                  ['servings', 'Servings'],
                  ['items', 'Items'],
                ] as [PortionMode, string][]).map(([mode, label]) => (
                  <TouchableOpacity
                    key={mode}
                    style={[styles.segment, portionMode === mode && styles.segmentActive]}
                    onPress={() => {
                      setPortionMode(mode);
                      setQuantity('1');
                    }}
                  >
                    <Text style={[styles.segmentText, portionMode === mode && styles.segmentTextActive]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {portionMode === 'items' && (
                <View style={styles.twoInputs}>
                  <View style={styles.twoInputColumn}>
                    <Text style={styles.inputHint}>Item name</Text>
                    <TextInput
                      style={styles.input}
                      value={itemName}
                      onChangeText={setItemName}
                      placeholder="egg"
                      placeholderTextColor={MUTED}
                    />
                  </View>
                  <View style={styles.twoInputColumn}>
                    <Text style={styles.inputHint}>Weight per item (g)</Text>
                    <TextInput
                      style={styles.input}
                      value={itemWeight}
                      onChangeText={setItemWeight}
                      keyboardType="decimal-pad"
                      placeholder="55"
                      placeholderTextColor={MUTED}
                    />
                  </View>
                </View>
              )}

              {portionMode === 'servings' && (
                <View style={styles.twoInputs}>
                  <View style={styles.twoInputColumn}>
                    <Text style={styles.inputHint}>Serving name</Text>
                    <TextInput
                      style={styles.input}
                      value={servingName}
                      onChangeText={setServingName}
                      placeholder="cup"
                      placeholderTextColor={MUTED}
                    />
                  </View>
                  <View style={styles.twoInputColumn}>
                    <Text style={styles.inputHint}>Weight per serving (g)</Text>
                    <TextInput
                      style={styles.input}
                      value={servingWeight}
                      onChangeText={setServingWeight}
                      keyboardType="decimal-pad"
                      placeholder="150"
                      placeholderTextColor={MUTED}
                    />
                  </View>
                </View>
              )}

              <Text style={styles.fieldLabel}>
                {portionMode === 'grams'
                  ? 'Quantity (g)'
                  : portionMode === 'items'
                    ? `Number of ${itemName || 'items'}`
                    : `Number of ${servingName || 'servings'}`}
              </Text>
              <TextInput
                style={styles.input}
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="decimal-pad"
                placeholder="1"
                placeholderTextColor={MUTED}
              />

              <View style={styles.previewCard}>
                <Text style={styles.previewTitle}>
                  Estimated nutrition · {round(calculateFoodGrams())} g
                </Text>
                <Text style={styles.previewCalories}>
                  {Math.round(currentFoodNutrition.calories)} kcal
                </Text>
                <Text style={styles.previewMacros}>
                  Protein {round(currentFoodNutrition.protein)} g · Carbs{' '}
                  {round(currentFoodNutrition.carbs)} g · Fat {round(currentFoodNutrition.fat)} g
                </Text>
              </View>

              <Text style={styles.fieldLabel}>Meal</Text>
              <View style={styles.segmentRow}>
                {MEALS.map((meal) => (
                  <TouchableOpacity
                    key={meal}
                    style={[styles.segment, selectedMeal === meal && styles.segmentActive]}
                    onPress={() => setSelectedMeal(meal)}
                  >
                    <Text style={[styles.segmentText, selectedMeal === meal && styles.segmentTextActive]}>
                      {meal}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {!editingLog && (
                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={() => setSaveFoodToLibrary((value) => !value)}
                >
                  <View style={[styles.checkbox, saveFoodToLibrary && styles.checkboxChecked]}>
                    {saveFoodToLibrary && <Text style={styles.checkboxTick}>✓</Text>}
                  </View>
                  <View style={styles.checkboxCopy}>
                    <Text style={styles.checkboxTitle}>Save to My Foods</Text>
                    <Text style={styles.checkboxSubtitle}>
                      Keep this food and its portion defaults for next time.
                    </Text>
                  </View>
                </TouchableOpacity>
              )}

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    Keyboard.dismiss();
                    setShowFoodModal(false);
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.primaryButton, saving && styles.disabledButton]}
                  onPress={() => void saveFood()}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color={BG} />
                  ) : (
                    <Text style={styles.primaryButtonText}>
                      {editingLog ? 'Save changes' : 'Add to diary'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={showRecipeModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowRecipeModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {editingRecipeId ? 'Edit recipe' : 'Create recipe'}
                </Text>
                <Text style={styles.modalSubtitle}>
                  Ingredient nutrition is saved as a recipe snapshot.
                </Text>
              </View>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowRecipeModal(false)}
              >
                <Text style={styles.closeButtonText}>×</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalFormContent}
            >
              <Text style={styles.fieldLabel}>Recipe name</Text>
              <TextInput
                style={styles.input}
                value={recipeName}
                onChangeText={setRecipeName}
                placeholder="e.g. Chicken rice bowl"
                placeholderTextColor={MUTED}
              />

              <View style={styles.twoInputs}>
                <View style={styles.twoInputColumn}>
                  <Text style={styles.inputHint}>Number of servings</Text>
                  <TextInput
                    style={styles.input}
                    value={recipeServings}
                    onChangeText={setRecipeServings}
                    keyboardType="decimal-pad"
                    placeholder="2"
                    placeholderTextColor={MUTED}
                  />
                </View>
                <View style={styles.twoInputColumn}>
                  <Text style={styles.inputHint}>Total cooked weight (g)</Text>
                  <TextInput
                    style={styles.input}
                    value={recipeCookedWeight}
                    onChangeText={setRecipeCookedWeight}
                    keyboardType="decimal-pad"
                    placeholder={`Ingredient total: ${Math.round(
                      recipeIngredients.reduce((sum, i) => sum + i.quantity_grams, 0),
                    )} g`}
                    placeholderTextColor={MUTED}
                  />
                </View>
              </View>
              <Text style={styles.helperText}>
                Weigh the finished dish for the most accurate gram-based portions.
                Leave cooked weight blank to use the sum of ingredient weights.
              </Text>

              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Ingredients</Text>
                <Text style={styles.sectionMeta}>{recipeIngredients.length} items</Text>
              </View>

              {recipeIngredients.map((ingredient, index) => (
                <View key={`${ingredient.food_name}-${index}`} style={styles.ingredientCard}>
                  <View style={styles.ingredientTopRow}>
                    <Text style={styles.ingredientName}>{ingredient.food_name}</Text>
                    <TouchableOpacity
                      onPress={() =>
                        setRecipeIngredients((previous) =>
                          previous.filter((_, i) => i !== index),
                        )
                      }
                    >
                      <Text style={styles.deleteText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.ingredientBottomRow}>
                    <Text style={styles.inputHint}>Amount (g)</Text>
                    <TextInput
                      style={[styles.input, styles.ingredientQuantity]}
                      value={String(ingredient.quantity_grams)}
                      onChangeText={(value) => updateIngredientQuantity(index, value)}
                      keyboardType="decimal-pad"
                      placeholder="100"
                      placeholderTextColor={MUTED}
                    />
                  </View>
                  <Text style={styles.logMacros}>
                    {Math.round(ingredient.quantity_grams * ingredient.calories_per_100g / 100)} kcal
                    {' · '}P {round(ingredient.quantity_grams * ingredient.protein_per_100g / 100)} g
                    {' · '}C {round(ingredient.quantity_grams * ingredient.carbs_per_100g / 100)} g
                    {' · '}F {round(ingredient.quantity_grams * ingredient.fat_per_100g / 100)} g
                  </Text>
                </View>
              ))}

              <View style={styles.addIngredientPanel}>
                <Text style={styles.fieldLabel}>Add an ingredient</Text>
                <TextInput
                  style={styles.input}
                  value={ingredientSearch}
                  onChangeText={setIngredientSearch}
                  placeholder="Search saved or Australian foods"
                  placeholderTextColor={MUTED}
                />
                <TextInput
                  style={styles.input}
                  value={ingredientQuantity}
                  onChangeText={setIngredientQuantity}
                  keyboardType="decimal-pad"
                  placeholder="Amount in grams"
                  placeholderTextColor={MUTED}
                />
                <View style={styles.ingredientResults}>
                  <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
                    {filteredIngredientFoods.map((food) => (
                      <TouchableOpacity
                        key={`${food.id}:${food.name}`}
                        style={styles.foodResult}
                        onPress={() => addRecipeIngredient(food)}
                      >
                        <View style={styles.foodResultInfo}>
                          <Text style={styles.foodResultName}>{food.name}</Text>
                          <Text style={styles.foodResultMeta}>
                            {Math.round(food.calories)} kcal / 100 g
                          </Text>
                        </View>
                        <Text style={styles.plus}>+</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>

              {recipeIngredients.length > 0 && (
                <View style={styles.previewCard}>
                  <Text style={styles.previewTitle}>Whole recipe</Text>
                  <Text style={styles.previewCalories}>
                    {Math.round(recipeNutrition(recipeIngredients).calories)} kcal
                  </Text>
                  <Text style={styles.previewMacros}>
                    Per serving: {Math.round(
                      recipeNutrition(recipeIngredients).calories /
                      Math.max(numberValue(recipeServings, 1), 1),
                    )} kcal
                  </Text>
                  <Text style={styles.previewMacros}>
                    Protein {round(recipeNutrition(recipeIngredients).protein)} g · Carbs{' '}
                    {round(recipeNutrition(recipeIngredients).carbs)} g · Fat{' '}
                    {round(recipeNutrition(recipeIngredients).fat)} g
                  </Text>
                </View>
              )}

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setShowRecipeModal(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.primaryButton, saving && styles.disabledButton]}
                  onPress={() => void saveRecipe()}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color={BG} />
                  ) : (
                    <Text style={styles.primaryButtonText}>Save recipe</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Recipe list modal */}
      <Modal
        visible={showRecipePicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowRecipePicker(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>My recipes</Text>
                <Text style={styles.modalSubtitle}>Choose a recipe to log.</Text>
              </View>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowRecipePicker(false)}
              >
                <Text style={styles.closeButtonText}>×</Text>
              </TouchableOpacity>
            </View>

            <ScrollView>
              {recipes.length === 0 ? (
                <View style={styles.emptyRecipe}>
                  <Text style={styles.emptyRecipeTitle}>No recipes yet</Text>
                  <Text style={styles.mutedText}>
                    Create a recipe first to log it here.
                  </Text>
                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={() => {
                      setShowRecipePicker(false);
                      openCreateRecipe();
                    }}
                  >
                    <Text style={styles.primaryButtonText}>Create recipe</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                recipes.map((recipe) => (
                  <TouchableOpacity
                    key={recipe.id}
                    style={styles.recipeCard}
                    onPress={() => openRecipeLog(recipe)}
                  >
                    <View style={styles.recipeMain}>
                      <Text style={styles.recipeName}>{recipe.name}</Text>
                      <Text style={styles.recipeMeta}>
                        {recipe.servings} servings · {Math.round(recipe.total_weight_grams ?? recipe.calculatedWeight)} g
                      </Text>
                      <Text style={styles.recipeCalories}>
                        {Math.round(recipe.calories / Math.max(recipe.servings, 1))} kcal per serving
                      </Text>
                    </View>
                    <Text style={styles.plus}>›</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Log recipe modal */}
      <Modal
        visible={recipeLog !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setRecipeLog(null)}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{recipeLog?.name ?? 'Log recipe'}</Text>
                <Text style={styles.modalSubtitle}>
                  {recipeLog
                    ? `${Math.round(recipeLog.total_weight_grams ?? recipeLog.calculatedWeight)} g total`
                    : ''}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setRecipeLog(null)}
              >
                <Text style={styles.closeButtonText}>×</Text>
              </TouchableOpacity>
            </View>

            {recipeLog && (
              <ScrollView keyboardShouldPersistTaps="handled">
                <View style={styles.previewCard}>
                  <Text style={styles.previewTitle}>Whole recipe</Text>
                  <Text style={styles.previewCalories}>
                    {Math.round(recipeLog.calories)} kcal
                  </Text>
                  <Text style={styles.previewMacros}>
                    Protein {round(recipeLog.protein)} g · Carbs {round(recipeLog.carbs)} g · Fat {round(recipeLog.fat)} g
                  </Text>
                </View>

                <Text style={styles.fieldLabel}>Portion type</Text>
                <View style={styles.segmentRow}>
                  <TouchableOpacity
                    style={[styles.segment, recipePortionMode === 'servings' && styles.segmentActive]}
                    onPress={() => {
                      setRecipePortionMode('servings');
                      setRecipePortionQuantity('1');
                    }}
                  >
                    <Text style={[styles.segmentText, recipePortionMode === 'servings' && styles.segmentTextActive]}>
                      Servings
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.segment, recipePortionMode === 'grams' && styles.segmentActive]}
                    onPress={() => {
                      setRecipePortionMode('grams');
                      setRecipePortionQuantity('100');
                    }}
                  >
                    <Text style={[styles.segmentText, recipePortionMode === 'grams' && styles.segmentTextActive]}>
                      Grams
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.fieldLabel}>
                  {recipePortionMode === 'servings' ? 'Number of servings' : 'Quantity (g)'}
                </Text>
                <TextInput
                  style={styles.input}
                  value={recipePortionQuantity}
                  onChangeText={setRecipePortionQuantity}
                  keyboardType="decimal-pad"
                  placeholder="1"
                  placeholderTextColor={MUTED}
                />

                <Text style={styles.fieldLabel}>Meal</Text>
                <View style={styles.segmentRow}>
                  {MEALS.map((meal) => (
                    <TouchableOpacity
                      key={meal}
                      style={[styles.segment, recipeMeal === meal && styles.segmentActive]}
                      onPress={() => setRecipeMeal(meal)}
                    >
                      <Text style={[styles.segmentText, recipeMeal === meal && styles.segmentTextActive]}>
                        {meal}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => setRecipeLog(null)}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.primaryButton, saving && styles.disabledButton]}
                    onPress={() => void logRecipe()}
                    disabled={saving}
                  >
                    {saving ? (
                      <ActivityIndicator color={BG} />
                    ) : (
                      <Text style={styles.primaryButtonText}>Add to diary</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  screenContent: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  eyebrow: {
    color: GREEN,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 5,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
  },
  headerAdd: {
    backgroundColor: GREEN,
    paddingHorizontal: 15,
    paddingVertical: 11,
    borderRadius: 12,
  },
  headerAddText: {
    color: BG,
    fontWeight: '800',
    fontSize: 13,
  },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    borderRadius: 15,
    paddingVertical: 8,
    marginBottom: 16,
  },
  dateArrow: {
    width: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowText: {
    color: GREEN,
    fontSize: 32,
    lineHeight: 38,
  },
  dateCenter: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
  },
  dateText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  dateSubtext: {
    color: MUTED,
    fontSize: 11,
    marginTop: 3,
  },
  calorieCard: {
    backgroundColor: CARD,
    borderRadius: 20,
    padding: 20,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: BORDER,
  },
  cardEyebrow: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  calorieLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 7,
    marginBottom: 16,
  },
  calorieNumber: {
    color: '#FFFFFF',
    fontSize: 44,
    fontWeight: '800',
    letterSpacing: -1,
  },
  calorieUnit: {
    color: MUTED,
    fontSize: 15,
    marginLeft: 8,
  },
  calorieBar: {
    height: 7,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: CARD_LIGHT,
  },
  calorieBarFill: {
    height: '100%',
    borderRadius: 10,
    backgroundColor: GREEN,
  },
  targetHint: {
    color: MUTED,
    fontSize: 10,
    marginTop: 7,
  },
  macroRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: BORDER,
    marginTop: 18,
    paddingTop: 15,
  },
  macroItem: {
    flex: 1,
    alignItems: 'center',
  },
  macroValue: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  macroLabel: {
    color: MUTED,
    fontSize: 11,
    marginTop: 5,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 9,
    marginBottom: 27,
  },
  quickAction: {
    flex: 1,
    minHeight: 115,
    backgroundColor: CARD,
    borderRadius: 15,
    padding: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  quickActionIcon: {
    color: GREEN,
    fontSize: 24,
    marginBottom: 8,
    fontWeight: '700',
  },
  quickActionTitle: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  quickActionSubtitle: {
    color: MUTED,
    fontSize: 10,
    marginTop: 5,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    marginTop: 2,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '800',
  },
  sectionMeta: {
    color: MUTED,
    fontSize: 12,
  },
  mealSection: {
    marginBottom: 20,
  },
  mealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 9,
  },
  mealTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  mealCalories: {
    color: MUTED,
    fontSize: 12,
  },
  emptyMeal: {
    backgroundColor: CARD,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: BORDER,
    borderStyle: 'dashed',
    padding: 17,
  },
  emptyMealText: {
    color: MUTED,
    fontSize: 13,
  },
  logCard: {
    backgroundColor: CARD,
    borderRadius: 13,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: 'hidden',
  },
  logMain: {
    padding: 13,
  },
  logTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  logName: {
    flex: 1,
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  logCalories: {
    color: GREEN,
    fontWeight: '800',
    fontSize: 13,
  },
  logQuantity: {
    color: MUTED,
    fontSize: 11,
    marginTop: 5,
  },
  logMacros: {
    color: '#B7B7B7',
    fontSize: 11,
    marginTop: 6,
  },
  logActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 17,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  smallAction: {
    paddingVertical: 2,
  },
  smallActionText: {
    color: '#CFCFCF',
    fontSize: 12,
    fontWeight: '600',
  },
  deleteText: {
    color: '#FF8585',
  },
  loadingCard: {
    backgroundColor: CARD,
    padding: 28,
    borderRadius: 15,
    alignItems: 'center',
    gap: 10,
  },
  mutedText: {
    color: MUTED,
    fontSize: 12,
    lineHeight: 18,
  },
  emptyRecipe: {
    backgroundColor: CARD,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 17,
    gap: 8,
  },
  emptyRecipeTitle: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  recipeCard: {
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 14,
    marginBottom: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  recipeMain: {
    flex: 1,
  },
  recipeName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  recipeMeta: {
    color: MUTED,
    fontSize: 11,
    marginTop: 5,
  },
  recipeCalories: {
    color: GREEN,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 5,
  },
  recipeActions: {
    alignItems: 'flex-end',
    gap: 10,
  },
  linkText: {
    color: GREEN,
    fontSize: 12,
    fontWeight: '800',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: BG,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 30 : 18,
    maxHeight: '94%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
    gap: 12,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '800',
  },
  modalSubtitle: {
    color: MUTED,
    fontSize: 11,
    marginTop: 5,
    lineHeight: 16,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: CARD_LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 24,
    lineHeight: 27,
  },
  fieldLabel: {
    color: '#EAEAEA',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 13,
  },
  inputHint: {
    color: MUTED,
    fontSize: 10,
    marginBottom: 6,
  },
  input: {
    backgroundColor: CARD,
    borderColor: BORDER,
    borderWidth: 1,
    borderRadius: 11,
    color: '#FFFFFF',
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 9,
    minHeight: 43,
  },
  searchButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  secondaryButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CARD_LIGHT,
    borderRadius: 10,
    padding: 11,
  },
  secondaryButtonText: {
    color: GREEN,
    fontSize: 11,
    fontWeight: '700',
  },
  warningText: {
    color: '#E9C37B',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 8,
  },
  foodResults: {
    maxHeight: 180,
    marginTop: 8,
    marginBottom: 5,
  },
  foodResult: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 3,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    gap: 10,
  },
  foodResultInfo: {
    flex: 1,
  },
  foodResultName: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  foodResultMeta: {
    color: MUTED,
    fontSize: 10,
    marginTop: 4,
  },
  plus: {
    color: GREEN,
    fontSize: 23,
    fontWeight: '700',
    paddingHorizontal: 5,
  },
  modalFormContent: {
    paddingBottom: 12,
  },
  nutritionInputs: {
    flexDirection: 'row',
    gap: 7,
  },
  nutritionInputWrap: {
    flex: 1,
  },
  segmentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 2,
  },
  segment: {
    backgroundColor: CARD,
    borderColor: BORDER,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: {
    backgroundColor: 'rgba(114,214,160,0.13)',
    borderColor: GREEN,
  },
  segmentText: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '700',
  },
  segmentTextActive: {
    color: GREEN,
  },
  twoInputs: {
    flexDirection: 'row',
    gap: 9,
    marginTop: 12,
  },
  twoInputColumn: {
    flex: 1,
  },
  previewCard: {
    backgroundColor: '#17241D',
    borderColor: '#315B43',
    borderWidth: 1,
    borderRadius: 13,
    padding: 14,
    marginTop: 15,
  },
  previewTitle: {
    color: '#BDE9CE',
    fontSize: 11,
    fontWeight: '700',
  },
  previewCalories: {
    color: GREEN,
    fontSize: 25,
    fontWeight: '800',
    marginTop: 5,
  },
  previewMacros: {
    color: '#D4E8DB',
    fontSize: 11,
    marginTop: 5,
    lineHeight: 17,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderColor: '#686868',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: GREEN,
    borderColor: GREEN,
  },
  checkboxTick: {
    color: BG,
    fontSize: 14,
    fontWeight: '900',
  },
  checkboxCopy: {
    flex: 1,
  },
  checkboxTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  checkboxSubtitle: {
    color: MUTED,
    fontSize: 10,
    marginTop: 3,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
    marginBottom: 10,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: CARD_LIGHT,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  primaryButton: {
    flex: 1,
    backgroundColor: GREEN,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: BG,
    fontSize: 13,
    fontWeight: '900',
  },
  disabledButton: {
    opacity: 0.6,
  },
  helperText: {
    color: MUTED,
    fontSize: 10,
    lineHeight: 16,
    marginTop: 7,
  },
  ingredientCard: {
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: BORDER,
  },
  ingredientTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  ingredientName: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  ingredientBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 9,
  },
  ingredientQuantity: {
    width: 120,
    minHeight: 36,
    paddingVertical: 6,
  },
  addIngredientPanel: {
    backgroundColor: '#151515',
    borderRadius: 13,
    padding: 12,
    borderWidth: 1,
    borderColor: BORDER,
    marginTop: 12,
  },
  ingredientResults: {
    maxHeight: 180,
    marginTop: 7,
  },
});