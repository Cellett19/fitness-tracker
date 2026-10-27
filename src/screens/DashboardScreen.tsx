import { useCallback, useState } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';

import { supabase } from '../services/supabase';
import {
  DEFAULT_FITNESS_SETTINGS,
  loadFitnessSettings,
} from '../services/fitnessSettings';

const GREEN = '#72D6A0';
const BLUE = '#79B8FF';
const ORANGE = '#FFB86B';
const PURPLE = '#B7A0FF';

const RING_SIZE = 220;
const RING_STROKE = 15;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

type FoodRow = {
  food_name: string;
  calories_per_100g: number | string | null;
  protein_per_100g: number | string | null;
  carbs_per_100g: number | string | null;
  fat_per_100g: number | string | null;
  quantity_grams: number | string | null;
};

type WorkoutRow = {
  id: string;
  name: string | null;
  started_at: string;
  finished_at: string | null;
};

type Nutrition = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

function localDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function addDays(date: Date, amount: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

function formatTime(dateString: string): string {
  return new Date(dateString).toLocaleTimeString('en-AU', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function formatSelectedDate(date: Date): string {
  return date.toLocaleDateString('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function nutritionFromRows(rows: FoodRow[]): Nutrition {
  return rows.reduce(
    (total, row) => {
      const factor = (Number(row.quantity_grams) || 0) / 100;

      total.calories += Math.round(
        (Number(row.calories_per_100g) || 0) * factor,
      );
      total.protein += (Number(row.protein_per_100g) || 0) * factor;
      total.carbs += (Number(row.carbs_per_100g) || 0) * factor;
      total.fat += (Number(row.fat_per_100g) || 0) * factor;

      return total;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

function ProgressBar({
  label,
  value,
  target,
  color,
}: {
  label: string;
  value: number;
  target: number;
  color: string;
}) {
  const safeTarget = Math.max(Number(target) || 0, 0);
  const progress =
    safeTarget > 0 ? Math.min(Math.max(value / safeTarget, 0), 1) : 0;
  const percentage =
    safeTarget > 0 ? Math.round((value / safeTarget) * 100) : 0;

  return (
    <View style={styles.macroItem}>
      <View style={styles.macroHeading}>
        <View style={styles.macroTitleRow}>
          <View style={[styles.macroDot, { backgroundColor: color }]} />
          <Text style={styles.macroLabel}>{label}</Text>
        </View>

        <Text style={styles.macroAmount}>
          {Math.round(value)}{' '}
          <Text style={styles.macroTarget}>/ {safeTarget} g</Text>
        </Text>
      </View>

      <View style={styles.macroTrack}>
        <View
          style={[
            styles.macroFill,
            {
              width: `${progress * 100}%`,
              backgroundColor: color,
            },
          ]}
        />
      </View>

      <Text style={styles.macroPercentage}>
        {percentage}% of daily target
      </Text>
    </View>
  );
}

function CalorieRing({
  calories,
  target,
}: {
  calories: number;
  target: number;
}) {
  const safeTarget = Math.max(Number(target) || 0, 0);
  const progress =
    safeTarget > 0 ? Math.min(Math.max(calories / safeTarget, 0), 1) : 0;
  const remaining = Math.max(safeTarget - calories, 0);
  const percentage =
    safeTarget > 0 ? Math.round((calories / safeTarget) * 100) : 0;

  const strokeOffset = RING_CIRCUMFERENCE * (1 - progress);

  return (
    <View style={styles.ringContainer}>
      <Svg
        width={RING_SIZE}
        height={RING_SIZE}
        viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
      >
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          stroke="#303030"
          strokeWidth={RING_STROKE}
          fill="none"
        />

        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          stroke={GREEN}
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          strokeDasharray={`${RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`}
          strokeDashoffset={strokeOffset}
          rotation={-90}
          origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
          fill="none"
        />
      </Svg>

      <View style={styles.ringCentre}>
        <Text style={styles.ringEyebrow}>CALORIES</Text>

        <Text style={styles.ringCalories}>
          {Math.round(calories).toLocaleString('en-AU')}
        </Text>

        <Text style={styles.ringTarget}>
          of {safeTarget.toLocaleString('en-AU')} kcal
        </Text>

        <View style={styles.ringDivider} />

        <Text style={styles.ringRemaining}>
          {remaining.toLocaleString('en-AU')} left
        </Text>
      </View>

      <View style={styles.ringPercentage}>
        <Text style={styles.ringPercentageText}>{percentage}%</Text>
      </View>
    </View>
  );
}

export default function DashboardScreen() {
  const navigation = useNavigation<any>();

  const [targets, setTargets] = useState(DEFAULT_FITNESS_SETTINGS);
  const [selectedDate, setSelectedDate] = useState(() => new Date());

  const [nutrition, setNutrition] = useState<Nutrition>({
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  });

  const [workouts, setWorkouts] = useState<WorkoutRow[]>([]);
  const [todayWorkout, setTodayWorkout] = useState<WorkoutRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const isToday = localDate(selectedDate) === localDate(new Date());

  const changeDate = useCallback((amount: number) => {
    setSelectedDate((current) => {
      const next = addDays(current, amount);
      const today = new Date();

      if (localDate(next) > localDate(today)) {
        return current;
      }

      return next;
    });
  }, []);

  const handleLogout = useCallback(async () => {
    if (loggingOut) return;

    let confirmed = false;

    if (Platform.OS === 'web') {
      confirmed = window.confirm(
        'Are you sure you want to log out of your account?',
      );
    } else {
      confirmed = await new Promise<boolean>((resolve) => {
        Alert.alert(
          'Log out',
          'Are you sure you want to log out of your account?',
          [
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => resolve(false),
            },
            {
              text: 'Log out',
              style: 'destructive',
              onPress: () => resolve(true),
            },
          ],
          { cancelable: true, onDismiss: () => resolve(false) },
        );
      });
    }

    if (!confirmed) return;

    setLoggingOut(true);

    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Please try again.';

      if (Platform.OS === 'web') {
        window.alert(`Unable to log out: ${message}`);
      } else {
        Alert.alert('Logout failed', message);
      }
    } finally {
      setLoggingOut(false);
    }
  }, [loggingOut]);

  const loadDashboard = useCallback(
    async (dateToLoad: Date, showLoader = true) => {
      if (showLoader) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      try {
        const dayStart = new Date(dateToLoad);
        dayStart.setHours(0, 0, 0, 0);

        const nextDayStart = new Date(dayStart);
        nextDayStart.setDate(nextDayStart.getDate() + 1);

        const selectedDateString = localDate(dateToLoad);

        const savedTargets = await loadFitnessSettings();
        setTargets(savedTargets);

        const [foodResult, workoutResult, selectedWorkoutResult] =
          await Promise.all([
            supabase
              .from('food_logs')
              .select(
                'food_name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, quantity_grams',
              )
              .eq('date', selectedDateString),

            supabase
              .from('workout_sessions')
              .select('id, name, started_at, finished_at')
              .not('finished_at', 'is', null)
              .order('started_at', { ascending: false })
              .limit(3),

            supabase
              .from('workout_sessions')
              .select('id, name, started_at, finished_at')
              .gte('started_at', dayStart.toISOString())
              .lt('started_at', nextDayStart.toISOString())
              .order('started_at', { ascending: false })
              .limit(1),
          ]);

        if (foodResult.error) throw foodResult.error;
        if (workoutResult.error) throw workoutResult.error;
        if (selectedWorkoutResult.error) throw selectedWorkoutResult.error;

        setNutrition(nutritionFromRows((foodResult.data ?? []) as FoodRow[]));
        setWorkouts((workoutResult.data ?? []) as WorkoutRow[]);
        setTodayWorkout(
          ((selectedWorkoutResult.data ?? [])[0] as
            | WorkoutRow
            | undefined) ?? null,
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Please try again.';

        if (Platform.OS === 'web') {
          window.alert(`Could not load dashboard: ${message}`);
        } else {
          Alert.alert('Could not load dashboard', message);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useFocusEffect(
    useCallback(() => {
      void loadDashboard(selectedDate);
    }, [loadDashboard, selectedDate]),
  );

  const calorieTarget = Math.max(Number(targets.calorie_target) || 0, 0);

  const remainingCalories = Math.max(
    calorieTarget - nutrition.calories,
    0,
  );

  const dateLabel = formatSelectedDate(selectedDate);

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Log out"
            style={({ pressed }) => [
              styles.logoutButton,
              pressed && styles.pressed,
              loggingOut && styles.logoutButtonDisabled,
            ]}
            onPress={() => void handleLogout()}
            disabled={loggingOut}
          >
            {loggingOut ? (
              <ActivityIndicator color="#FF9999" size="small" />
            ) : (
              <>
                <FontAwesome5
                  name="sign-out-alt"
                  size={14}
                  color="#FF9999"
                />
                <Text style={styles.logoutButtonText}>Log out</Text>
              </>
            )}
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open settings"
            style={({ pressed }) => [
              styles.settingsButton,
              pressed && styles.pressed,
            ]}
            onPress={() => navigation.navigate('Settings')}
          >
            <Text style={styles.settingsIcon}>⚙</Text>
          </Pressable>
        </View>

        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>YOUR FITNESS OVERVIEW</Text>
            <Text style={styles.title}>{isToday ? 'Today' : 'Dashboard'}</Text>
            <Text style={styles.subtitle}>{dateLabel}</Text>
          </View>
        </View>

        <View style={styles.dateNavigation}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View previous day"
            style={({ pressed }) => [
              styles.dateArrow,
              pressed && styles.pressed,
            ]}
            onPress={() => changeDate(-1)}
          >
            <Text style={styles.dateArrowText}>‹</Text>
          </Pressable>

          <View style={styles.dateNavigationCenter}>
            <Text style={styles.dateNavigationTitle}>
              {isToday
                ? 'Today’s results'
                : localDate(selectedDate) ===
                    localDate(addDays(new Date(), -1))
                  ? 'Yesterday’s results'
                  : 'Daily results'}
            </Text>
            <Text style={styles.dateNavigationSubtitle}>
              Browse your daily nutrition and activity
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View next day"
            disabled={isToday}
            style={({ pressed }) => [
              styles.dateArrow,
              isToday && styles.dateArrowDisabled,
              pressed && !isToday && styles.pressed,
            ]}
            onPress={() => changeDate(1)}
          >
            <Text
              style={[
                styles.dateArrowText,
                isToday && styles.dateArrowTextDisabled,
              ]}
            >
              ›
            </Text>
          </Pressable>
        </View>

        {!isToday && (
          <Pressable
            style={({ pressed }) => [
              styles.todayButton,
              pressed && styles.pressed,
            ]}
            onPress={() => setSelectedDate(new Date())}
          >
            <FontAwesome5 name="calendar-day" size={12} color={GREEN} />
            <Text style={styles.todayButtonText}>Back to today</Text>
          </Pressable>
        )}

        {loading ? (
          <ActivityIndicator
            color={GREEN}
            size="large"
            style={styles.loader}
          />
        ) : (
          <>
            <View style={styles.calorieCard}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.cardTitle}>Daily calories</Text>
                  <Text style={styles.cardSubtitle}>
                    {isToday
                      ? 'Keep your nutrition on track'
                      : 'Nutrition recorded on this day'}
                  </Text>
                </View>

                <View style={styles.liveBadge}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>
                    {isToday ? 'TODAY' : 'HISTORY'}
                  </Text>
                </View>
              </View>

              <CalorieRing
                calories={nutrition.calories}
                target={calorieTarget}
              />

              <View style={styles.calorieFooter}>
                <View style={styles.calorieFooterItem}>
                  <Text style={styles.footerValue}>
                    {Math.round(nutrition.calories).toLocaleString('en-AU')}
                  </Text>
                  <Text style={styles.footerLabel}>Eaten</Text>
                </View>

                <View style={styles.footerDivider} />

                <View style={styles.calorieFooterItem}>
                  <Text style={[styles.footerValue, { color: GREEN }]}>
                    {remainingCalories.toLocaleString('en-AU')}
                  </Text>
                  <Text style={styles.footerLabel}>Remaining</Text>
                </View>

                <View style={styles.footerDivider} />

                <View style={styles.calorieFooterItem}>
                  <Text style={styles.footerValue}>
                    {calorieTarget.toLocaleString('en-AU')}
                  </Text>
                  <Text style={styles.footerLabel}>Daily goal</Text>
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionTitle}>Your macros</Text>
                  <Text style={styles.sectionSubtitle}>
                    Intake versus your daily targets
                  </Text>
                </View>

                <Pressable
                  onPress={() => navigation.navigate('Settings')}
                  hitSlop={8}
                >
                  <Text style={styles.editLink}>Edit goals ↗</Text>
                </Pressable>
              </View>

              <View style={styles.macroCard}>
                <ProgressBar
                  label="Protein"
                  value={nutrition.protein}
                  target={Number(targets.protein_target) || 0}
                  color={GREEN}
                />

                <ProgressBar
                  label="Carbs"
                  value={nutrition.carbs}
                  target={Number(targets.carbs_target) || 0}
                  color={BLUE}
                />

                <ProgressBar
                  label="Fat"
                  value={nutrition.fat}
                  target={Number(targets.fat_target) || 0}
                  color={ORANGE}
                />
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Quick actions</Text>
              <Text style={styles.sectionSubtitle}>
                Keep your day moving
              </Text>

              <View style={styles.actionsGrid}>
                <Pressable
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.actionCard,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => navigation.navigate('Food')}
                >
                  <View
                    style={[
                      styles.actionIcon,
                      { backgroundColor: '#263B30' },
                    ]}
                  >
                    <FontAwesome5
                      name="apple-alt"
                      size={20}
                      color={GREEN}
                    />
                  </View>

                  <Text style={styles.actionTitle}>Log food</Text>
                  <Text style={styles.actionDescription}>
                    Track your meals
                  </Text>
                  <Text style={styles.actionArrow}>↗</Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.actionCard,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => navigation.navigate('Workouts')}
                >
                  <View
                    style={[
                      styles.actionIcon,
                      { backgroundColor: '#26354A' },
                    ]}
                  >
                    <FontAwesome5
                      name="dumbbell"
                      size={20}
                      color={BLUE}
                    />
                  </View>

                  <Text style={styles.actionTitle}>Workout</Text>
                  <Text style={styles.actionDescription}>
                    Hit the gym
                  </Text>
                  <Text style={styles.actionArrow}>↗</Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.actionCard,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => navigation.navigate('Progress')}
                >
                  <View
                    style={[
                      styles.actionIcon,
                      { backgroundColor: '#3A304B' },
                    ]}
                  >
                    <FontAwesome5
                      name="balance-scale"
                      size={20}
                      color={PURPLE}
                    />
                  </View>

                  <Text style={styles.actionTitle}>Log weight</Text>
                  <Text style={styles.actionDescription}>
                    Track progress
                  </Text>
                  <Text style={styles.actionArrow}>↗</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {isToday ? "Today's activity" : "Activity on this day"}
              </Text>

              <Pressable
                style={({ pressed }) => [
                  styles.todayWorkoutCard,
                  pressed && styles.pressed,
                ]}
                onPress={() => navigation.navigate('Workouts')}
              >
                <View
                  style={[
                    styles.activityIcon,
                    todayWorkout?.finished_at
                      ? styles.activityIconComplete
                      : null,
                  ]}
                >
                  <Text style={styles.activityEmoji}>
                    {todayWorkout?.finished_at ? '✓' : '↗'}
                  </Text>
                </View>

                <View style={styles.activityInfo}>
                  <Text style={styles.activityTitle}>
                    {!todayWorkout
                      ? 'No workout started'
                      : todayWorkout.finished_at
                        ? 'Workout completed'
                        : 'Workout in progress'}
                  </Text>

                  <Text style={styles.activitySubtitle}>
                    {!todayWorkout
                      ? isToday
                        ? 'Start a session when you’re ready.'
                        : 'No workout was started on this date.'
                      : `${todayWorkout.name?.trim() || 'Workout'} · ${formatTime(
                          todayWorkout.started_at,
                        )}`}
                  </Text>
                </View>

                <View style={styles.activityArrowContainer}>
                  <Text style={styles.activityArrow}>›</Text>
                </View>
              </Pressable>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionTitle}>Recent workouts</Text>
                  <Text style={styles.sectionSubtitle}>
                    Your latest completed sessions
                  </Text>
                </View>

                <Pressable
                  onPress={() => navigation.navigate('Workouts')}
                  hitSlop={8}
                >
                  <Text style={styles.editLink}>View all ↗</Text>
                </Pressable>
              </View>

              <View style={styles.recentCard}>
                {workouts.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyIcon}>◷</Text>
                    <Text style={styles.emptyTitle}>
                      Your journey starts here
                    </Text>
                    <Text style={styles.emptyText}>
                      Complete your first workout and it’ll show up here.
                    </Text>

                    <Pressable
                      style={styles.emptyButton}
                      onPress={() => navigation.navigate('Workouts')}
                    >
                      <Text style={styles.emptyButtonText}>
                        Start a workout
                      </Text>
                    </Pressable>
                  </View>
                ) : (
                  workouts.map((workout, index) => (
                    <View
                      key={workout.id}
                      style={[
                        styles.workoutRow,
                        index === workouts.length - 1 &&
                          styles.lastWorkoutRow,
                      ]}
                    >
                      <View style={styles.workoutIcon}>
                        <Text style={styles.workoutIconText}>✓</Text>
                      </View>

                      <View style={styles.workoutInfo}>
                        <Text style={styles.workoutName}>
                          {workout.name?.trim() || 'Workout'}
                        </Text>

                        <Text style={styles.workoutDate}>
                          {formatDate(workout.started_at)} ·{' '}
                          {formatTime(workout.started_at)}
                        </Text>
                      </View>

                      <Text style={styles.completedLabel}>Done</Text>
                    </View>
                  ))
                )}
              </View>
            </View>

            <Pressable
              style={styles.refreshButton}
              onPress={() => void loadDashboard(selectedDate, false)}
              disabled={refreshing}
            >
              {refreshing ? (
                <ActivityIndicator color={GREEN} size="small" />
              ) : (
                <Text style={styles.refreshIcon}>↻</Text>
              )}

              <Text style={styles.refreshText}>
                {refreshing ? 'Refreshing dashboard…' : 'Refresh dashboard'}
              </Text>
            </Pressable>

            <Text style={styles.footerNote}>
              Your dashboard updates when you change dates or return to this
              tab.
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111111',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 58,
    paddingBottom: 36,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 13,
    borderRadius: 12,
    backgroundColor: '#292020',
    borderWidth: 1,
    borderColor: '#483030',
    minHeight: 42,
  },
  logoutButtonDisabled: {
    opacity: 0.6,
  },
  logoutButtonText: {
    color: '#FF9999',
    fontSize: 12,
    fontWeight: '700',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  headerText: {
    flex: 1,
  },
  eyebrow: {
    color: GREEN,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.7,
    marginBottom: 7,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.7,
  },
  subtitle: {
    color: '#888888',
    fontSize: 13,
    marginTop: 5,
  },
  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: '#202020',
    borderWidth: 1,
    borderColor: '#303030',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsIcon: {
    fontSize: 22,
    color: '#DDDDDD',
  },
  dateNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C1C',
    borderWidth: 1,
    borderColor: '#292929',
    borderRadius: 16,
    padding: 10,
    marginBottom: 12,
  },
  dateArrow: {
    width: 40,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#292929',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateArrowDisabled: {
    opacity: 0.35,
  },
  dateArrowText: {
    color: GREEN,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '600',
  },
  dateArrowTextDisabled: {
    color: '#777777',
  },
  dateNavigationCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  dateNavigationTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  dateNavigationSubtitle: {
    color: '#888888',
    fontSize: 10,
    textAlign: 'center',
    marginTop: 4,
  },
  todayButton: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#263B30',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    marginBottom: 14,
  },
  todayButtonText: {
    color: GREEN,
    fontSize: 11,
    fontWeight: '800',
  },
  loader: {
    marginTop: 70,
  },
  calorieCard: {
    backgroundColor: '#1C1C1C',
    borderRadius: 25,
    paddingHorizontal: 18,
    paddingTop: 21,
    paddingBottom: 18,
    borderWidth: 1,
    borderColor: '#292929',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  cardSubtitle: {
    color: '#888888',
    fontSize: 12,
    marginTop: 5,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#263B30',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: GREEN,
    marginRight: 6,
  },
  liveText: {
    color: GREEN,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  ringContainer: {
    height: RING_SIZE,
    width: RING_SIZE,
    alignSelf: 'center',
    marginTop: 15,
    marginBottom: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringCentre: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringEyebrow: {
    color: '#999999',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  ringCalories: {
    color: '#FFFFFF',
    fontSize: 35,
    fontWeight: '800',
    letterSpacing: -0.8,
    marginTop: 5,
  },
  ringTarget: {
    color: '#999999',
    fontSize: 12,
    marginTop: 3,
  },
  ringDivider: {
    width: 45,
    height: 1,
    backgroundColor: '#393939',
    marginTop: 12,
    marginBottom: 9,
  },
  ringRemaining: {
    color: GREEN,
    fontSize: 13,
    fontWeight: '700',
  },
  ringPercentage: {
    position: 'absolute',
    right: 4,
    bottom: 15,
    backgroundColor: '#263B30',
    borderWidth: 2,
    borderColor: '#1C1C1C',
    borderRadius: 15,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  ringPercentageText: {
    color: GREEN,
    fontSize: 11,
    fontWeight: '800',
  },
  calorieFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#242424',
    borderRadius: 16,
    paddingVertical: 15,
    marginTop: 1,
  },
  calorieFooterItem: {
    flex: 1,
    alignItems: 'center',
  },
  footerValue: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  footerLabel: {
    color: '#888888',
    fontSize: 10,
    marginTop: 5,
  },
  footerDivider: {
    width: 1,
    height: 29,
    backgroundColor: '#3A3A3A',
  },
  section: {
    marginTop: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 13,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    color: '#888888',
    fontSize: 12,
    marginTop: 5,
  },
  editLink: {
    color: GREEN,
    fontSize: 11,
    fontWeight: '700',
  },
  macroCard: {
    backgroundColor: '#1C1C1C',
    borderRadius: 20,
    paddingHorizontal: 17,
    paddingTop: 19,
    paddingBottom: 2,
    borderWidth: 1,
    borderColor: '#292929',
  },
  macroItem: {
    marginBottom: 20,
  },
  macroHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  macroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  macroDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  macroLabel: {
    color: '#EEEEEE',
    fontSize: 13,
    fontWeight: '700',
  },
  macroAmount: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  macroTarget: {
    color: '#888888',
    fontWeight: '500',
  },
  macroTrack: {
    height: 8,
    backgroundColor: '#333333',
    borderRadius: 10,
    overflow: 'hidden',
  },
  macroFill: {
    height: '100%',
    borderRadius: 10,
  },
  macroPercentage: {
    color: '#777777',
    fontSize: 10,
    marginTop: 7,
  },
  actionsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  actionCard: {
    flex: 1,
    minWidth: 0,
    backgroundColor: '#1C1C1C',
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: '#292929',
    minHeight: 145,
  },
  pressed: {
    opacity: 0.72,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 13,
  },
  actionEmoji: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '700',
  },
  actionTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  actionDescription: {
    color: '#888888',
    fontSize: 10,
    lineHeight: 15,
    marginTop: 5,
  },
  actionArrow: {
    color: GREEN,
    fontSize: 13,
    fontWeight: '700',
    position: 'absolute',
    top: 15,
    right: 12,
  },
  todayWorkoutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C1C',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#292929',
    marginTop: 13,
  },
  activityIcon: {
    width: 43,
    height: 43,
    borderRadius: 14,
    backgroundColor: '#26354A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activityIconComplete: {
    backgroundColor: '#263B30',
  },
  activityEmoji: {
    color: GREEN,
    fontSize: 20,
    fontWeight: '800',
  },
  activityInfo: {
    flex: 1,
  },
  activityTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  activitySubtitle: {
    color: '#888888',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 5,
  },
  activityArrowContainer: {
    marginLeft: 8,
  },
  activityArrow: {
    color: '#888888',
    fontSize: 27,
  },
  recentCard: {
    backgroundColor: '#1C1C1C',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#292929',
    marginTop: 1,
  },
  workoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 15,
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#303030',
  },
  lastWorkoutRow: {
    borderBottomWidth: 0,
    paddingBottom: 0,
    marginBottom: 0,
  },
  workoutIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#263B30',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },
  workoutIconText: {
    color: GREEN,
    fontSize: 16,
    fontWeight: '800',
  },
  workoutInfo: {
    flex: 1,
  },
  workoutName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  workoutDate: {
    color: '#888888',
    fontSize: 10,
    marginTop: 5,
  },
  completedLabel: {
    color: GREEN,
    fontSize: 10,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 8,
  },
  emptyIcon: {
    color: GREEN,
    fontSize: 30,
    marginBottom: 12,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  emptyText: {
    color: '#888888',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 7,
  },
  emptyButton: {
    backgroundColor: '#263B30',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 15,
  },
  emptyButtonText: {
    color: GREEN,
    fontSize: 12,
    fontWeight: '800',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1C1C1C',
    borderWidth: 1,
    borderColor: '#303030',
    borderRadius: 13,
    paddingVertical: 13,
    marginTop: 26,
  },
  refreshIcon: {
    color: GREEN,
    fontSize: 19,
    marginRight: 8,
  },
  refreshText: {
    color: GREEN,
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 8,
  },
  footerNote: {
    color: '#666666',
    fontSize: 10,
    lineHeight: 16,
    marginTop: 17,
    textAlign: 'center',
  },
});