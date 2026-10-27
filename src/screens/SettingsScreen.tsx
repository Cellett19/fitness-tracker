import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  DEFAULT_FITNESS_SETTINGS,
  FitnessGoal,
  FitnessSettings,
  loadFitnessSettings,
} from '../services/fitnessSettings';
import { supabase } from '../services/supabase';

const BG = '#111111';
const CARD = '#1C1C1C';
const GREEN = '#72D6A0';
const MUTED = '#A0A0A0';
const BORDER = '#333333';

type SexForCalculation = 'male' | 'female' | '';

type ActivityLevel =
  | 'sedentary'
  | 'light'
  | 'moderate'
  | 'active'
  | 'very_active';

type BodyDetails = {
  weight_kg: string;
  height_cm: string;
  age_years: string;
  sex_for_calculation: SexForCalculation;
  activity_level: ActivityLevel;
};

type MacroTargets = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

type Plan = {
  goal: FitnessGoal;
  title: string;
  description: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  proteinPercent: number;
  carbsPercent: number;
  fatPercent: number;
};

const DEFAULT_BODY_DETAILS: BodyDetails = {
  weight_kg: '',
  height_cm: '',
  age_years: '',
  sex_for_calculation: '',
  activity_level: 'moderate',
};

const ACTIVITY_OPTIONS: {
  value: ActivityLevel;
  label: string;
  description: string;
  multiplier: number;
}[] = [
  {
    value: 'sedentary',
    label: 'Sedentary',
    description: 'Mostly sitting, little exercise',
    multiplier: 1.2,
  },
  {
    value: 'light',
    label: 'Lightly active',
    description: 'Light exercise 1–3 days per week',
    multiplier: 1.375,
  },
  {
    value: 'moderate',
    label: 'Moderately active',
    description: 'Moderate exercise 3–5 days per week',
    multiplier: 1.55,
  },
  {
    value: 'active',
    label: 'Very active',
    description: 'Hard exercise 6–7 days per week',
    multiplier: 1.725,
  },
  {
    value: 'very_active',
    label: 'Extremely active',
    description: 'Very hard training or physical work',
    multiplier: 1.9,
  },
];

const GOAL_OPTIONS: {
  value: FitnessGoal;
  label: string;
}[] = [
  { value: 'lose_fat', label: 'Lose fat' },
  { value: 'maintain', label: 'Maintain' },
  { value: 'build_muscle', label: 'Build muscle' },
];

function roundToNearest50(value: number): number {
  return Math.round(value / 50) * 50;
}

function calculateMacros(
  calories: number,
  weightKg: number,
  goal: FitnessGoal,
): Omit<MacroTargets, 'calories'> {
  const proteinMultiplier =
    goal === 'lose_fat' ? 2.0 : goal === 'build_muscle' ? 1.8 : 1.6;


  const protein = Math.round(
    Math.min(weightKg * proteinMultiplier, (calories * 0.4) / 4),
  );

  const desiredFat = Math.round((calories * 0.25) / 9);
  const maximumFat = Math.floor(
    Math.max(0, calories - protein * 4) / 9,
  );
  const fat = Math.min(desiredFat, maximumFat);

  const remainingCalories = Math.max(
    0,
    calories - protein * 4 - fat * 9,
  );
  const carbs = Math.round(remainingCalories / 4);

  return { protein, carbs, fat };
}

function getMacroPercentages(
  calories: number,
  protein: number,
  carbs: number,
  fat: number,
) {
  const proteinCalories = protein * 4;
  const carbsCalories = carbs * 4;
  const fatCalories = fat * 9;
  const total = proteinCalories + carbsCalories + fatCalories;

  if (total <= 0 || calories <= 0) {
    return { protein: 0, carbs: 0, fat: 0 };
  }

  return {
    protein: Math.round((proteinCalories / total) * 100),
    carbs: Math.round((carbsCalories / total) * 100),
    fat: Math.round((fatCalories / total) * 100),
  };
}

