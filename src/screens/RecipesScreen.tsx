
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../services/supabase';
import { starterFoods } from '../services/foodService';
import { Food } from '../types/Food';

type RecipeIngredient = {
  id?: string;
  food: Food;
  quantityGrams: string;
};

type Recipe = {
  id: string;
  name: string;
  servings: number;
  total_weight_grams: number;
  created_at?: string;
};

type ApiFood = Food & {
  source?: string;
  nutritionComplete?: boolean;
};

const COLORS = {
  background: '#111111',
  card: '#1C1C1C',
  input: '#262626',
  green: '#72D6A0',
  text: '#FFFFFF',
  muted: '#A0A0A0',
  danger: '#FF7777',
  border: '#333333',
};

export default function RecipesScreen() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [customFoods, setCustomFoods] = useState<Food[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [editorVisible, setEditorVisible] = useState(false);
  const [editingRecipeId, setEditingRecipeId] = useState<string | null>(null);
  const [recipeName, setRecipeName] = useState('');
  const [servings, setServings] = useState('1');
  const [cookedWeight, setCookedWeight] = useState('');
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);

  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerMode, setPickerMode] = useState<'library' | 'database'>('library');
  const [foodSearch, setFoodSearch] = useState('');
  const [databaseResults, setDatabaseResults] = useState<ApiFood[]>([]);
  const [searchingDatabase, setSearchingDatabase] = useState(false);
  const [addingFoodId, setAddingFoodId] = useState<string | null>(null);

  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [feedbackTitle, setFeedbackTitle] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);

  const showFeedback = (
    title: string,
    message: string,
    success = false,
  ) => {
    setFeedbackTitle(title);
    setFeedbackMessage(message);
    setFeedbackSuccess(success);
    setFeedbackVisible(true);
  };

  const dismissFeedback = () => {
    const wasSuccessful = feedbackSuccess;

    setFeedbackVisible(false);
    setFeedbackSuccess(false);

    if (wasSuccessful) {
      setEditorVisible(false);
    }
  };

  const allFoods = useMemo(() => {
    const combined = [...starterFoods, ...customFoods];
    const unique = new Map<string, Food>();

    combined.forEach((food) => {
      const key = food.name.trim().toLowerCase();

      if (key && !unique.has(key)) {
        unique.set(key, food);
      }
    });

    return Array.from(unique.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [customFoods]);

  const loadCustomFoods = useCallback(async () => {
    const { data, error } = await supabase
      .from('user_foods')
      .select(
        'id, name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g',
      )
      .order('name', { ascending: true });

    if (error) {
      console.error('Failed to load saved foods:', error.message);
      return;
    }

    const mappedFoods: Food[] = (data ?? []).map((row: any) => ({
      id: String(row.id),
      name: row.name,
      caloriesPer100g: Number(row.calories_per_100g ?? 0),
      proteinPer100g: Number(row.protein_per_100g ?? 0),
      carbsPer100g: Number(row.carbs_per_100g ?? 0),
      fatPer100g: Number(row.fat_per_100g ?? 0),
    }));

    setCustomFoods(mappedFoods);
  }, []);

  const loadRecipes = useCallback(async () => {
    const { data, error } = await supabase
      .from('user_recipes')
      .select('id, name, servings, total_weight_grams, created_at')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Failed to load recipes:', error.message);
      return;
    }

    setRecipes((data ?? []) as Recipe[]);
  }, []);

  const loadScreen = useCallback(async () => {
    setLoading(true);

    try {
      await Promise.all([loadCustomFoods(), loadRecipes()]);
    } finally {
      setLoading(false);
    }
  }, [loadCustomFoods, loadRecipes]);

  useFocusEffect(
    useCallback(() => {
      loadScreen();
    }, [loadScreen]),
  );

  const openNewRecipe = () => {
    setEditingRecipeId(null);
    setRecipeName('');
    setServings('1');
    setCookedWeight('');
    setIngredients([]);
    setEditorVisible(true);
  };

  const openExistingRecipe = async (recipe: Recipe) => {
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('recipe_ingredients')
        .select(
          'id, food_name, quantity_grams, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g',
        )
        .eq('recipe_id', recipe.id)
        .order('created_at', { ascending: true });

      if (error) {
        showFeedback('Could not load recipe', error.message);
        return;
      }

      const loadedIngredients: RecipeIngredient[] = (data ?? []).map(
        (row: any) => ({
          id: String(row.id),
          food: {
            id: String(row.id),
            name: row.food_name,
            caloriesPer100g: Number(row.calories_per_100g ?? 0),
            proteinPer100g: Number(row.protein_per_100g ?? 0),
            carbsPer100g: Number(row.carbs_per_100g ?? 0),
            fatPer100g: Number(row.fat_per_100g ?? 0),
          },
          quantityGrams: String(row.quantity_grams ?? 0),
        }),
      );

      setEditingRecipeId(recipe.id);
      setRecipeName(recipe.name);
      setServings(String(recipe.servings || 1));
      setCookedWeight(String(recipe.total_weight_grams || ''));
      setIngredients(loadedIngredients);
      setEditorVisible(true);
    } catch (error: any) {
      showFeedback(
        'Could not load recipe',
        error?.message ?? 'An unexpected error occurred.',
      );
    } finally {
      setLoading(false);
    }
  };

  const openFoodPicker = () => {
    setFoodSearch('');
    setPickerMode('library');
    setDatabaseResults([]);
    setPickerVisible(true);
  };

  const addIngredient = (food: Food) => {
    const alreadyAdded = ingredients.some(
      (item) =>
        item.food.name.trim().toLowerCase() === food.name.trim().toLowerCase(),
    );

    if (alreadyAdded) {
      showFeedback(
        'Already added',
        `${food.name} is already in this recipe.`,
      );
      return;
    }

    setIngredients((previous) => [
      ...previous,
      { food, quantityGrams: '100' },
    ]);

    setPickerVisible(false);
    setFoodSearch('');
  };

  const updateIngredientQuantity = (index: number, value: string) => {
    setIngredients((previous) =>
      previous.map((item, i) =>
        i === index ? { ...item, quantityGrams: value } : item,
      ),
    );
  };

  const removeIngredient = (index: number) => {
    setIngredients((previous) => previous.filter((_, i) => i !== index));
  };

  const searchDatabase = async () => {
    const query = foodSearch.trim();

    if (!query) {
      showFeedback('Search for a food', 'Enter a food name first.');
      return;
    }

    Keyboard.dismiss();
    setSearchingDatabase(true);
    setDatabaseResults([]);

    try {
      const { data, error } = await supabase.functions.invoke('food-search', {
        body: { query },
      });

      if (error) {
        throw error;
      }

      const results: ApiFood[] = ((data?.foods ?? []) as ApiFood[])
        .filter(
          (food) =>
            food.nutritionComplete === true &&
            Number.isFinite(Number(food.caloriesPer100g)) &&
            Number.isFinite(Number(food.proteinPer100g)) &&
            Number.isFinite(Number(food.carbsPer100g)) &&
            Number.isFinite(Number(food.fatPer100g)),
        )
        .map((food) => ({
          ...food,
          id: String(food.id),
          name: food.name,
          caloriesPer100g: Number(food.caloriesPer100g),
          proteinPer100g: Number(food.proteinPer100g),
          carbsPer100g: Number(food.carbsPer100g),
          fatPer100g: Number(food.fatPer100g),
        }))
        .slice(0, 25);

      setDatabaseResults(results);

      if (results.length === 0) {
        showFeedback(
          'No complete results',
          'No foods with complete nutrition information were found. Try another search.',
        );
      }
    } catch (error: any) {
      console.error('Food database search failed:', error);

      showFeedback(
        'Search failed',
        error?.message ?? 'Could not search the food database.',
      );
    } finally {
      setSearchingDatabase(false);
    }
  };

  const saveDatabaseFoodToLibrary = async (food: ApiFood) => {
    setAddingFoodId(String(food.id));

    try {
      const { data: existing, error: lookupError } = await supabase
        .from('user_foods')
        .select('id')
        .ilike('name', food.name)
        .limit(1);

      if (lookupError) {
        throw lookupError;
      }

      let savedFood: Food = food;

      if (!existing || existing.length === 0) {
        const { data, error } = await supabase
          .from('user_foods')
          .insert({
            name: food.name,
            calories_per_100g: food.caloriesPer100g,
            protein_per_100g: food.proteinPer100g,
            carbs_per_100g: food.carbsPer100g,
            fat_per_100g: food.fatPer100g,
          })
          .select(
            'id, name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g',
          )
          .single();

        if (error) {
          throw error;
        }

        savedFood = {
          id: String(data.id),
          name: data.name,
          caloriesPer100g: Number(data.calories_per_100g),
          proteinPer100g: Number(data.protein_per_100g),
          carbsPer100g: Number(data.carbs_per_100g),
          fatPer100g: Number(data.fat_per_100g),
        };

        setCustomFoods((previous) => [...previous, savedFood]);
      }

      addIngredient(savedFood);
    } catch (error: any) {
      console.error('Could not save database food:', error);

      showFeedback(
        'Could not save food',
        error?.message ?? 'Please try again.',
      );
    } finally {
      setAddingFoodId(null);
    }
  };

  const nutrition = useMemo(() => {
    return ingredients.reduce(
      (totals, item) => {
        const grams = Math.max(0, Number(item.quantityGrams) || 0);
        const factor = grams / 100;

        totals.calories += item.food.caloriesPer100g * factor;
        totals.protein += item.food.proteinPer100g * factor;
        totals.carbs += item.food.carbsPer100g * factor;
        totals.fat += item.food.fatPer100g * factor;
        totals.weight += grams;

        return totals;
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0, weight: 0 },
    );
  }, [ingredients]);

  const servingCount = Math.max(1, Number(servings) || 1);

  const saveRecipe = async () => {
    if (saving) {
      return;
    }

    Keyboard.dismiss();

    const name = recipeName.trim();

    if (!name) {
      showFeedback('Missing recipe name', 'Enter a recipe name first.');
      return;
    }

    if (ingredients.length === 0) {
      showFeedback('No ingredients', 'Add at least one ingredient.');
      return;
    }

    const invalidIngredient = ingredients.some((item) => {
      const quantity = Number(item.quantityGrams);

      return (
        item.quantityGrams.trim() === '' ||
        !Number.isFinite(quantity) ||
        quantity <= 0
      );
    });

    if (invalidIngredient) {
      showFeedback(
        'Invalid quantity',
        'Every ingredient needs a quantity greater than zero.',
      );
      return;
    }

    setSaving(true);

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError) {
        throw authError;
      }

      const user = authData.user;

      if (!user) {
        throw new Error('You are not signed in. Please sign in again.');
      }

      const totalWeight =
        Number(cookedWeight) > 0 ? Number(cookedWeight) : nutrition.weight;

      let recipeId = editingRecipeId;

      if (recipeId) {
        const { data: updatedRecipe, error } = await supabase
          .from('user_recipes')
          .update({
            name,
            servings: servingCount,
            total_weight_grams: totalWeight,
            updated_at: new Date().toISOString(),
          })
          .eq('id', recipeId)
          .eq('user_id', user.id)
          .select('id')
          .maybeSingle();

        if (error) {
          throw error;
        }

        if (!updatedRecipe) {
          throw new Error(
            'The recipe was not updated. Check database permissions and recipe ownership.',
          );
        }

        const { error: deleteError } = await supabase
          .from('recipe_ingredients')
          .delete()
          .eq('recipe_id', recipeId)
          .eq('user_id', user.id);

        if (deleteError) {
          throw deleteError;
        }
      } else {
        const { data, error } = await supabase
          .from('user_recipes')
          .insert({
            user_id: user.id,
            name,
            servings: servingCount,
            total_weight_grams: totalWeight,
          })
          .select('id')
          .single();

        if (error) {
          throw error;
        }

        if (!data?.id) {
          throw new Error('Supabase did not return the new recipe ID.');
        }

        recipeId = data.id;
      }

      const ingredientRows = ingredients.map((item) => ({
        user_id: user.id,
        recipe_id: recipeId,
        food_name: item.food.name,
        quantity_grams: Number(item.quantityGrams),
        calories_per_100g: Number(item.food.caloriesPer100g),
        protein_per_100g: Number(item.food.proteinPer100g),
        carbs_per_100g: Number(item.food.carbsPer100g),
        fat_per_100g: Number(item.food.fatPer100g),
      }));

      const { error: ingredientError } = await supabase
        .from('recipe_ingredients')
        .insert(ingredientRows);

      if (ingredientError) {
        throw ingredientError;
      }

      const { data: refreshedRecipes, error: refreshError } = await supabase
        .from('user_recipes')
        .select('id, name, servings, total_weight_grams, created_at')
        .order('updated_at', { ascending: false });

      if (refreshError) {
        console.error('Recipe saved, but list refresh failed:', refreshError);
      } else {
        setRecipes((refreshedRecipes ?? []) as Recipe[]);
      }

      showFeedback(
        'Recipe saved!',
        `"${name}" has been saved successfully.`,
        true,
      );
    } catch (error: any) {
      console.error('SAVE RECIPE ERROR:', error);

      const details = [
        error?.message,
        error?.details,
        error?.hint,
        error?.code ? `Code: ${error.code}` : null,
      ]
        .filter(Boolean)
        .join('\n\n');

      showFeedback(
        'Could not save recipe',
        details || 'An unexpected error occurred while saving.',
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteRecipe = (recipe: Recipe) => {
    Alert.alert('Delete recipe?', `Delete "${recipe.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const { data: authData, error: authError } =
              await supabase.auth.getUser();

            if (authError) {
              throw authError;
            }

            const user = authData.user;

            if (!user) {
              throw new Error('You must be signed in.');
            }

            const { error } = await supabase
              .from('user_recipes')
              .delete()
              .eq('id', recipe.id)
              .eq('user_id', user.id);

            if (error) {
              throw error;
            }

            await loadRecipes();
          } catch (error: any) {
            showFeedback(
              'Could not delete recipe',
              error?.message ?? 'Please try again.',
            );
          }
        },
      },
    ]);
  };

  const filteredFoods = useMemo(() => {
    const query = foodSearch.trim().toLowerCase();

    if (!query) {
      return allFoods;
    }

    return allFoods.filter((food) =>
      food.name.toLowerCase().includes(query),
    );
  }, [allFoods, foodSearch]);

  const renderFood = (food: Food) => (
    <TouchableOpacity
      key={`${food.id}-${food.name}`}
      style={styles.foodRow}
      onPress={() => addIngredient(food)}
    >
      <View style={styles.foodInfo}>
        <Text style={styles.foodName}>{food.name}</Text>
        <Text style={styles.mutedText}>
          {Math.round(food.caloriesPer100g)} kcal · P{' '}
          {food.proteinPer100g.toFixed(1)}g · C{' '}
          {food.carbsPer100g.toFixed(1)}g · F {food.fatPer100g.toFixed(1)}g
          {' / 100g'}
        </Text>
      </View>
      <Text style={styles.addSymbol}>+</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.green} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Recipes</Text>
          <Text style={styles.subtitle}>
            Create recipes and calculate their nutrition
          </Text>
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={openNewRecipe}>
          <Text style={styles.primaryButtonText}>+ Create</Text>
        </TouchableOpacity>
      </View>

      {recipes.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No recipes yet</Text>
          <Text style={[styles.mutedText, styles.centerText]}>
            Create a recipe and add ingredients from your Food Library.
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={openNewRecipe}
          >
            <Text style={styles.primaryButtonText}>
              Create your first recipe
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={recipes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.recipeList}
          renderItem={({ item }) => (
            <View style={styles.recipeCard}>
              <TouchableOpacity
                style={styles.recipeMain}
                onPress={() => openExistingRecipe(item)}
              >
                <Text style={styles.recipeName}>{item.name}</Text>
                <Text style={styles.mutedText}>
                  {item.servings} {item.servings === 1 ? 'serving' : 'servings'}
                  {item.total_weight_grams > 0
                    ? ` · ${item.total_weight_grams}g total`
                    : ''}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => deleteRecipe(item)}
                style={styles.deleteButton}
              >
                <Text style={styles.deleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      {/* Recipe editor */}
      <Modal
        visible={editorVisible}
        animationType="slide"
        onRequestClose={() => {
          if (!saving && !feedbackVisible) {
            setEditorVisible(false);
          }
        }}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              disabled={saving}
              onPress={() => setEditorVisible(false)}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>

            <Text style={styles.modalTitle}>
              {editingRecipeId ? 'Edit Recipe' : 'New Recipe'}
            </Text>

            <TouchableOpacity
              disabled={saving}
              onPress={saveRecipe}
              style={[
                styles.saveCloseButton,
                saving && styles.disabledButton,
              ]}
              activeOpacity={0.7}
            >
              {saving ? (
                <ActivityIndicator color={COLORS.background} size="small" />
              ) : (
                <Text style={styles.saveCloseButtonText}>Save & Close</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.editorContent}
          >
            <Text style={styles.fieldLabel}>Recipe name</Text>
            <TextInput
              style={styles.input}
              value={recipeName}
              onChangeText={setRecipeName}
              placeholder="e.g. Chicken and rice"
              placeholderTextColor={COLORS.muted}
            />

            <View style={styles.twoColumns}>
              <View style={styles.halfColumn}>
                <Text style={styles.fieldLabel}>Servings</Text>
                <TextInput
                  style={styles.input}
                  value={servings}
                  onChangeText={setServings}
                  keyboardType="number-pad"
                  placeholder="1"
                  placeholderTextColor={COLORS.muted}
                />
              </View>

              <View style={styles.halfColumn}>
                <Text style={styles.fieldLabel}>Cooked weight (g)</Text>
                <TextInput
                  style={styles.input}
                  value={cookedWeight}
                  onChangeText={setCookedWeight}
                  keyboardType="decimal-pad"
                  placeholder={`Default ${Math.round(nutrition.weight)}g`}
                  placeholderTextColor={COLORS.muted}
                />
              </View>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                Ingredients ({ingredients.length})
              </Text>
              <TouchableOpacity
                style={styles.smallPrimaryButton}
                onPress={openFoodPicker}
              >
                <Text style={styles.primaryButtonText}>+ Add food</Text>
              </TouchableOpacity>
            </View>

            {ingredients.length === 0 ? (
              <Text style={styles.emptyIngredients}>
                No ingredients yet. Tap “Add food” to choose from your Food
                Library.
              </Text>
            ) : (
              ingredients.map((item, index) => {
                const grams = Math.max(0, Number(item.quantityGrams) || 0);
                const calories = (item.food.caloriesPer100g * grams) / 100;

                return (
                  <View
                    key={`${item.food.name}-${index}`}
                    style={styles.ingredientCard}
                  >
                    <View style={styles.ingredientTop}>
                      <View style={styles.foodInfo}>
                        <Text style={styles.foodName}>{item.food.name}</Text>
                        <Text style={styles.mutedText}>
                          {Math.round(calories)} kcal
                        </Text>
                      </View>

                      <TouchableOpacity
                        onPress={() => removeIngredient(index)}
                      >
                        <Text style={styles.removeText}>Remove</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.quantityRow}>
                      <Text style={styles.mutedText}>Quantity (g)</Text>
                      <TextInput
                        style={styles.quantityInput}
                        value={item.quantityGrams}
                        onChangeText={(value) =>
                          updateIngredientQuantity(index, value)
                        }
                        keyboardType="decimal-pad"
                        selectTextOnFocus
                      />
                    </View>
                  </View>
                );
              })
            )}

            <Text style={styles.sectionTitle}>Recipe nutrition</Text>

            <View style={styles.nutritionCard}>
              <NutritionRow
                label="Calories"
                value={`${Math.round(nutrition.calories)} kcal`}
              />
              <NutritionRow
                label="Protein"
                value={`${nutrition.protein.toFixed(1)} g`}
              />
              <NutritionRow
                label="Carbohydrates"
                value={`${nutrition.carbs.toFixed(1)} g`}
              />
              <NutritionRow
                label="Fat"
                value={`${nutrition.fat.toFixed(1)} g`}
              />

              <View style={styles.nutritionDivider} />

              <Text style={styles.perServingTitle}>
                Per serving ({servingCount} total)
              </Text>
              <NutritionRow
                label="Calories"
                value={`${Math.round(nutrition.calories / servingCount)} kcal`}
              />
              <NutritionRow
                label="Protein"
                value={`${(nutrition.protein / servingCount).toFixed(1)} g`}
              />
              <NutritionRow
                label="Carbohydrates"
                value={`${(nutrition.carbs / servingCount).toFixed(1)} g`}
              />
              <NutritionRow
                label="Fat"
                value={`${(nutrition.fat / servingCount).toFixed(1)} g`}
              />
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Ingredient picker */}
      <Modal
        visible={pickerVisible}
        animationType="slide"
        onRequestClose={() => setPickerVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setPickerVisible(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>

            <Text style={styles.modalTitle}>Add ingredient</Text>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.pickerContent}>
            <View style={styles.modeRow}>
              <TouchableOpacity
                style={[
                  styles.modeButton,
                  pickerMode === 'library' && styles.modeButtonActive,
                ]}
                onPress={() => setPickerMode('library')}
              >
                <Text
                  style={[
                    styles.modeText,
                    pickerMode === 'library' && styles.modeTextActive,
                  ]}
                >
                  My Foods ({allFoods.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modeButton,
                  pickerMode === 'database' && styles.modeButtonActive,
                ]}
                onPress={() => setPickerMode('database')}
              >
                <Text
                  style={[
                    styles.modeText,
                    pickerMode === 'database' && styles.modeTextActive,
                  ]}
                >
                  Search Database
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.searchRow}>
              <TextInput
                style={[styles.input, styles.searchInput]}
                value={foodSearch}
                onChangeText={setFoodSearch}
                placeholder={
                  pickerMode === 'library'
                    ? 'Filter your foods...'
                    : 'Search database...'
                }
                placeholderTextColor={COLORS.muted}
                returnKeyType="search"
                onSubmitEditing={
                  pickerMode === 'database' ? searchDatabase : undefined
                }
              />

              {pickerMode === 'database' && (
                <TouchableOpacity
                  style={styles.searchButton}
                  onPress={searchDatabase}
                  disabled={searchingDatabase}
                >
                  {searchingDatabase ? (
                    <ActivityIndicator color={COLORS.background} />
                  ) : (
                    <Text style={styles.searchButtonText}>Search</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>

            {pickerMode === 'library' ? (
              <>
                <Text style={styles.pickerHint}>
                  Built-in foods and foods saved to your library appear here.
                </Text>

                {filteredFoods.length === 0 ? (
                  <View style={styles.noFoods}>
                    <Text style={styles.foodName}>No matching foods</Text>
                    <Text style={styles.mutedText}>
                      Try another search or use Search Database.
                    </Text>
                  </View>
                ) : (
                  <FlatList
                    data={filteredFoods}
                    keyExtractor={(item, index) =>
                      `${item.id}-${item.name}-${index}`
                    }
                    keyboardShouldPersistTaps="handled"
                    renderItem={({ item }) => renderFood(item)}
                  />
                )}
              </>
            ) : (
              <>
                <Text style={styles.pickerHint}>
                  Search for foods with complete nutrition information.
                </Text>

                {searchingDatabase ? (
                  <ActivityIndicator
                    style={styles.searchLoader}
                    size="large"
                    color={COLORS.green}
                  />
                ) : (
                  <FlatList
                    data={databaseResults}
                    keyExtractor={(item, index) =>
                      `${item.id}-${item.name}-${index}`
                    }
                    keyboardShouldPersistTaps="handled"
                    ListEmptyComponent={
                      <View style={styles.noFoods}>
                        <Text style={styles.mutedText}>
                          Search for a food to see results here.
                        </Text>
                      </View>
                    }
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.foodRow}
                        onPress={() => saveDatabaseFoodToLibrary(item)}
                        disabled={addingFoodId === String(item.id)}
                      >
                        <View style={styles.foodInfo}>
                          <Text style={styles.foodName}>{item.name}</Text>
                          <Text style={styles.mutedText}>
                            {Math.round(item.caloriesPer100g)} kcal · P{' '}
                            {item.proteinPer100g.toFixed(1)}g · C{' '}
                            {item.carbsPer100g.toFixed(1)}g · F{' '}
                            {item.fatPer100g.toFixed(1)}g / 100g
                          </Text>
                          <Text style={styles.sourceText}>
                            Tap to save to My Foods and add
                          </Text>
                        </View>

                        {addingFoodId === String(item.id) ? (
                          <ActivityIndicator color={COLORS.green} />
                        ) : (
                          <Text style={styles.addSymbol}>+</Text>
                        )}
                      </TouchableOpacity>
                    )}
                  />
                )}
              </>
            )}
          </View>
        </SafeAreaView>
      </Modal>

      {/* Custom feedback modal — deliberately rendered after the other modals. */}
      <Modal
        visible={feedbackVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={dismissFeedback}
      >
        <View style={styles.feedbackOverlay}>
          <View style={styles.feedbackCard}>
            <View
              style={[
                styles.feedbackIcon,
                feedbackSuccess
                  ? styles.feedbackIconSuccess
                  : styles.feedbackIconError,
              ]}
            >
              <Text
                style={[
                  styles.feedbackIconText,
                  !feedbackSuccess && styles.feedbackIconTextError,
                ]}
              >
                {feedbackSuccess ? '✓' : '!'}
              </Text>
            </View>

            <Text style={styles.feedbackTitle}>{feedbackTitle}</Text>

            <Text style={styles.feedbackMessage}>{feedbackMessage}</Text>

            <TouchableOpacity
              style={styles.feedbackButton}
              onPress={dismissFeedback}
              activeOpacity={0.8}
            >
              <Text style={styles.feedbackButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function NutritionRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.nutritionRow}>
      <Text style={styles.mutedText}>{label}</Text>
      <Text style={styles.nutritionValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerText: {
    flex: 1,
    paddingRight: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.text,
  },
  subtitle: {
    color: COLORS.muted,
    fontSize: 13,
    marginTop: 5,
  },
  primaryButton: {
    backgroundColor: COLORS.green,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: COLORS.background,
    fontWeight: '700',
    fontSize: 13,
  },
  recipeList: {
    paddingHorizontal: 16,
    paddingBottom: 30,
  },
  recipeCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  recipeMain: {
    flex: 1,
  },
  recipeName: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 5,
  },
  deleteButton: {
    padding: 8,
  },
  deleteText: {
    color: COLORS.danger,
    fontSize: 13,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
    gap: 14,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 21,
    fontWeight: '700',
  },
  centerText: {
    textAlign: 'center',
  },
  mutedText: {
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  modalHeader: {
    paddingHorizontal: 18,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 62,
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '700',
  },
  cancelText: {
    color: COLORS.muted,
    fontSize: 14,
  },
  saveCloseButton: {
    backgroundColor: COLORS.green,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 9,
    minWidth: 105,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveCloseButtonText: {
    color: COLORS.background,
    fontWeight: '700',
    fontSize: 13,
  },
  disabledButton: {
    opacity: 0.6,
  },
  headerSpacer: {
    width: 45,
  },
  editorContent: {
    padding: 18,
    paddingBottom: 40,
  },
  fieldLabel: {
    color: COLORS.muted,
    fontSize: 13,
    marginBottom: 8,
    marginTop: 10,
  },
  input: {
    backgroundColor: COLORS.input,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingVertical: 12,
    color: COLORS.text,
    fontSize: 15,
  },
  twoColumns: {
    flexDirection: 'row',
    gap: 12,
  },
  halfColumn: {
    flex: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 28,
    marginBottom: 12,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 12,
  },
  smallPrimaryButton: {
    backgroundColor: COLORS.green,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 9,
  },
  emptyIngredients: {
    color: COLORS.muted,
    padding: 18,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    lineHeight: 20,
  },
  ingredientCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 13,
    marginBottom: 9,
  },
  ingredientTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  foodInfo: {
    flex: 1,
    paddingRight: 10,
  },
  foodName: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 5,
  },
  removeText: {
    color: COLORS.danger,
    fontSize: 12,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  quantityInput: {
    backgroundColor: COLORS.input,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    minWidth: 90,
    paddingVertical: 8,
    paddingHorizontal: 10,
    textAlign: 'right',
  },
  nutritionCard: {
    backgroundColor: COLORS.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  nutritionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  nutritionValue: {
    color: COLORS.text,
    fontWeight: '600',
    fontSize: 13,
  },
  nutritionDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 12,
  },
  perServingTitle: {
    color: COLORS.green,
    fontWeight: '700',
    marginBottom: 6,
  },
  pickerContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  modeRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    padding: 4,
    borderRadius: 11,
    marginBottom: 12,
  },
  modeButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 11,
    borderRadius: 8,
  },
  modeButtonActive: {
    backgroundColor: COLORS.green,
  },
  modeText: {
    color: COLORS.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  modeTextActive: {
    color: COLORS.background,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
  },
  searchButton: {
    backgroundColor: COLORS.green,
    paddingHorizontal: 13,
    paddingVertical: 13,
    borderRadius: 10,
    minWidth: 72,
    alignItems: 'center',
  },
  searchButtonText: {
    color: COLORS.background,
    fontWeight: '700',
  },
  pickerHint: {
    color: COLORS.muted,
    fontSize: 12,
    marginVertical: 12,
  },
  foodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    padding: 14,
    borderRadius: 11,
    marginBottom: 8,
  },
  addSymbol: {
    color: COLORS.green,
    fontSize: 27,
    fontWeight: '500',
    paddingHorizontal: 5,
  },
  noFoods: {
    alignItems: 'center',
    padding: 25,
    gap: 8,
  },
  sourceText: {
    color: COLORS.green,
    fontSize: 11,
    marginTop: 5,
  },
  searchLoader: {
    marginTop: 24,
  },
  feedbackOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  feedbackCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#202020',
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  feedbackIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  feedbackIconSuccess: {
    backgroundColor: 'rgba(114, 214, 160, 0.15)',
  },
  feedbackIconError: {
    backgroundColor: 'rgba(255, 119, 119, 0.15)',
  },
  feedbackIconText: {
    color: COLORS.green,
    fontSize: 30,
    fontWeight: '700',
  },
  feedbackIconTextError: {
    color: COLORS.danger,
  },
  feedbackTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 10,
  },
  feedbackMessage: {
    color: '#D0D0D0',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 22,
  },
  feedbackButton: {
    width: '100%',
    backgroundColor: COLORS.green,
    borderRadius: 11,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedbackButtonText: {
    color: COLORS.background,
    fontSize: 15,
    fontWeight: '700',
  },
});
