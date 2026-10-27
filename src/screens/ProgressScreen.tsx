
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../services/supabase';
import { loadFitnessSettings } from '../services/fitnessSettings';

const COLORS = {
  background: '#111111',
  card: '#1C1C1C',
  border: '#303030',
  text: '#FFFFFF',
  muted: '#888888',
  green: '#72D6A0',
  red: '#FF7777',
  track: '#303030',
};

const DAYS_TO_SHOW = 7;
const HISTORY_DAYS = 28;
const STRENGTH_HISTORY_DAYS = 365;

type WorkoutSession = {
  id: string;
  name: string | null;
  started_at: string;
  finished_at: string | null;
};

type WorkoutSet = {
  session_id: string;
  exercise_name: string;
  reps: number | null;
  weight_kg: number | null;
  created_at: string;
  completed_at: string | null;
};

type FoodLog = {
  date: string;
  calories_per_100g: number | null;
  quantity_grams: number | null;
};

type WeightLog = {
  id: string;
  weight_kg: number;
  logged_at: string;
  created_at?: string;
};

type DailyWeight = {
  date: string;
  weight: number;
};

type StrengthPoint = {
  date: string;
  weight: number;
  reps: number;
  estimatedOneRepMax: number;
};

type StrengthRecord = {
  name: string;
  weight: number;
  reps: number;
  estimatedOneRepMax: number;
  date: string;
  sets: number;
};

function localDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function formatDate(dateString: string): string {
  return new Date(`${dateString}T12:00:00`).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
  });
}

function formatTimestamp(timestamp: string): string {
  return new Date(timestamp).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function signedWeight(value: number): string {
  if (Math.abs(value) < 0.05) return '0.0 kg';
  return `${value > 0 ? '+' : ''}${value.toFixed(1)} kg`;
}

function estimateOneRepMax(weight: number, reps: number): number {
  if (reps <= 1) return weight;
  return weight * (1 + Math.min(reps, 30) / 30);
}

function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      {detail ? <Text style={styles.statDetail}>{detail}</Text> : null}
    </View>
  );
}