function getGoalTitle(goal: FitnessGoal): string {
  switch (goal) {
    case 'lose_fat':
      return 'Lose fat';
    case 'maintain':
      return 'Maintain weight';
    case 'build_muscle':
      return 'Build muscle';
    default:
      return 'Maintain weight';
  }
}

function parsePositiveNumber(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export default function SettingsScreen() {
  const [settings, setSettings] = useState<FitnessSettings>(
    DEFAULT_FITNESS_SETTINGS,
  );
  const [bodyDetails, setBodyDetails] = useState<BodyDetails>(
    DEFAULT_BODY_DETAILS,
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [calorieInput, setCalorieInput] = useState(
    String(DEFAULT_FITNESS_SETTINGS.calorie_target),
  );
  const [proteinInput, setProteinInput] = useState(
    String(DEFAULT_FITNESS_SETTINGS.protein_target),
  );
  const [carbsInput, setCarbsInput] = useState(
    String(DEFAULT_FITNESS_SETTINGS.carbs_target),
  );
  const [fatInput, setFatInput] = useState(
    String(DEFAULT_FITNESS_SETTINGS.fat_target),
  );
  const [workoutDaysInput, setWorkoutDaysInput] = useState(
    String(DEFAULT_FITNESS_SETTINGS.workout_days_target),
  );

  const [selectedGoal, setSelectedGoal] = useState<FitnessGoal>(
    DEFAULT_FITNESS_SETTINGS.fitness_goal,
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function loadData() {
        setLoading(true);

        try {
          const loadedSettings = await loadFitnessSettings();

          if (!active) return;

          const nextSettings = {
            ...DEFAULT_FITNESS_SETTINGS,
            ...loadedSettings,
          };

          setSettings(nextSettings);
          setCalorieInput(String(nextSettings.calorie_target));
          setProteinInput(String(nextSettings.protein_target));
          setCarbsInput(String(nextSettings.carbs_target));
          setFatInput(String(nextSettings.fat_target));
          setWorkoutDaysInput(String(nextSettings.workout_days_target));
          setSelectedGoal(nextSettings.fitness_goal);

          const {
            data: { user },
            error: userError,
          } = await supabase.auth.getUser();

          if (userError) throw userError;

          if (!user) {
            if (active) {
              setBodyDetails(DEFAULT_BODY_DETAILS);
            }
            return;
          }

          const { data, error } = await supabase
            .from('fitness_settings')
            .select(
              'weight_kg, height_cm, age_years, sex_for_calculation, activity_level',
            )
            .eq('user_id', user.id)
            .maybeSingle();

          if (error) throw error;

          if (active && data) {
            setBodyDetails({
              weight_kg:
                data.weight_kg != null ? String(data.weight_kg) : '',
              height_cm:
                data.height_cm != null ? String(data.height_cm) : '',
              age_years:
                data.age_years != null ? String(data.age_years) : '',
              sex_for_calculation:
                data.sex_for_calculation === 'male' ||
                data.sex_for_calculation === 'female'
                  ? data.sex_for_calculation
                  : '',
              activity_level: ACTIVITY_OPTIONS.some(
                (option) => option.value === data.activity_level,
              )
                ? data.activity_level
                : 'moderate',
            });
          }
        } catch (error) {
          console.error('Failed to load fitness settings:', error);
          if (active) {
            Alert.alert(
              'Unable to load settings',
              'Your settings could not be loaded. Please try again.',
            );
          }
        } finally {
          if (active) setLoading(false);
        }
      }

      void loadData();

      return () => {
        active = false;
      };
    }, []),
  );

  const bodyNumbers = useMemo(() => {
    return {
      weight: parsePositiveNumber(bodyDetails.weight_kg),
      height: parsePositiveNumber(bodyDetails.height_cm),
      age: parsePositiveNumber(bodyDetails.age_years),
    };
  }, [bodyDetails]);

  const tdee = useMemo(() => {
    const { weight, height, age } = bodyNumbers;

    if (
      !weight ||
      !height ||
      !age ||
      !bodyDetails.sex_for_calculation
    ) {
      return null;
    }

    if (
      weight < 25 ||
      weight > 350 ||
      height < 100 ||
      height > 250 ||
      age < 18 ||
      age > 100
    ) {
      return null;
    }

    const sexAdjustment =
      bodyDetails.sex_for_calculation === 'male' ? 5 : -161;

    const bmr =
      10 * weight + 6.25 * height - 5 * age + sexAdjustment;

    const activityMultiplier =
      ACTIVITY_OPTIONS.find(
        (option) => option.value === bodyDetails.activity_level,
      )?.multiplier ?? 1.55;

    return Math.round(bmr * activityMultiplier);
  }, [bodyNumbers, bodyDetails]);

  const plans = useMemo<Plan[]>(() => {
    if (!tdee || !bodyNumbers.weight) return [];

    const calorieTargets: { goal: FitnessGoal; calories: number }[] = [
      {
        goal: 'lose_fat',
        calories: roundToNearest50(tdee * 0.85),
      },
      {
        goal: 'maintain',
        calories: roundToNearest50(tdee),
      },
      {
        goal: 'build_muscle',
        calories: roundToNearest50(tdee * 1.1),
      },
    ];

    return calorieTargets.map(({ goal, calories }) => {
      const macros = calculateMacros(
        calories,
        bodyNumbers.weight!,
        goal,
      );

      const percentages = getMacroPercentages(
        calories,
        macros.protein,
        macros.carbs,
        macros.fat,
      );

      return {
        goal,
        title: getGoalTitle(goal),
        description:
          goal === 'lose_fat'
            ? 'About 15% below estimated maintenance'
            : goal === 'maintain'
              ? 'Estimated maintenance calories'
              : 'About 10% above estimated maintenance',
        calories,
        ...macros,
        proteinPercent: percentages.protein,
        carbsPercent: percentages.carbs,
        fatPercent: percentages.fat,
      };
    });
  }, [tdee, bodyNumbers.weight]);

  const updateBodyDetail = <K extends keyof BodyDetails>(
    key: K,
    value: BodyDetails[K],
  ) => {
    setBodyDetails((current) => ({ ...current, [key]: value }));
  };

  const persistSettings = async (
    nextSettings: FitnessSettings,
    nextBodyDetails: BodyDetails,
  ) => {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) throw userError;

    if (!user) {
      throw new Error('You must be signed in to save your settings.');
    }

    const weight = parsePositiveNumber(nextBodyDetails.weight_kg);
    const height = parsePositiveNumber(nextBodyDetails.height_cm);
    const age = parsePositiveNumber(nextBodyDetails.age_years);

    const payload = {
      user_id: user.id,
      calorie_target: nextSettings.calorie_target,
      protein_target: nextSettings.protein_target,
      carbs_target: nextSettings.carbs_target,
      fat_target: nextSettings.fat_target,
      workout_days_target: nextSettings.workout_days_target,
      fitness_goal: nextSettings.fitness_goal,
      weight_kg: weight,
      height_cm: height,
      age_years: age,
      sex_for_calculation:
        nextBodyDetails.sex_for_calculation || null,
      activity_level: nextBodyDetails.activity_level,
    };

    const { error } = await supabase
      .from('fitness_settings')
      .upsert(payload, { onConflict: 'user_id' });

    if (error) throw error;
  };

  const saveSettings = async () => {
    Keyboard.dismiss();

    const calories = Number(calorieInput);
    const protein = Number(proteinInput);
    const carbs = Number(carbsInput);
    const fat = Number(fatInput);
    const workoutDays = Number(workoutDaysInput);

    if (
      !Number.isFinite(calories) ||
      calories < 500 ||
      calories > 10000
    ) {
      Alert.alert('Invalid calories', 'Enter a calorie target from 500 to 10,000.');
      return;
    }

    if (
      !Number.isFinite(protein) ||
      protein < 0 ||
      protein > 1000
    ) {
      Alert.alert('Invalid protein', 'Enter a protein target from 0 to 1,000 g.');
      return;
    }

    if (
      !Number.isFinite(carbs) ||
      carbs < 0 ||
      carbs > 1500
    ) {
      Alert.alert('Invalid carbohydrates', 'Enter a carbohydrate target from 0 to 1,500 g.');
      return;
    }

    if (!Number.isFinite(fat) || fat < 0 || fat > 500) {
      Alert.alert('Invalid fat', 'Enter a fat target from 0 to 500 g.');
      return;
    }

    if (
      !Number.isInteger(workoutDays) ||
      workoutDays < 0 ||
      workoutDays > 7
    ) {
      Alert.alert('Invalid workout days', 'Enter a number of workout days from 0 to 7.');
      return;
    }

    const weight = parsePositiveNumber(bodyDetails.weight_kg);
    const height = parsePositiveNumber(bodyDetails.height_cm);
    const age = parsePositiveNumber(bodyDetails.age_years);

    if (
      bodyDetails.weight_kg.trim() &&
      (!weight || weight < 25 || weight > 350)
    ) {
      Alert.alert('Invalid weight', 'Enter a weight between 25 and 350 kg.');
      return;
    }

    if (
      bodyDetails.height_cm.trim() &&
      (!height || height < 100 || height > 250)
    ) {
      Alert.alert('Invalid height', 'Enter a height between 100 and 250 cm.');
      return;
    }

    if (
      bodyDetails.age_years.trim() &&
      (!age || age < 18 || age > 100 || !Number.isInteger(age))
    ) {
      Alert.alert('Invalid age', 'Enter an age between 18 and 100.');
      return;
    }

    const nextSettings: FitnessSettings = {
      ...settings,
      calorie_target: Math.round(calories),
      protein_target: Math.round(protein),
      carbs_target: Math.round(carbs),
      fat_target: Math.round(fat),
      workout_days_target: workoutDays,
      fitness_goal: selectedGoal,
    };

    setSaving(true);

    try {
      await persistSettings(nextSettings, bodyDetails);

      setSettings(nextSettings);

      Alert.alert('Settings saved', 'Your fitness settings have been saved.');
    } catch (error) {
      console.error('Failed to save fitness settings:', error);
      Alert.alert(
        'Save failed',
        error instanceof Error
          ? error.message
          : 'Your settings could not be saved. Please try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  const applyPlan = async (plan: Plan) => {
    Keyboard.dismiss();

    const nextSettings: FitnessSettings = {
      ...settings,
      calorie_target: plan.calories,
      protein_target: plan.protein,
      carbs_target: plan.carbs,
      fat_target: plan.fat,
      fitness_goal: plan.goal,
    };

    setCalorieInput(String(plan.calories));
    setProteinInput(String(plan.protein));
    setCarbsInput(String(plan.carbs));
    setFatInput(String(plan.fat));
    setSelectedGoal(plan.goal);

    setSaving(true);

    try {
      await persistSettings(nextSettings, bodyDetails);

      setSettings(nextSettings);

      Alert.alert(
        'Plan saved',
        `${plan.title} plan saved successfully. Your daily targets have been updated.`,
      );
    } catch (error) {
      console.error('Failed to save selected plan:', error);

      Alert.alert(
        'Could not save plan',
        error instanceof Error
          ? error.message
          : 'Your plan could not be saved. Check your connection and try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  const renderNumberInput = (
    label: string,
    value: string,
    onChangeText: (value: string) => void,
    suffix: string,
    placeholder: string,
  ) => (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={styles.inputWithSuffix}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          keyboardType="numeric"
          placeholder={placeholder}
          placeholderTextColor="#666666"
          returnKeyType="done"
        />
        <Text style={styles.inputSuffix}>{suffix}</Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={GREEN} />
        <Text style={styles.loadingText}>Loading settings...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.pageTitle}>Settings</Text>
      <Text style={styles.pageSubtitle}>
        Personalise your daily targets and workout goals.
      </Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Body details</Text>
        <Text style={styles.helperText}>
          Enter your details to estimate your maintenance calories and suggested macros.
        </Text>

        <View style={styles.twoColumns}>
          <View style={styles.column}>
            {renderNumberInput(
              'Weight',
              bodyDetails.weight_kg,
              (value) => updateBodyDetail('weight_kg', value),
              'kg',
              'e.g. 80',
            )}
          </View>
          <View style={styles.column}>
            {renderNumberInput(
              'Height',
              bodyDetails.height_cm,
              (value) => updateBodyDetail('height_cm', value),
              'cm',
              'e.g. 180',
            )}
          </View>
        </View>

        {renderNumberInput(
          'Age',
          bodyDetails.age_years,
          (value) => updateBodyDetail('age_years', value),
          'years',
          'e.g. 24',
        )}

        <Text style={styles.inputLabel}>Sex used for calorie calculation</Text>
        <View style={styles.optionRow}>
          {(['male', 'female'] as const).map((sex) => (
            <Pressable
              key={sex}
              style={[
                styles.optionButton,
                bodyDetails.sex_for_calculation === sex &&
                  styles.optionButtonSelected,
              ]}
              onPress={() => updateBodyDetail('sex_for_calculation', sex)}
            >
              <Text
                style={[
                  styles.optionText,
                  bodyDetails.sex_for_calculation === sex &&
                    styles.optionTextSelected,
                ]}
              >
                {sex === 'male' ? 'Male' : 'Female'}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.inputLabel, styles.spacedLabel]}>
          Activity level
        </Text>

        {ACTIVITY_OPTIONS.map((option) => {
          const selected =
            bodyDetails.activity_level === option.value;

          return (
            <Pressable
              key={option.value}
              style={[
                styles.activityOption,
                selected && styles.activityOptionSelected,
              ]}
              onPress={() =>
                updateBodyDetail('activity_level', option.value)
              }
            >
              <View style={styles.activityTextContainer}>
                <Text
                  style={[
                    styles.activityTitle,
                    selected && styles.optionTextSelected,
                  ]}
                >
                  {option.label}
                </Text>
                <Text style={styles.activityDescription}>
                  {option.description}
                </Text>
              </View>
              {selected && <Text style={styles.checkmark}>✓</Text>}
            </Pressable>
          );
        })}

        {tdee ? (
          <View style={styles.tdeeBox}>
            <Text style={styles.tdeeLabel}>
              Estimated maintenance calories
            </Text>
            <Text style={styles.tdeeValue}>
              {tdee.toLocaleString()} kcal/day
            </Text>
            <Text style={styles.helperText}>
              This is an estimate, not an exact measurement. Adjust based on your weight trend and how you feel over time.
            </Text>
          </View>
        ) : (
          <Text style={styles.helperText}>
            Enter a valid weight, height, age and calculation option to see your estimated calorie plans.
          </Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Suggested plans</Text>
        <Text style={styles.helperText}>
          Select Use to apply and immediately save a plan, including calories and all three macros.
        </Text>

        {plans.length === 0 ? (
          <Text style={styles.emptyText}>
            Complete your body details above to calculate your plans.
          </Text>
        ) : (
          plans.map((plan) => {
            const isSelected = selectedGoal === plan.goal;

            return (
              <View
                key={plan.goal}
                style={[
                  styles.planCard,
                  isSelected && styles.planCardSelected,
                ]}
              >
                <View style={styles.planHeader}>
                  <View style={styles.planHeading}>
                    <Text style={styles.planTitle}>{plan.title}</Text>
                    <Text style={styles.planDescription}>
                      {plan.description}
                    </Text>
                  </View>
                  {isSelected && (
                    <View style={styles.selectedBadge}>
                      <Text style={styles.selectedBadgeText}>Selected</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.planCalories}>
                  {plan.calories.toLocaleString()}
                  <Text style={styles.planCaloriesUnit}> kcal/day</Text>
                </Text>

                <View style={styles.macroRow}>
                  <View style={styles.macroItem}>
                    <Text style={styles.macroValue}>{plan.protein} g</Text>
                    <Text style={styles.macroLabel}>Protein</Text>
                    <Text style={styles.macroPercent}>
                      {plan.proteinPercent}%
                    </Text>
                  </View>
                  <View style={styles.macroItem}>
                    <Text style={styles.macroValue}>{plan.carbs} g</Text>
                    <Text style={styles.macroLabel}>Carbs</Text>
                    <Text style={styles.macroPercent}>
                      {plan.carbsPercent}%
                    </Text>
                  </View>
                  <View style={styles.macroItem}>
                    <Text style={styles.macroValue}>{plan.fat} g</Text>
                    <Text style={styles.macroLabel}>Fat</Text>
                    <Text style={styles.macroPercent}>
                      {plan.fatPercent}%
                    </Text>
                  </View>
                </View>

                <View style={styles.macroBar}>
                  <View
                    style={[
                      styles.proteinBar,
                      { flex: Math.max(plan.proteinPercent, 0.1) },
                    ]}
                  />
                  <View
                    style={[
                      styles.carbsBar,
                      { flex: Math.max(plan.carbsPercent, 0.1) },
                    ]}
                  />
                  <View
                    style={[
                      styles.fatBar,
                      { flex: Math.max(plan.fatPercent, 0.1) },
                    ]}
                  />
                </View>

                <Pressable
                  style={[
                    styles.useButton,
                    saving && styles.buttonDisabled,
                  ]}
                  disabled={saving}
                  onPress={() => void applyPlan(plan)}
                >
                  {saving ? (
                    <ActivityIndicator color={BG} />
                  ) : (
                    <Text style={styles.useButtonText}>
                      Use this plan
                    </Text>
                  )}
                </Pressable>
              </View>
            );
          })
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Manual targets</Text>
        <Text style={styles.helperText}>
          You can change these values whenever you want. Saving here also saves your body details and selected fitness goal.
        </Text>

        {renderNumberInput(
          'Daily calories',
          calorieInput,
          setCalorieInput,
          'kcal',
          'e.g. 2200',
        )}

        {renderNumberInput(
          'Protein',
          proteinInput,
          setProteinInput,
          'g',
          'e.g. 160',
        )}

        {renderNumberInput(
          'Carbohydrates',
          carbsInput,
          setCarbsInput,
          'g',
          'e.g. 220',
        )}

        {renderNumberInput(
          'Fat',
          fatInput,
          setFatInput,
          'g',
          'e.g. 70',
        )}

        {renderNumberInput(
          'Workout days per week',
          workoutDaysInput,
          setWorkoutDaysInput,
          'days',
          'e.g. 4',
        )}

        <Text style={[styles.inputLabel, styles.spacedLabel]}>
          Fitness goal
        </Text>
        <View style={styles.optionRow}>
          {GOAL_OPTIONS.map((option) => {
            const selected = selectedGoal === option.value;

            return (
              <Pressable
                key={option.value}
                style={[
                  styles.goalButton,
                  selected && styles.optionButtonSelected,
                ]}
                onPress={() => setSelectedGoal(option.value)}
              >
                <Text
                  style={[
                    styles.optionText,
                    selected && styles.optionTextSelected,
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          style={[
            styles.saveButton,
            saving && styles.buttonDisabled,
          ]}
          disabled={saving}
          onPress={() => void saveSettings()}
        >
          {saving ? (
            <ActivityIndicator color={BG} />
          ) : (
            <Text style={styles.saveButtonText}>Save settings</Text>
          )}
        </Pressable>
      </View>

      <Text style={styles.footerText}>
        Calorie and macro recommendations are estimates. Your actual needs can vary with activity, health, training and individual metabolism.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: MUTED,
    marginTop: 12,
    fontSize: 14,
  },
  pageTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 6,
  },
  pageSubtitle: {
    color: MUTED,
    fontSize: 14,
    marginBottom: 22,
    lineHeight: 20,
  },
  card: {
    backgroundColor: CARD,
    borderRadius: 18,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: BORDER,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '700',
    marginBottom: 8,
  },
  helperText: {
    color: MUTED,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
  },
  twoColumns: {
    flexDirection: 'row',
    gap: 12,
  },
  column: {
    flex: 1,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    color: '#EAEAEA',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  inputWithSuffix: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121212',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    paddingVertical: 12,
  },
  inputSuffix: {
    color: MUTED,
    fontSize: 13,
    marginLeft: 8,
  },
  optionRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  optionButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: BORDER,
  },
  goalButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 10,
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: BORDER,
  },
  optionButtonSelected: {
    backgroundColor: 'rgba(114, 214, 160, 0.12)',
    borderColor: GREEN,
  },
  optionText: {
    color: '#DDDDDD',
    fontSize: 14,
    fontWeight: '600',
  },
  optionTextSelected: {
    color: GREEN,
  },
  spacedLabel: {
    marginTop: 4,
  },
  activityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    marginBottom: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: '#121212',
  },
  activityOptionSelected: {
    borderColor: GREEN,
    backgroundColor: 'rgba(114, 214, 160, 0.08)',
  },
  activityTextContainer: {
    flex: 1,
    paddingRight: 10,
  },
  activityTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 3,
  },
  activityDescription: {
    color: MUTED,
    fontSize: 12,
    lineHeight: 17,
  },
  checkmark: {
    color: GREEN,
    fontSize: 20,
    fontWeight: '800',
  },
  tdeeBox: {
    backgroundColor: '#121212',
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: BORDER,
  },
  tdeeLabel: {
    color: MUTED,
    fontSize: 13,
    marginBottom: 5,
  },
  tdeeValue: {
    color: GREEN,
    fontSize: 25,
    fontWeight: '800',
    marginBottom: 8,
  },
  planCard: {
    backgroundColor: '#121212',
    borderRadius: 14,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  planCardSelected: {
    borderColor: GREEN,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  planHeading: {
    flex: 1,
    paddingRight: 8,
  },
  planTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
  },
  planDescription: {
    color: MUTED,
    fontSize: 12,
    lineHeight: 17,
  },
  selectedBadge: {
    backgroundColor: 'rgba(114, 214, 160, 0.12)',
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  selectedBadgeText: {
    color: GREEN,
    fontSize: 11,
    fontWeight: '700',
  },
  planCalories: {
    color: GREEN,
    fontSize: 27,
    fontWeight: '800',
    marginBottom: 14,
  },
  planCaloriesUnit: {
    color: MUTED,
    fontSize: 13,
    fontWeight: '500',
  },
  macroRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  macroItem: {
    flex: 1,
  },
  macroValue: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 3,
  },
  macroLabel: {
    color: MUTED,
    fontSize: 12,
    marginBottom: 3,
  },
  macroPercent: {
    color: GREEN,
    fontSize: 12,
    fontWeight: '600',
  },
  macroBar: {
    flexDirection: 'row',
    height: 7,
    overflow: 'hidden',
    borderRadius: 8,
    marginBottom: 14,
    gap: 2,
  },
  proteinBar: {
    backgroundColor: '#72D6A0',
  },
  carbsBar: {
    backgroundColor: '#7C5CFC',
  },
  fatBar: {
    backgroundColor: '#F0B35A',
  },
  useButton: {
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  useButtonText: {
    color: BG,
    fontSize: 14,
    fontWeight: '800',
  },
  emptyText: {
    color: MUTED,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  saveButton: {
    minHeight: 50,
    borderRadius: 12,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  saveButtonText: {
    color: BG,
    fontSize: 16,
    fontWeight: '800',
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  footerText: {
    color: '#777777',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 12,
  },
});