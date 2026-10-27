import React, { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { supabase } from '../services/supabase';
import { starterFoods } from '../services/foodService';
import { Food, Meal } from '../types/Food';

type CustomFoodRow = {
  id: string;
  name: string;
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
};

type ApiFood = Food & {
  source: 'usda' | 'openfoodfacts';
  nutritionComplete: boolean;
};

type OpenFoodFactsProduct = {
  status?: number;
  product?: {
    product_name?: string;
    brands?: string;
    nutriments?: Record<string, unknown>;
  };
};

function getTodayDate(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function FoodLibraryScreen() {
  const [searchText, setSearchText] = useState('');
  const [searchMode, setSearchMode] = useState(false);
  const [databaseFoods, setDatabaseFoods] = useState<ApiFood[]>([]);
  const [searchingDatabase, setSearchingDatabase] = useState(false);
  const [databaseWarning, setDatabaseWarning] = useState('');
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [quantity, setQuantity] = useState('');
  const [selectedMeal, setSelectedMeal] = useState<Meal>('Breakfast');
  const [customFoods, setCustomFoods] = useState<Food[]>([]);
  const [loadingFoods, setLoadingFoods] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingApiFoodId, setSavingApiFoodId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newFoodName, setNewFoodName] = useState('');
  const [newCalories, setNewCalories] = useState('');
  const [newProtein, setNewProtein] = useState('');
  const [newCarbs, setNewCarbs] = useState('');
  const [newFat, setNewFat] = useState('');
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [barcodeLookupLoading, setBarcodeLookupLoading] = useState(false);
  const [barcodeScanned, setBarcodeScanned] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const loadCustomFoods = async () => {
    setLoadingFoods(true);

    const { data, error } = await supabase
      .from('user_foods')
      .select(
        'id, name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g'
      )
      .order('name', { ascending: true });

    if (error) {
      Alert.alert('Could not load saved foods', error.message);
      setLoadingFoods(false);
      return;
    }

    const mappedFoods: Food[] = ((data ?? []) as CustomFoodRow[]).map(
      (item) =>
        ({
          id: item.id,
          name: item.name,
          caloriesPer100g: Number(item.calories_per_100g),
          proteinPer100g: Number(item.protein_per_100g),
          carbsPer100g: Number(item.carbs_per_100g),
          fatPer100g: Number(item.fat_per_100g),
        }) as Food
    );

    setCustomFoods(mappedFoods);
    setLoadingFoods(false);
  };

  useFocusEffect(
    useCallback(() => {
      void loadCustomFoods();
    }, [])
  );

  const allFoods = useMemo(
    () => [...starterFoods, ...customFoods],
    [customFoods]
  );

  const filteredFoods = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    return allFoods.filter((food) =>
      food.name.toLowerCase().includes(query)
    );
  }, [allFoods, searchText]);

  const quantityNumber = Number(quantity) || 0;

  const calculatedCalories =
    ((selectedFood?.caloriesPer100g ?? 0) * quantityNumber) / 100;

  const calculatedProtein =
    ((selectedFood?.proteinPer100g ?? 0) * quantityNumber) / 100;

  const calculatedCarbs =
    ((selectedFood?.carbsPer100g ?? 0) * quantityNumber) / 100;

  const calculatedFat =
    ((selectedFood?.fatPer100g ?? 0) * quantityNumber) / 100;

  const openFood = (food: Food) => {
    setSelectedFood(food);
    setQuantity('');
    setSelectedMeal('Breakfast');
  };

  const closeModal = () => {
    if (saving || savingApiFoodId !== null) return;

    Keyboard.dismiss();
    setSelectedFood(null);
    setQuantity('');
  };

  const resetCreateForm = () => {
    setNewFoodName('');
    setNewCalories('');
    setNewProtein('');
    setNewCarbs('');
    setNewFat('');
  };

  const closeCreateModal = () => {
    if (saving) return;

    Keyboard.dismiss();
    setShowCreateModal(false);
    resetCreateForm();
  };

  const saveCustomFood = async () => {
    const foodName = newFoodName.trim();
    const calories = Number(newCalories);
    const protein = Number(newProtein || 0);
    const carbs = Number(newCarbs || 0);
    const fat = Number(newFat || 0);

    if (!foodName || !newCalories.trim()) {
      Alert.alert(
        'Missing details',
        'Enter a food name and its calories per 100 g.'
      );
      return;
    }

    if (
      [calories, protein, carbs, fat].some(
        (value) => !Number.isFinite(value) || value < 0
      )
    ) {
      Alert.alert(
        'Invalid nutrition',
        'Nutrition values must be valid numbers greater than or equal to zero.'
      );
      return;
    }

    setSaving(true);
    Keyboard.dismiss();

    try {
      const { error } = await supabase.from('user_foods').insert({
        name: foodName,
        calories_per_100g: calories,
        protein_per_100g: protein,
        carbs_per_100g: carbs,
        fat_per_100g: fat,
      });

      if (error) {
        Alert.alert('Could not save food', error.message);
        return;
      }

      await loadCustomFoods();
      setShowCreateModal(false);
      resetCreateForm();

      Alert.alert(
        'Food saved',
        `${foodName} was added to your food library.`
      );
    } catch (error) {
      Alert.alert(
        'Could not save food',
        error instanceof Error ? error.message : 'Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  // Saves foods from database search or the barcode scanner to My Foods.
  const saveFoodToLibrary = async (food: Food) => {
    const foodName = food.name.trim();

    if (!foodName) {
      Alert.alert('Invalid food', 'This food does not have a valid name.');
      return;
    }

    const alreadySaved = customFoods.some(
      (savedFood) =>
        savedFood.name.trim().toLowerCase() === foodName.toLowerCase()
    );

    if (alreadySaved) {
      Alert.alert(
        'Already saved',
        `${foodName} is already in My Foods.`
      );
      return;
    }

    const saveKey = String(food.id);
    setSavingApiFoodId(saveKey);

    try {
      const { error } = await supabase.from('user_foods').insert({
        name: foodName,
        calories_per_100g: Number(food.caloriesPer100g),
        protein_per_100g: Number(food.proteinPer100g),
        carbs_per_100g: Number(food.carbsPer100g),
        fat_per_100g: Number(food.fatPer100g),
      });

      if (error) {
        throw new Error(error.message);
      }

      await loadCustomFoods();

      Alert.alert(
        'Food saved',
        `${foodName} was added to My Foods.`
      );
    } catch (error) {
      Alert.alert(
        'Could not save food',
        error instanceof Error ? error.message : 'Please try again.'
      );
    } finally {
      setSavingApiFoodId(null);
    }
  };

  const searchDatabase = async () => {
    const query = searchText.trim();

    if (query.length < 2) {
      Alert.alert(
        'Search term too short',
        'Enter at least two characters to search.'
      );
      return;
    }

    Keyboard.dismiss();
    setSearchingDatabase(true);
    setDatabaseWarning('');
    setDatabaseFoods([]);

    try {
      const { data, error } = await supabase.functions.invoke(
        'food-search',
        {
          body: { query },
        }
      );

      if (error) {
        throw new Error(error.message);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      const apiResults = (data?.foods ?? []) as ApiFood[];

      const results: ApiFood[] = apiResults
        .filter(
          (food) =>
            food.nutritionComplete === true &&
            Number.isFinite(Number(food.caloriesPer100g)) &&
            Number.isFinite(Number(food.proteinPer100g)) &&
            Number.isFinite(Number(food.carbsPer100g)) &&
            Number.isFinite(Number(food.fatPer100g))
        )
        .map((food) => ({
          id: food.id,
          name: food.name,
          caloriesPer100g: Number(food.caloriesPer100g),
          proteinPer100g: Number(food.proteinPer100g),
          carbsPer100g: Number(food.carbsPer100g),
          fatPer100g: Number(food.fatPer100g),
          source: food.source,
          nutritionComplete: food.nutritionComplete,
        }));

      setDatabaseFoods(results);

      const incompleteCount = apiResults.length - results.length;
      const warnings: string[] = [];

      if (incompleteCount > 0) {
        warnings.push(
          `${incompleteCount} results with incomplete nutrition were excluded.`
        );
      }

      if (data?.warnings?.length) {
        warnings.push(...data.warnings);
      }

      if (results.length === 0 && warnings.length === 0) {
        warnings.push(
          'No foods with complete nutrition were found. Try another search.'
        );
      }

      setDatabaseWarning(warnings.join(' '));
    } catch (error) {
      Alert.alert(
        'Food search failed',
        error instanceof Error ? error.message : 'Please try again.'
      );
    } finally {
      setSearchingDatabase(false);
    }
  };

  const addToDiary = async () => {
    if (!selectedFood) return;

    const grams = Number(quantity);

    if (
      !quantity.trim() ||
      !Number.isFinite(grams) ||
      grams <= 0
    ) {
      Alert.alert(
        'Invalid quantity',
        'Please enter an amount in grams greater than zero.'
      );
      return;
    }

    setSaving(true);
    Keyboard.dismiss();

    try {
      const { error } = await supabase.from('food_logs').insert({
        food_id: String(selectedFood.id),
        food_name: selectedFood.name,
        calories_per_100g: selectedFood.caloriesPer100g,
        protein_per_100g: selectedFood.proteinPer100g,
        carbs_per_100g: selectedFood.carbsPer100g,
        fat_per_100g: selectedFood.fatPer100g,
        quantity_grams: grams,
        meal: selectedMeal,
        date: getTodayDate(),
      });

      if (error) {
        Alert.alert('Could not add food', error.message);
        return;
      }

      const addedFoodName = selectedFood.name;

      setSelectedFood(null);
      setQuantity('');

      Alert.alert(
        'Added to diary',
        `${addedFoodName} (${grams} g) was added to ${selectedMeal}.`
      );
    } catch (error) {
      Alert.alert(
        'Could not add food',
        error instanceof Error ? error.message : 'Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  const openBarcodeScanner = async () => {
    try {
      if (!cameraPermission?.granted) {
        const permission = await requestCameraPermission();

        if (!permission.granted) {
          Alert.alert(
            'Camera permission required',
            'Allow camera access in your phone settings to scan food barcodes.'
          );
          return;
        }
      }

      setBarcodeScanned(false);
      setBarcodeLookupLoading(false);
      setShowBarcodeScanner(true);
    } catch (error) {
      Alert.alert(
        'Could not open camera',
        error instanceof Error ? error.message : 'Please try again.'
      );
    }
  };

  const handleBarcodeScanned = async ({
    data,
  }: {
    data: string;
  }) => {
    if (barcodeScanned || barcodeLookupLoading) return;

    setBarcodeScanned(true);
    setBarcodeLookupLoading(true);

    try {
      const response = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(
          data
        )}.json?fields=code,product_name,brands,nutriments`
      );

      if (!response.ok) {
        throw new Error('Could not contact the food database.');
      }

      const result = (await response.json()) as OpenFoodFactsProduct;

      if (result.status !== 1 || !result.product) {
        Alert.alert(
          'Product not found',
          'This barcode was not found. You can try again or search for the food manually.',
          [
            {
              text: 'Try Again',
              onPress: () => setBarcodeScanned(false),
            },
            {
              text: 'Close Scanner',
              onPress: () => setShowBarcodeScanner(false),
            },
          ]
        );
        return;
      }

      const product = result.product;
      const nutrients = product.nutriments ?? {};

      const energyKcal = nutrients['energy-kcal_100g'];
      const energyKj = nutrients['energy_100g'];

      const calories =
        typeof energyKcal === 'number' && Number.isFinite(energyKcal)
          ? energyKcal
          : typeof energyKj === 'number' && Number.isFinite(energyKj)
            ? energyKj / 4.184
            : null;

      const protein = nutrients['proteins_100g'];
      const carbs = nutrients['carbohydrates_100g'];
      const fat = nutrients['fat_100g'];

      if (
        !product.product_name?.trim() ||
        calories === null ||
        !Number.isFinite(calories) ||
        typeof protein !== 'number' ||
        !Number.isFinite(protein) ||
        typeof carbs !== 'number' ||
        !Number.isFinite(carbs) ||
        typeof fat !== 'number' ||
        !Number.isFinite(fat)
      ) {
        Alert.alert(
          'Nutrition unavailable',
          'This product does not have complete nutrition information. Try searching for it manually instead.',
          [
            {
              text: 'Try Again',
              onPress: () => setBarcodeScanned(false),
            },
            {
              text: 'Close Scanner',
              onPress: () => setShowBarcodeScanner(false),
            },
          ]
        );
        return;
      }

      const brand = product.brands?.trim();

      const scannedFood = {
        id: `off:${data}`,
        name: brand
          ? `${product.product_name} (${brand})`
          : product.product_name,
        caloriesPer100g: calories,
        proteinPer100g: protein,
        carbsPer100g: carbs,
        fatPer100g: fat,
      } as Food;

      setShowBarcodeScanner(false);
      openFood(scannedFood);
    } catch (error) {
      Alert.alert(
        'Barcode lookup failed',
        error instanceof Error
          ? error.message
          : 'Please check your internet connection and try again.',
        [
          {
            text: 'Try Again',
            onPress: () => setBarcodeScanned(false),
          },
          {
            text: 'Close Scanner',
            onPress: () => setShowBarcodeScanner(false),
          },
        ]
      );
    } finally {
      setBarcodeLookupLoading(false);
    }
  };

  const renderFood = ({ item }: { item: Food }) => {
    const apiFood = item as Partial<ApiFood>;

    const isApiFood =
      apiFood.source === 'usda' ||
      apiFood.source === 'openfoodfacts';

    const isSaved = customFoods.some(
      (savedFood) =>
        savedFood.name.trim().toLowerCase() ===
        item.name.trim().toLowerCase()
    );

    const isSavingThisFood =
      savingApiFoodId === String(item.id);

    return (
      <View style={styles.foodCard}>
        <TouchableOpacity onPress={() => openFood(item)}>
          <Text style={styles.foodName}>{item.name}</Text>

          {isApiFood && (
            <Text style={styles.sourceText}>
              {apiFood.source === 'usda'
                ? 'USDA FoodData Central'
                : 'Open Food Facts'}
            </Text>
          )}

          <Text style={styles.nutrition}>
            {item.caloriesPer100g} kcal / 100 g
          </Text>

          <Text style={styles.macros}>
            Protein {item.proteinPer100g} g • Carbs{' '}
            {item.carbsPer100g} g • Fat {item.fatPer100g} g
          </Text>
        </TouchableOpacity>

        {isApiFood && (
          <TouchableOpacity
            style={[
              styles.saveApiFoodButton,
              isSaved && styles.savedApiFoodButton,
              isSavingThisFood && styles.disabledButton,
            ]}
            onPress={() => void saveFoodToLibrary(item)}
            disabled={isSaved || savingApiFoodId !== null}
          >
            {isSavingThisFood ? (
              <ActivityIndicator color="#72D6A0" />
            ) : (
              <Text
                style={[
                  styles.saveApiFoodButtonText,
                  isSaved && styles.savedApiFoodButtonText,
                ]}
              >
                {isSaved
                  ? '✓ Saved to My Foods'
                  : '+ Save to My Foods'}
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const displayedFoods = searchMode
    ? databaseFoods
    : filteredFoods;

  const selectedFoodIsSaved = selectedFood
    ? customFoods.some(
        (food) =>
          food.name.trim().toLowerCase() ===
          selectedFood.name.trim().toLowerCase()
      )
    : false;

  const selectedFoodIsSaving = selectedFood
    ? savingApiFoodId === String(selectedFood.id)
    : false;

  const selectedFoodCanBeSaved =
    selectedFood !== null &&
    (String(selectedFood.id).startsWith('off:') ||
      (selectedFood as Partial<ApiFood>).source === 'usda' ||
      (selectedFood as Partial<ApiFood>).source === 'openfoodfacts');

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Food Library</Text>

      <TouchableOpacity
        style={styles.createButton}
        onPress={() => setShowCreateModal(true)}
      >
        <Text style={styles.createButtonText}>
          + Add Food to Library
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.scanBarcodeButton}
        onPress={openBarcodeScanner}
      >
        <Text style={styles.scanBarcodeButtonText}>
          ▦ Scan Barcode
        </Text>
      </TouchableOpacity>

      <View style={styles.modeContainer}>
        <TouchableOpacity
          style={[
            styles.modeButton,
            !searchMode && styles.activeModeButton,
          ]}
          onPress={() => setSearchMode(false)}
        >
          <Text
            style={[
              styles.modeText,
              !searchMode && styles.activeModeText,
            ]}
          >
            My Foods
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.modeButton,
            searchMode && styles.activeModeButton,
          ]}
          onPress={() => setSearchMode(true)}
        >
          <Text
            style={[
              styles.modeText,
              searchMode && styles.activeModeText,
            ]}
          >
            Search Database
          </Text>
        </TouchableOpacity>
      </View>

      <TextInput
        style={styles.searchInput}
        placeholder={
          searchMode
            ? 'Search chicken, oats, yoghurt...'
            : 'Search your saved foods...'
        }
        placeholderTextColor="#777777"
        value={searchText}
        onChangeText={setSearchText}
        autoCorrect={false}
        returnKeyType={searchMode ? 'search' : 'done'}
        onSubmitEditing={() => {
          if (searchMode) void searchDatabase();
        }}
      />

      {searchMode && (
        <TouchableOpacity
          style={[
            styles.createButton,
            searchingDatabase && styles.disabledButton,
          ]}
          onPress={searchDatabase}
          disabled={searchingDatabase}
        >
          {searchingDatabase ? (
            <ActivityIndicator color="#111111" />
          ) : (
            <Text style={styles.createButtonText}>
              Search Food Database
            </Text>
          )}
        </TouchableOpacity>
      )}

      {searchMode && !!databaseWarning && (
        <Text style={styles.warningText}>
          {databaseWarning}
        </Text>
      )}

      {(searchMode ? searchingDatabase : loadingFoods) ? (
        <View style={styles.emptyContainer}>
          <ActivityIndicator
            color="#72D6A0"
            size="large"
          />
          <Text style={styles.emptyText}>
            {searchMode
              ? 'Searching databases...'
              : 'Loading foods...'}
          </Text>
        </View>
      ) : displayedFoods.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            {searchMode
              ? 'No results yet. Enter a food and tap Search Food Database.'
              : 'No foods found'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={displayedFoods}
          keyExtractor={(item, index) =>
            `${String(item.id)}-${index}`
          }
          renderItem={renderFood}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
        />
      )}

      {/* Create a custom food */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent
        onRequestClose={closeCreateModal}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modal}>
            <ScrollView
              contentContainerStyle={styles.modalContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  Create a Food
                </Text>

                <TouchableOpacity
                  onPress={closeCreateModal}
                  style={styles.closeButton}
                  disabled={saving}
                >
                  <Text style={styles.closeButtonText}>×</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.helperText}>
                Enter nutrition information for a 100 g serving.
              </Text>

              <Text style={styles.label}>Food name</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. Greek yoghurt"
                placeholderTextColor="#777777"
                value={newFoodName}
                onChangeText={setNewFoodName}
                editable={!saving}
                returnKeyType="next"
              />

              <Text style={styles.label}>Calories (kcal)</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. 120"
                placeholderTextColor="#777777"
                value={newCalories}
                onChangeText={setNewCalories}
                keyboardType="decimal-pad"
                editable={!saving}
              />

              <Text style={styles.label}>Protein (g)</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. 10"
                placeholderTextColor="#777777"
                value={newProtein}
                onChangeText={setNewProtein}
                keyboardType="decimal-pad"
                editable={!saving}
              />

              <Text style={styles.label}>Carbs (g)</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. 5"
                placeholderTextColor="#777777"
                value={newCarbs}
                onChangeText={setNewCarbs}
                keyboardType="decimal-pad"
                editable={!saving}
              />

              <Text style={styles.label}>Fat (g)</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. 3"
                placeholderTextColor="#777777"
                value={newFat}
                onChangeText={setNewFat}
                keyboardType="decimal-pad"
                editable={!saving}
              />

              <TouchableOpacity
                style={[
                  styles.addButton,
                  saving && styles.disabledButton,
                ]}
                onPress={saveCustomFood}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#111111" />
                ) : (
                  <Text style={styles.addButtonText}>
                    Save to Library
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={closeCreateModal}
                disabled={saving}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add a library or scanned food to today's diary */}
      <Modal
        visible={selectedFood !== null}
        animationType="fade"
        transparent
        statusBarTranslucent
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modal}>
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {selectedFood?.name}
                </Text>

                <TouchableOpacity
                  onPress={closeModal}
                  style={styles.closeButton}
                  disabled={
                    saving || savingApiFoodId !== null
                  }
                >
                  <Text style={styles.closeButtonText}>×</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.helperText}>
                Nutrition values are shown per 100 g.
              </Text>

              <View style={styles.nutritionBox}>
                <Text style={styles.resultText}>
                  Per 100 g: {selectedFood?.caloriesPer100g.toFixed(1)} kcal
                </Text>
                <Text style={styles.resultText}>
                  Protein: {selectedFood?.proteinPer100g.toFixed(1)} g
                </Text>
                <Text style={styles.resultText}>
                  Carbs: {selectedFood?.carbsPer100g.toFixed(1)} g
                </Text>
                <Text style={styles.resultText}>
                  Fat: {selectedFood?.fatPer100g.toFixed(1)} g
                </Text>
              </View>

              {selectedFoodCanBeSaved && (
                <TouchableOpacity
                  style={[
                    styles.saveApiFoodButton,
                    styles.modalSaveButton,
                    selectedFoodIsSaved &&
                      styles.savedApiFoodButton,
                    selectedFoodIsSaving &&
                      styles.disabledButton,
                  ]}
                  onPress={() =>
                    selectedFood &&
                    void saveFoodToLibrary(selectedFood)
                  }
                  disabled={
                    selectedFoodIsSaved ||
                    savingApiFoodId !== null ||
                    saving
                  }
                >
                  {selectedFoodIsSaving ? (
                    <ActivityIndicator color="#72D6A0" />
                  ) : (
                    <Text
                      style={[
                        styles.saveApiFoodButtonText,
                        selectedFoodIsSaved &&
                          styles.savedApiFoodButtonText,
                      ]}
                    >
                      {selectedFoodIsSaved
                        ? '✓ Saved to My Foods'
                        : '+ Save to My Foods'}
                    </Text>
                  )}
                </TouchableOpacity>
              )}

              <Text style={styles.label}>Amount (grams)</Text>
              <TextInput
                style={styles.formInput}
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="decimal-pad"
                placeholder="e.g. 180"
                placeholderTextColor="#777777"
                autoFocus
                editable={!saving}
              />

              <Text style={styles.sectionTitle}>
                Nutrition for this amount
              </Text>

              <View style={styles.nutritionBox}>
                <Text style={styles.resultText}>
                  Calories: {calculatedCalories.toFixed(0)} kcal
                </Text>
                <Text style={styles.resultText}>
                  Protein: {calculatedProtein.toFixed(1)} g
                </Text>
                <Text style={styles.resultText}>
                  Carbs: {calculatedCarbs.toFixed(1)} g
                </Text>
                <Text style={styles.resultText}>
                  Fat: {calculatedFat.toFixed(1)} g
                </Text>
              </View>

              <Text style={styles.sectionTitle}>Meal</Text>

              <View style={styles.mealContainer}>
                {(
                  ['Breakfast', 'Lunch', 'Dinner', 'Snacks'] as Meal[]
                ).map((meal) => (
                  <TouchableOpacity
                    key={meal}
                    style={[
                      styles.mealButton,
                      selectedMeal === meal &&
                        styles.selectedMealButton,
                    ]}
                    onPress={() => setSelectedMeal(meal)}
                    disabled={saving}
                  >
                    <Text
                      style={[
                        styles.mealText,
                        selectedMeal === meal &&
                          styles.selectedMealText,
                      ]}
                    >
                      {meal}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[
                  styles.addButton,
                  saving && styles.disabledButton,
                ]}
                onPress={addToDiary}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#111111" />
                ) : (
                  <Text style={styles.addButtonText}>
                    Add to Diary
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Barcode scanner modal */}
      <Modal
        visible={showBarcodeScanner}
        animationType="slide"
        onRequestClose={() => setShowBarcodeScanner(false)}
      >
        <SafeAreaView style={styles.scannerContainer}>
          <View style={styles.scannerHeader}>
            <Text style={styles.scannerTitle}>
              Scan Food Barcode
            </Text>

            <TouchableOpacity
              onPress={() => setShowBarcodeScanner(false)}
              style={styles.closeButton}
            >
              <Text style={styles.closeButtonText}>×</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.scannerInstructions}>
            Position the barcode inside the camera view.
          </Text>

          {cameraPermission?.granted ? (
            <View style={styles.cameraContainer}>
              <CameraView
                style={styles.camera}
                facing="back"
                barcodeScannerSettings={{
                  barcodeTypes: [
                    'ean13',
                    'ean8',
                    'upc_a',
                    'upc_e',
                  ],
                }}
                onBarcodeScanned={
                  barcodeScanned
                    ? undefined
                    : handleBarcodeScanned
                }
              />

              <View
                pointerEvents="none"
                style={styles.scanFrame}
              />
            </View>
          ) : (
            <View style={styles.cameraPermissionContainer}>
              <Text style={styles.scannerInstructions}>
                Camera access is needed to scan product barcodes.
              </Text>

              <TouchableOpacity
                style={styles.addButton}
                onPress={openBarcodeScanner}
              >
                <Text style={styles.addButtonText}>
                  Allow Camera Access
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {barcodeLookupLoading && (
            <View style={styles.lookupStatus}>
              <ActivityIndicator
                color="#72D6A0"
                size="large"
              />
              <Text style={styles.scannerInstructions}>
                Looking up product nutrition...
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.cancelScannerButton}
            onPress={() => setShowBarcodeScanner(false)}
          >
            <Text style={styles.cancelScannerText}>Cancel</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111111',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  createButton: {
    backgroundColor: '#72D6A0',
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  createButtonText: {
    color: '#111111',
    fontSize: 15,
    fontWeight: '700',
  },
  scanBarcodeButton: {
    backgroundColor: '#1C1C1C',
    borderWidth: 1,
    borderColor: '#72D6A0',
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  scanBarcodeButtonText: {
    color: '#72D6A0',
    fontSize: 15,
    fontWeight: '700',
  },
  modeContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: '#1C1C1C',
    borderRadius: 10,
    padding: 4,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 8,
    alignItems: 'center',
  },
  activeModeButton: {
    backgroundColor: '#72D6A0',
  },
  modeText: {
    color: '#AAAAAA',
    fontSize: 14,
    fontWeight: '600',
  },
  activeModeText: {
    color: '#111111',
  },
  searchInput: {
    backgroundColor: '#1C1C1C',
    color: '#FFFFFF',
    marginHorizontal: 20,
    marginBottom: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    fontSize: 16,
  },
  sourceText: {
    color: '#72D6A0',
    fontSize: 12,
    marginBottom: 6,
  },
  saveApiFoodButton: {
    marginTop: 14,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#72D6A0',
    alignItems: 'center',
  },
  modalSaveButton: {
    marginTop: 0,
    marginBottom: 18,
  },
  savedApiFoodButton: {
    borderColor: '#3A5A48',
    backgroundColor: '#1C3027',
  },
  saveApiFoodButtonText: {
    color: '#72D6A0',
    fontSize: 14,
    fontWeight: '700',
  },
  savedApiFoodButtonText: {
    color: '#AAAAAA',
  },
  warningText: {
    color: '#E8C779',
    fontSize: 12,
    marginHorizontal: 20,
    marginBottom: 10,
  },
  list: {
    padding: 20,
    gap: 12,
  },
  foodCard: {
    backgroundColor: '#1C1C1C',
    borderRadius: 12,
    padding: 16,
  },
  foodName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  nutrition: {
    fontSize: 15,
    color: '#72D6A0',
    marginBottom: 6,
  },
  macros: {
    fontSize: 13,
    color: '#AAAAAA',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 20,
  },
  emptyText: {
    color: '#777777',
    fontSize: 16,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modal: {
    backgroundColor: '#181818',
    borderRadius: 20,
    width: '100%',
    maxHeight: '85%',
    overflow: 'hidden',
  },
  modalScroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  modalContent: {
    padding: 20,
    paddingBottom: 25,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    gap: 12,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    flex: 1,
  },
  helperText: {
    color: '#AAAAAA',
    fontSize: 13,
    marginBottom: 18,
  },
  label: {
    color: '#AAAAAA',
    fontSize: 14,
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: '#242424',
    color: '#FFFFFF',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 10,
  },
  nutritionBox: {
    backgroundColor: '#242424',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
  },
  resultText: {
    color: '#FFFFFF',
    fontSize: 15,
    marginBottom: 5,
  },
  mealContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  mealButton: {
    backgroundColor: '#242424',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
  },
  selectedMealButton: {
    backgroundColor: '#72D6A0',
  },
  mealText: {
    color: '#AAAAAA',
    fontSize: 13,
  },
  selectedMealText: {
    color: '#111111',
    fontWeight: '600',
  },
  addButton: {
    backgroundColor: '#72D6A0',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
    marginTop: 6,
  },
  disabledButton: {
    opacity: 0.6,
  },
  addButtonText: {
    color: '#111111',
    fontSize: 16,
    fontWeight: '700',
  },
  cancelText: {
    color: '#AAAAAA',
    textAlign: 'center',
    marginTop: 18,
    fontSize: 15,
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
  },
  scannerContainer: {
    flex: 1,
    backgroundColor: '#111111',
  },
  scannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  scannerTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
  },
  scannerInstructions: {
    color: '#AAAAAA',
    fontSize: 14,
    textAlign: 'center',
    marginHorizontal: 20,
    marginBottom: 16,
  },
  cameraContainer: {
    flex: 1,
    marginHorizontal: 20,
    borderRadius: 16,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  camera: {
    ...StyleSheet.absoluteFill,
  },
  scanFrame: {
    width: '82%',
    height: 150,
    borderWidth: 3,
    borderColor: '#72D6A0',
    borderRadius: 12,
  },
  cameraPermissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  lookupStatus: {
    alignItems: 'center',
    gap: 12,
    padding: 20,
  },
  cancelScannerButton: {
    margin: 20,
    padding: 15,
    borderRadius: 10,
    backgroundColor: '#242424',
    alignItems: 'center',
  },
  cancelScannerText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});