function WeightLineChart({ data }: { data: DailyWeight[] }) {
  const width = 320;
  const height = 190;
  const left = 34;
  const right = 12;
  const top = 24;
  const bottom = 42;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;

  const values = data.map((item) => item.weight);
  const actualMin = Math.min(...values);
  const actualMax = Math.max(...values);
  const range = actualMax - actualMin;
  const padding = Math.max(range * 0.25, 0.5);
  const min = actualMin - padding;
  const max = actualMax + padding;

  const points = data.map((item, index) => {
    const x =
      data.length === 1
        ? left + plotWidth / 2
        : left + (index / (data.length - 1)) * plotWidth;

    const y = top + ((max - item.weight) / (max - min)) * plotHeight;

    return { ...item, x, y };
  });

  const polylinePoints = points.map((point) => `${point.x},${point.y}`).join(' ');
  const gridValues = [0, 1, 2, 3].map(
    (index) => max - ((max - min) * index) / 3,
  );

  return (
    <View style={styles.lineChartContainer}>
      <Svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {gridValues.map((value, index) => {
          const y = top + (index / 3) * plotHeight;

          return (
            <React.Fragment key={index}>
              <Line
                x1={left}
                y1={y}
                x2={width - right}
                y2={y}
                stroke={COLORS.border}
                strokeWidth={1}
                strokeDasharray="4,4"
              />
              <SvgText
                x={left - 6}
                y={y + 4}
                fill={COLORS.muted}
                fontSize={10}
                textAnchor="end"
              >
                {value.toFixed(1)}
              </SvgText>
            </React.Fragment>
          );
        })}

        {data.length > 1 && (
          <Polyline
            points={polylinePoints}
            fill="none"
            stroke={COLORS.green}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {points.map((point, index) => (
          <React.Fragment key={point.date}>
            <Circle
              cx={point.x}
              cy={point.y}
              r={5}
              fill={COLORS.green}
              stroke={COLORS.card}
              strokeWidth={2}
            />
            <SvgText
              x={point.x}
              y={Math.max(top - 5, point.y - 12)}
              fill={COLORS.text}
              fontSize={10}
              fontWeight="bold"
              textAnchor="middle"
            >
              {point.weight.toFixed(1)}
            </SvgText>
            {(data.length <= 5 ||
              index === 0 ||
              index === data.length - 1 ||
              index === Math.floor((data.length - 1) / 2)) && (
              <SvgText
                x={point.x}
                y={height - 12}
                fill={COLORS.muted}
                fontSize={10}
                textAnchor="middle"
              >
                {formatDate(point.date)}
              </SvgText>
            )}
          </React.Fragment>
        ))}
      </Svg>
    </View>
  );
}

function StrengthLineChart({ data }: { data: StrengthPoint[] }) {
  const width = 320;
  const height = 205;
  const left = 38;
  const right = 14;
  const top = 24;
  const bottom = 44;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;

  if (data.length === 0) return null;

  const values = data.map((point) => point.estimatedOneRepMax);
  const actualMin = Math.min(...values);
  const actualMax = Math.max(...values);
  const range = actualMax - actualMin;
  const padding = Math.max(range * 0.2, 2);
  const min = Math.max(0, actualMin - padding);
  const max = actualMax + padding;

  const points = data.map((item, index) => {
    const x =
      data.length === 1
        ? left + plotWidth / 2
        : left + (index / (data.length - 1)) * plotWidth;

    const y =
      top + ((max - item.estimatedOneRepMax) / (max - min || 1)) * plotHeight;

    return { ...item, x, y };
  });

  const polylinePoints = points.map((point) => `${point.x},${point.y}`).join(' ');
  const gridValues = [0, 1, 2, 3].map(
    (index) => max - ((max - min) * index) / 3,
  );

  return (
    <View style={styles.lineChartContainer}>
      <Svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {gridValues.map((value, index) => {
          const y = top + (index / 3) * plotHeight;

          return (
            <React.Fragment key={index}>
              <Line
                x1={left}
                y1={y}
                x2={width - right}
                y2={y}
                stroke={COLORS.border}
                strokeWidth={1}
                strokeDasharray="4,4"
              />
              <SvgText
                x={left - 7}
                y={y + 4}
                fill={COLORS.muted}
                fontSize={10}
                textAnchor="end"
              >
                {Math.round(value)}
              </SvgText>
            </React.Fragment>
          );
        })}

        {data.length > 1 && (
          <Polyline
            points={polylinePoints}
            fill="none"
            stroke={COLORS.green}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {points.map((point, index) => (
          <React.Fragment key={`${point.date}-${index}`}>
            <Circle
              cx={point.x}
              cy={point.y}
              r={5}
              fill={COLORS.green}
              stroke={COLORS.card}
              strokeWidth={2}
            />
            <SvgText
              x={point.x}
              y={Math.max(top - 5, point.y - 12)}
              fill={COLORS.text}
              fontSize={10}
              fontWeight="bold"
              textAnchor="middle"
            >
              {Math.round(point.estimatedOneRepMax)}
            </SvgText>
            {(data.length <= 5 ||
              index === 0 ||
              index === data.length - 1 ||
              index === Math.floor((data.length - 1) / 2)) && (
              <SvgText
                x={point.x}
                y={height - 12}
                fill={COLORS.muted}
                fontSize={10}
                textAnchor="middle"
              >
                {formatDate(point.date)}
              </SvgText>
            )}
          </React.Fragment>
        ))}
      </Svg>
    </View>
  );
}

export default function ProgressScreen() {
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [strengthSessions, setStrengthSessions] = useState<WorkoutSession[]>([]);
  const [sets, setSets] = useState<WorkoutSet[]>([]);
  const [foodLogs, setFoodLogs] = useState<FoodLog[]>([]);
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null);
  const [weightInput, setWeightInput] = useState('');
  const [savingWeight, setSavingWeight] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [calorieTarget, setCalorieTarget] = useState(2400);
  const [workoutDaysTarget, setWorkoutDaysTarget] = useState(4);

  const loadProgress = useCallback(async () => {
    setErrorMessage(null);

    try {
      const savedTargets = await loadFitnessSettings();
      setCalorieTarget(savedTargets.calorie_target);
      setWorkoutDaysTarget(savedTargets.workout_days_target);
    } catch (error) {
      setErrorMessage(
        `Fitness settings: ${
          error instanceof Error ? error.message : 'Could not load targets.'
        }`,
      );
    }

    const today = new Date();
    const todayStart = startOfDay(today);

    const fourWeeksAgo = new Date(todayStart);
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - (HISTORY_DAYS - 1));

    const sevenDaysAgo = new Date(todayStart);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - (DAYS_TO_SHOW - 1));

    const weightHistoryStart = new Date(todayStart);
    weightHistoryStart.setDate(weightHistoryStart.getDate() - 89);

    const strengthHistoryStart = new Date(todayStart);
    strengthHistoryStart.setDate(
      strengthHistoryStart.getDate() - (STRENGTH_HISTORY_DAYS - 1),
    );

    const [
      sessionsResult,
      strengthSessionsResult,
      setsResult,
      foodResult,
      weightsResult,
    ] = await Promise.all([
      supabase
        .from('workout_sessions')
        .select('id, name, started_at, finished_at')
        .not('finished_at', 'is', null)
        .gte('started_at', fourWeeksAgo.toISOString())
        .order('started_at', { ascending: false }),

      supabase
        .from('workout_sessions')
        .select('id, name, started_at, finished_at')
        .not('finished_at', 'is', null)
        .gte('started_at', strengthHistoryStart.toISOString())
        .order('started_at', { ascending: true }),

      supabase
        .from('workout_sets')
        .select(
          'session_id, exercise_name, reps, weight_kg, created_at, completed_at',
        )
        .not('completed_at', 'is', null)
        .gte('completed_at', strengthHistoryStart.toISOString())
        .order('completed_at', { ascending: true })
        .limit(2000),

      supabase
        .from('food_logs')
        .select('date, calories_per_100g, quantity_grams')
        .gte('date', localDate(sevenDaysAgo))
        .lte('date', localDate(today)),

      supabase
        .from('weight_logs')
        .select('id, weight_kg, logged_at, created_at')
        .gte('logged_at', weightHistoryStart.toISOString())
        .lte('logged_at', today.toISOString())
        .order('logged_at', { ascending: false }),
    ]);

    if (sessionsResult.error) {
      setErrorMessage(`Workout history: ${sessionsResult.error.message}`);
    } else {
      setSessions(sessionsResult.data ?? []);
    }

    if (strengthSessionsResult.error) {
      setErrorMessage((previous) =>
        previous
          ? `${previous}\nStrength sessions: ${strengthSessionsResult.error.message}`
          : `Strength sessions: ${strengthSessionsResult.error.message}`,
      );
      setStrengthSessions([]);
    } else {
      setStrengthSessions(strengthSessionsResult.data ?? []);
    }

    if (setsResult.error) {
      setErrorMessage((previous) =>
        previous
          ? `${previous}\nStrength history: ${setsResult.error.message}`
          : `Strength history: ${setsResult.error.message}`,
      );
      setSets([]);
    } else {
      setSets(setsResult.data ?? []);
    }

    if (foodResult.error) {
      setErrorMessage((previous) =>
        previous
          ? `${previous}\nFood history: ${foodResult.error.message}`
          : `Food history: ${foodResult.error.message}`,
      );
    } else {
      setFoodLogs(foodResult.data ?? []);
    }

    if (weightsResult.error) {
      setErrorMessage((previous) =>
        previous
          ? `${previous}\nWeight history: ${weightsResult.error.message}`
          : `Weight history: ${weightsResult.error.message}`,
      );
    } else {
      setWeightLogs(weightsResult.data ?? []);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const load = async () => {
        setLoading(true);
        await loadProgress();
        if (active) setLoading(false);
      };

      void load();

      return () => {
        active = false;
      };
    }, [loadProgress]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadProgress();
    } finally {
      setRefreshing(false);
    }
  }, [loadProgress]);

  const saveWeight = async () => {
    const weight = Number(weightInput.trim().replace(',', '.'));

    if (
      !weightInput.trim() ||
      !Number.isFinite(weight) ||
      weight <= 0 ||
      weight > 500
    ) {
      Alert.alert('Invalid weight', 'Enter a valid weight in kilograms.');
      return;
    }

    setSavingWeight(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user) {
        throw new Error('You need to be signed in to save a weigh-in.');
      }

      const { error } = await supabase.from('weight_logs').insert({
        user_id: user.id,
        weight_kg: weight,
        logged_at: new Date().toISOString(),
      });

      if (error) throw error;

      setWeightInput('');
      await loadProgress();
      Alert.alert('Weight saved', `${weight.toFixed(1)} kg recorded.`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Something went wrong.';
      Alert.alert('Could not save weight', message);
    } finally {
      setSavingWeight(false);
    }
  };

  const latestWeight = useMemo(() => {
    if (weightLogs.length === 0) return null;

    return [...weightLogs].sort(
      (a, b) =>
        new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime(),
    )[0];
  }, [weightLogs]);

  const dailyWeights = useMemo<DailyWeight[]>(() => {
    const byDate = new Map<string, WeightLog>();

    for (const log of [...weightLogs].sort(
      (a, b) =>
        new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime(),
    )) {
      const date = localDate(new Date(log.logged_at));
      byDate.set(date, log);
    }

    return Array.from(byDate.entries())
      .map(([date, log]) => ({
        date,
        weight: Number(log.weight_kg),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [weightLogs]);

  const weeklyAverage = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 6);

    const recent = dailyWeights.filter(
      (entry) => entry.date >= localDate(startOfDay(cutoff)),
    );

    if (recent.length === 0) return null;

    return recent.reduce((sum, entry) => sum + entry.weight, 0) / recent.length;
  }, [dailyWeights]);

  const weightChange = useMemo(() => {
    if (dailyWeights.length < 2) return null;

    return (
      dailyWeights[dailyWeights.length - 1].weight -
      dailyWeights[0].weight
    );
  }, [dailyWeights]);

  const chartWeights = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 6);
    const cutoffDate = localDate(startOfDay(cutoff));

    return dailyWeights.filter((entry) => entry.date >= cutoffDate);
  }, [dailyWeights]);

  const completedStrengthSets = useMemo(() => {
    const finishedSessionIds = new Set(
      strengthSessions.map((session) => session.id),
    );

    return sets.filter((set) => {
      const weight = Number(set.weight_kg);
      const reps = Number(set.reps);

      return (
        finishedSessionIds.has(set.session_id) &&
        Boolean(set.completed_at) &&
        Boolean(set.exercise_name?.trim()) &&
        Number.isFinite(weight) &&
        weight > 0 &&
        Number.isFinite(reps) &&
        reps > 0
      );
    });
  }, [sets, strengthSessions]);

  const strengthRecords = useMemo<StrengthRecord[]>(() => {
    const records = new Map<string, StrengthRecord>();

    for (const set of completedStrengthSets) {
      const name = set.exercise_name.trim();
      const weight = Number(set.weight_kg);
      const reps = Number(set.reps);
      const estimatedOneRepMax = estimateOneRepMax(weight, reps);
      const date = localDate(new Date(set.completed_at!));
      const existing = records.get(name);

      if (!existing) {
        records.set(name, {
          name,
          weight,
          reps,
          estimatedOneRepMax,
          date,
          sets: 1,
        });
        continue;
      }

      existing.sets += 1;

      if (weight > existing.weight) {
        existing.weight = weight;
        existing.reps = reps;
        existing.date = date;
      }

      existing.estimatedOneRepMax = Math.max(
        existing.estimatedOneRepMax,
        estimatedOneRepMax,
      );
    }

    return Array.from(records.values()).sort(
      (a, b) => b.estimatedOneRepMax - a.estimatedOneRepMax,
    );
  }, [completedStrengthSets]);

  const exerciseNames = useMemo(
    () => strengthRecords.map((record) => record.name).sort((a, b) => a.localeCompare(b)),
    [strengthRecords],
  );

  const activeExercise = useMemo(() => {
    if (exerciseNames.length === 0) return null;
    if (selectedExercise && exerciseNames.includes(selectedExercise)) {
      return selectedExercise;
    }
    return exerciseNames[0];
  }, [exerciseNames, selectedExercise]);

  const selectedExerciseSets = useMemo(() => {
    if (!activeExercise) return [];

    return completedStrengthSets
      .filter((set) => set.exercise_name.trim() === activeExercise)
      .sort(
        (a, b) =>
          new Date(a.completed_at!).getTime() -
          new Date(b.completed_at!).getTime(),
      );
  }, [activeExercise, completedStrengthSets]);

  const selectedExerciseHistory = useMemo<StrengthPoint[]>(() => {
    const byDate = new Map<string, StrengthPoint>();

    for (const set of selectedExerciseSets) {
      const weight = Number(set.weight_kg);
      const reps = Number(set.reps);
      const date = localDate(new Date(set.completed_at!));
      const estimatedOneRepMax = estimateOneRepMax(weight, reps);
      const existing = byDate.get(date);

      if (!existing || estimatedOneRepMax > existing.estimatedOneRepMax) {
        byDate.set(date, {
          date,
          weight,
          reps,
          estimatedOneRepMax,
        });
      }
    }

    return Array.from(byDate.values()).sort((a, b) =>
      a.date.localeCompare(b.date),
    );
  }, [selectedExerciseSets]);

  const selectedExerciseStats = useMemo(() => {
    if (selectedExerciseSets.length === 0) return null;

    let heaviestSet = selectedExerciseSets[0];
    let bestEstimatedOneRepMax = 0;

    for (const set of selectedExerciseSets) {
      const weight = Number(set.weight_kg);
      const reps = Number(set.reps);

      if (weight > Number(heaviestSet.weight_kg)) {
        heaviestSet = set;
      }

      bestEstimatedOneRepMax = Math.max(
        bestEstimatedOneRepMax,
        estimateOneRepMax(weight, reps),
      );
    }

    const firstPoint = selectedExerciseHistory[0];
    const latestPoint =
      selectedExerciseHistory[selectedExerciseHistory.length - 1];

    const estimatedChange =
      firstPoint && latestPoint
        ? latestPoint.estimatedOneRepMax - firstPoint.estimatedOneRepMax
        : null;

    return {
      heaviestWeight: Number(heaviestSet.weight_kg),
      heaviestReps: Number(heaviestSet.reps),
      heaviestDate: heaviestSet.completed_at!,
      bestEstimatedOneRepMax,
      estimatedChange,
      completedSetCount: selectedExerciseSets.length,
      workoutCount: selectedExerciseHistory.length,
    };
  }, [selectedExerciseSets, selectedExerciseHistory]);

  const workoutBars = useMemo(() => {
    const days: { label: string; count: number }[] = [];

    for (let offset = HISTORY_DAYS - 1; offset >= 0; offset--) {
      const date = new Date();
      date.setDate(date.getDate() - offset);
      const key = localDate(date);

      const count = sessions.filter(
        (session) => localDate(new Date(session.started_at)) === key,
      ).length;

      days.push({
        label: date.toLocaleDateString('en-AU', { weekday: 'narrow' }),
        count,
      });
    }

    return days;
  }, [sessions]);

  const calorieDays = useMemo(() => {
    const days: { date: string; label: string; calories: number }[] = [];

    for (let offset = DAYS_TO_SHOW - 1; offset >= 0; offset--) {
      const date = new Date();
      date.setDate(date.getDate() - offset);
      const key = localDate(date);

      const calories = foodLogs
        .filter((log) => log.date === key)
        .reduce(
          (total, log) =>
            total +
            ((Number(log.calories_per_100g) || 0) *
              (Number(log.quantity_grams) || 0)) /
              100,
          0,
        );

      days.push({
        date: key,
        label: date.toLocaleDateString('en-AU', { weekday: 'narrow' }),
        calories,
      });
    }

    return days;
  }, [foodLogs]);

  const loggedCalorieDays = calorieDays.filter((day) => day.calories > 0);

  const averageCalories =
    loggedCalorieDays.length > 0
      ? loggedCalorieDays.reduce((sum, day) => sum + day.calories, 0) /
        loggedCalorieDays.length
      : 0;

  const maxCalories = Math.max(
    calorieTarget,
    ...calorieDays.map((day) => day.calories),
  );

  const workoutCount = sessions.length;
  const activeWorkoutDays = workoutBars.filter((day) => day.count > 0).length;

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={COLORS.green} />
        <Text style={styles.loadingText}>Loading your progress...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={COLORS.green}
        />
      }
    >
      <Text style={styles.title}>Progress</Text>
      <Text style={styles.subtitle}>
        Your training, nutrition and bodyweight over time.
      </Text>

      {errorMessage ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>Some data could not be loaded</Text>
          <Text style={styles.errorText}>{errorMessage}</Text>
          <Text style={styles.errorHint}>
            Pull down to refresh. Check the table name and Supabase permissions
            if an error persists.
          </Text>
        </View>
      ) : null}

      <SectionTitle>Bodyweight</SectionTitle>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Log your weight</Text>
        <Text style={styles.mutedText}>Record a weigh-in in kilograms.</Text>

        <View style={styles.weightInputRow}>
          <TextInput
            style={styles.weightInput}
            value={weightInput}
            onChangeText={setWeightInput}
            placeholder="e.g. 82.5"
            placeholderTextColor={COLORS.muted}
            keyboardType="decimal-pad"
            returnKeyType="done"
            maxLength={7}
          />

          <Text style={styles.kgLabel}>kg</Text>

          <Pressable
            style={[styles.saveButton, savingWeight && styles.disabledButton]}
            onPress={saveWeight}
            disabled={savingWeight}
          >
            {savingWeight ? (
              <ActivityIndicator color={COLORS.background} />
            ) : (
              <Text style={styles.saveButtonText}>Save</Text>
            )}
          </Pressable>
        </View>

        <View style={styles.statGrid}>
          <StatCard
            label="Latest weight"
            value={
              latestWeight
                ? `${Number(latestWeight.weight_kg).toFixed(1)} kg`
                : '—'
            }
            detail={
              latestWeight
                ? formatTimestamp(latestWeight.logged_at)
                : 'No weigh-ins yet'
            }
          />

          <StatCard
            label="7-day average"
            value={
              weeklyAverage !== null ? `${weeklyAverage.toFixed(1)} kg` : '—'
            }
            detail="Based on logged days"
          />

          <StatCard
            label="Recorded change"
            value={weightChange !== null ? signedWeight(weightChange) : '—'}
            detail={
              dailyWeights.length >= 2
                ? `${dailyWeights.length} logged days`
                : 'Log at least twice'
            }
          />
        </View>

        <Text style={styles.chartTitle}>Last 7 days</Text>

        {chartWeights.length === 0 ? (
          <Text style={styles.emptyText}>
            Your weight history will appear here after your first weigh-in.
          </Text>
        ) : (
          <WeightLineChart data={chartWeights} />
        )}

        <Text style={styles.smallNote}>
          Each point shows the latest weigh-in for that day. Normal day-to-day
          fluctuations are common, so compare trends over several weeks.
        </Text>
      </View>

      <SectionTitle>Workout consistency</SectionTitle>

      <View style={styles.card}>
        <View style={styles.summaryRow}>
          <View>
            <Text style={styles.cardTitle}>Last 4 weeks</Text>
            <Text style={styles.mutedText}>
              {activeWorkoutDays} days with completed workouts
            </Text>
            <Text style={styles.mutedText}>
              Weekly goal: {workoutDaysTarget} workout days
            </Text>
          </View>
          <Text style={styles.bigNumber}>{workoutCount}</Text>
        </View>

        <View style={styles.workoutChart}>
          {workoutBars.map((day, index) => (
            <View key={`${index}-${day.label}`} style={styles.workoutColumn}>
              <View style={styles.workoutBarTrack}>
                <View
                  style={[
                    styles.workoutBar,
                    day.count > 0 && styles.workoutBarActive,
                    { height: day.count > 0 ? 35 : 5 },
                  ]}
                />
              </View>
              {index % 4 === 0 || index === workoutBars.length - 1 ? (
                <Text style={styles.chartLabel}>{day.label}</Text>
              ) : (
                <Text style={styles.chartLabel}> </Text>
              )}
            </View>
          ))}
        </View>

        {sessions.length === 0 ? (
          <Text style={styles.emptyText}>
            Complete a workout to start building your training history.
          </Text>
        ) : (
          <View style={styles.list}>
            {sessions.slice(0, 5).map((session) => (
              <View key={session.id} style={styles.listRow}>
                <View style={styles.listText}>
                  <Text style={styles.listTitle}>
                    {session.name || 'Workout'}
                  </Text>
                  <Text style={styles.listSubtitle}>
                    {formatTimestamp(session.started_at)}
                  </Text>
                </View>
                <Text style={styles.checkMark}>✓</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <SectionTitle>Strength progression</SectionTitle>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Track your lifts</Text>
        <Text style={styles.mutedText}>
          Your completed sets from finished workouts over the last year.
        </Text>

        {exerciseNames.length === 0 ? (
          <Text style={styles.emptyText}>
            No strength history yet. Record a weighted set, mark it complete,
            and finish the workout. Your exercise history will appear here.
          </Text>
        ) : (
          <>
            <Text style={styles.selectorLabel}>Choose an exercise</Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.exerciseSelector}
            >
              {exerciseNames.map((name) => (
                <Pressable
                  key={name}
                  onPress={() => setSelectedExercise(name)}
                  style={[
                    styles.exerciseChip,
                    activeExercise === name && styles.exerciseChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.exerciseChipText,
                      activeExercise === name && styles.exerciseChipTextActive,
                    ]}
                  >
                    {name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {activeExercise && selectedExerciseStats ? (
              <>
                <Text style={styles.selectedExerciseTitle}>
                  {activeExercise}
                </Text>

                <View style={styles.statGrid}>
                  <StatCard
                    label="Heaviest completed set"
                    value={`${selectedExerciseStats.heaviestWeight.toFixed(1)} kg`}
                    detail={`${selectedExerciseStats.heaviestReps} reps · ${formatTimestamp(selectedExerciseStats.heaviestDate)}`}
                  />
                  <StatCard
                    label="Estimated 1RM"
                    value={`${selectedExerciseStats.bestEstimatedOneRepMax.toFixed(1)} kg`}
                    detail="Best estimated one-rep max"
                  />
                  <StatCard
                    label="Completed sets"
                    value={String(selectedExerciseStats.completedSetCount)}
                    detail={`${selectedExerciseStats.workoutCount} workout days recorded`}
                  />
                </View>

                <Text style={styles.chartTitle}>
                  Estimated strength over time
                </Text>

                {selectedExerciseHistory.length === 1 ? (
                  <Text style={styles.emptyText}>
                    One workout recorded so far. Complete this exercise in
                    another workout to start seeing a trend.
                  </Text>
                ) : null}

                <StrengthLineChart data={selectedExerciseHistory} />

                {selectedExerciseStats.estimatedChange !== null &&
                selectedExerciseHistory.length >= 2 ? (
                  <View style={styles.changeCard}>
                    <Text style={styles.statLabel}>
                      Change from first to latest recorded workout
                    </Text>
                    <Text
                      style={[
                        styles.changeValue,
                        selectedExerciseStats.estimatedChange < 0 &&
                          styles.changeValueNegative,
                      ]}
                    >
                      {signedWeight(selectedExerciseStats.estimatedChange)}
                    </Text>
                    <Text style={styles.smallNote}>
                      This compares estimated 1RM on the first and latest
                      recorded workout days. It is not a direct measurement
                      of muscle growth.
                    </Text>
                  </View>
                ) : null}

                <Text style={styles.chartTitle}>Recent set history</Text>

                {selectedExerciseSets
                  .slice()
                  .reverse()
                  .slice(0, 10)
                  .map((set, index) => (
                    <View
                      key={`${set.session_id}-${set.completed_at}-${index}`}
                      style={styles.listRow}
                    >
                      <View style={styles.listText}>
                        <Text style={styles.listTitle}>
                          {Number(set.weight_kg).toFixed(1)} kg × {set.reps} reps
                        </Text>
                        <Text style={styles.listSubtitle}>
                          {formatTimestamp(set.completed_at!)}
                        </Text>
                      </View>
                      <Text style={styles.recordWeight}>
                        {estimateOneRepMax(
                          Number(set.weight_kg),
                          Number(set.reps),
                        ).toFixed(1)}{' '}
                        kg e1RM
                      </Text>
                    </View>
                  ))}
              </>
            ) : null}
          </>
        )}

        <Text style={styles.smallNote}>
          Estimated 1RM uses the Epley formula: weight × (1 + reps ÷ 30).
          It is an estimate, not a tested maximum. Comparisons are most useful
          when your technique and range of motion stay consistent.
        </Text>
      </View>

      <SectionTitle>Personal records</SectionTitle>

      <View style={styles.card}>
        <Text style={styles.mutedText}>
          Your strongest recorded exercises, ranked by estimated one-rep max.
          History is based on completed sets from finished workouts.
        </Text>

        {strengthRecords.length === 0 ? (
          <Text style={styles.emptyText}>
            Your personal records will appear after you complete and finish a
            workout containing recorded sets.
          </Text>
        ) : (
          <View style={styles.list}>
            {strengthRecords.slice(0, 5).map((record, index) => (
              <View key={record.name} style={styles.listRow}>
                <View style={styles.rankCircle}>
                  <Text style={styles.rankText}>{index + 1}</Text>
                </View>
                <View style={styles.listText}>
                  <Text style={styles.listTitle}>{record.name}</Text>
                  <Text style={styles.listSubtitle}>
                    Heaviest set: {record.weight.toFixed(1)} kg × {record.reps}
                    {' · '}
                    {formatDate(record.date)}
                  </Text>
                </View>
                <Text style={styles.recordWeight}>
                  {record.estimatedOneRepMax.toFixed(1)} kg
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <SectionTitle>Calorie consistency</SectionTitle>

      <View style={styles.card}>
        <View style={styles.summaryRow}>
          <View style={styles.calorieSummary}>
            <Text style={styles.cardTitle}>Last 7 days</Text>
            <Text style={styles.mutedText}>
              Average of days with logged calories
            </Text>
          </View>
          <Text style={styles.bigNumber}>
            {averageCalories > 0
              ? Math.round(averageCalories).toLocaleString('en-AU')
              : '—'}
          </Text>
        </View>

        <Text style={styles.targetText}>
          Reference target: {calorieTarget.toLocaleString('en-AU')} kcal/day
        </Text>

        {calorieDays.map((day) => (
          <View key={day.date} style={styles.calorieRow}>
            <Text style={styles.dayLabel}>{day.label}</Text>

            <View style={styles.calorieTrack}>
              <View
                style={[
                  styles.calorieBar,
                  {
                    width: `${Math.min(
                      100,
                      (day.calories / maxCalories) * 100,
                    )}%`,
                  },
                ]}
              />
              <View
                style={[
                  styles.targetMarker,
                  {
                    left: `${Math.min(
                      100,
                      (calorieTarget / maxCalories) * 100,
                    )}%`,
                  },
                ]}
              />
            </View>

            <Text style={styles.calorieValue}>
              {day.calories > 0
                ? Math.round(day.calories).toLocaleString('en-AU')
                : '—'}
            </Text>
          </View>
        ))}

        <Text style={styles.smallNote}>
          Days without logged food show a dash and are excluded from the
          average. The calorie target is a starter reference, not a
          personalised recommendation.
        </Text>
      </View>

      <Text style={styles.footerText}>
        Pull down to refresh your progress.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 20,
    paddingTop: 65,
    paddingBottom: 40,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: COLORS.muted,
    marginTop: 12,
  },
  title: {
    color: COLORS.text,
    fontSize: 30,
    fontWeight: '700',
  },
  subtitle: {
    color: COLORS.muted,
    fontSize: 15,
    marginTop: 8,
    marginBottom: 28,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    marginTop: 8,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 18,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
  },
  mutedText: {
    color: COLORS.muted,
    fontSize: 13,
    marginTop: 5,
    lineHeight: 19,
  },
  weightInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 16,
    gap: 8,
  },
  weightInput: {
    flex: 0,
    width: 115,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    color: COLORS.text,
    fontSize: 16,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  kgLabel: {
    color: COLORS.muted,
    fontSize: 14,
    marginHorizontal: 0,
  },
  saveButton: {
    flex: 1,
    backgroundColor: COLORS.green,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    minWidth: 0,
    alignItems: 'center',
  },
  saveButtonText: {
    color: COLORS.background,
    fontSize: 15,
    fontWeight: '800',
  },
  disabledButton: {
    opacity: 0.6,
  },
  statGrid: {
    gap: 10,
  },
  statCard: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
  },
  statLabel: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  statValue: {
    color: COLORS.text,
    fontSize: 23,
    fontWeight: '800',
    marginTop: 6,
  },
  statDetail: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 4,
    lineHeight: 17,
  },
  chartTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 24,
    marginBottom: 12,
  },
  lineChartContainer: {
    width: '100%',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  calorieSummary: {
    flex: 1,
  },
  bigNumber: {
    color: COLORS.green,
    fontSize: 27,
    fontWeight: '800',
  },
  workoutChart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    marginBottom: 18,
  },
  workoutColumn: {
    flex: 1,
    alignItems: 'center',
  },
  workoutBarTrack: {
    height: 40,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  workoutBar: {
    width: 6,
    backgroundColor: COLORS.track,
    borderRadius: 4,
  },
  workoutBarActive: {
    backgroundColor: COLORS.green,
  },
  chartLabel: {
    color: COLORS.muted,
    fontSize: 10,
    marginTop: 8,
    textAlign: 'center',
  },
  list: {
    marginTop: 14,
  },
  listRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 13,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 12,
  },
  listText: {
    flex: 1,
  },
  listTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
  listSubtitle: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 4,
    lineHeight: 17,
  },
  checkMark: {
    color: COLORS.green,
    fontSize: 18,
    fontWeight: '800',
  },
  recordWeight: {
    color: COLORS.green,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'right',
  },
  selectorLabel: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 22,
    marginBottom: 10,
  },
  exerciseSelector: {
    gap: 8,
    paddingBottom: 8,
  },
  exerciseChip: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  exerciseChipActive: {
    backgroundColor: COLORS.green,
    borderColor: COLORS.green,
  },
  exerciseChipText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '600',
  },
  exerciseChipTextActive: {
    color: COLORS.background,
    fontWeight: '800',
  },
  selectedExerciseTitle: {
    color: COLORS.text,
    fontSize: 19,
    fontWeight: '800',
    marginTop: 14,
    marginBottom: 14,
  },
  changeCard: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginTop: 16,
  },
  changeValue: {
    color: COLORS.green,
    fontSize: 24,
    fontWeight: '800',
    marginTop: 8,
  },
  changeValueNegative: {
    color: COLORS.red,
  },
  rankCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankText: {
    color: COLORS.green,
    fontSize: 12,
    fontWeight: '800',
  },
  targetText: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 12,
    marginBottom: 18,
  },
  calorieRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 10,
  },
  dayLabel: {
    color: COLORS.muted,
    fontSize: 12,
    width: 14,
  },
  calorieTrack: {
    flex: 1,
    height: 10,
    backgroundColor: COLORS.track,
    borderRadius: 6,
    overflow: 'visible',
    justifyContent: 'center',
  },
  calorieBar: {
    height: 10,
    backgroundColor: COLORS.green,
    borderRadius: 6,
  },
  targetMarker: {
    position: 'absolute',
    top: -3,
    width: 2,
    height: 16,
    backgroundColor: COLORS.text,
  },
  calorieValue: {
    color: COLORS.text,
    fontSize: 11,
    textAlign: 'right',
    width: 43,
  },
  smallNote: {
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 18,
  },
  emptyText: {
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 16,
  },
  errorCard: {
    backgroundColor: '#301B1B',
    borderColor: '#663737',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  errorTitle: {
    color: COLORS.red,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  errorText: {
    color: COLORS.text,
    fontSize: 12,
    lineHeight: 18,
  },
  errorHint: {
    color: '#D8A0A0',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },
  footerText: {
    color: COLORS.muted,
    textAlign: 'center',
    fontSize: 12,
    marginTop: 2,
  },
});
