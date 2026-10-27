
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import { supabase } from '../services/supabase';
import ExercisePickerScreen, {
  type LibraryExercise,
} from './ExercisePickerScreen';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

type WorkoutSession = {
  id: string;
  user_id: string;
  name: string;
  started_at: string;
  finished_at: string | null;
  notes: string | null;
  created_at: string;
  template_id?: string | null;
};

type WorkoutExercise = {
  id: string;
  session_id: string;
  exercise_name: string;
  created_at: string;
};

type WorkoutSet = {
  id: string;
  session_id: string;
  exercise_id: string | null;
  exercise_name: string;
  set_number: number;
  reps: number;
  weight_kg: number;
  rest_seconds: number;
  completed_at: string | null;
  created_at: string;
  draftReps?: string;
  draftWeight?: string;
  draftRest?: string;
};

type PreviousSet = {
  exercise_name: string;
  set_number: number;
  reps: number;
  weight_kg: number;
  rest_seconds: number;
};

type WorkoutTemplate = {
  id: string;
  user_id: string;
  name: string;
  notes: string | null;
  created_at: string;
  updated_at?: string;
};

type TemplateExercise = {
  id: string;
  template_id: string;
  exercise_name: string;
  position: number;
  created_at: string;
};

type TemplateSet = {
  id: string;
  exercise_id: string;
  set_number: number;
  reps: number;
  weight_kg: number;
  rest_seconds: number;
  position: number;
  created_at: string;
  draftReps?: string;
  draftWeight?: string;
  draftRest?: string;
};

type PlannedSetDraft = {
  key: string;
  id?: string;
  reps: string;
  weight: string;
  rest: string;
};

type BuilderExercise = {
  key: string;
  id?: string;
  exercise_name: string;
  sets: PlannedSetDraft[];
};

type TemplateExerciseWithSets = TemplateExercise & {
  sets: TemplateSet[];
};

type Screen =
  | 'home'
  | 'builder'
  | 'routine'
  | 'session'
  | 'exercisePicker';

type DialogButton = {
  text: string;
  style?: 'cancel' | 'destructive' | 'default';
  onPress?: () => void | Promise<void>;
};

type DialogState = {
  title: string;
  message?: string;
  buttons: DialogButton[];
};

const PURPLE = '#7C5CFC';

const makeKey = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const newPlannedSet = (_setNumber: number): PlannedSetDraft => ({
  key: makeKey(),
  reps: '10',
  weight: '0',
  rest: '90',
});

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;

  if (error && typeof error === 'object') {
    const details = Object.entries(error)
      .map(([key, value]) => `${key}: ${String(value ?? '')}`)
      .join('\n');

    return details || 'An unexpected error occurred.';
  }

  return String(error || 'An unexpected error occurred.');
};

export default function WorkoutScreen() {
  const [screen, setScreen] = useState<Screen>('home');

  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);

  const [selectedTemplate, setSelectedTemplate] =
    useState<WorkoutTemplate | null>(null);
  const [templateExercises, setTemplateExercises] =
    useState<TemplateExerciseWithSets[]>([]);

  const [selectedSession, setSelectedSession] =
    useState<WorkoutSession | null>(null);
  const [exercises, setExercises] = useState<WorkoutExercise[]>([]);
  const [sets, setSets] = useState<WorkoutSet[]>([]);


  const [previousPerformance, setPreviousPerformance] =
    useState<PreviousSet[]>([]);

  const [routineName, setRoutineName] = useState('');
  const [routineNotes, setRoutineNotes] = useState('');
  const [editingTemplateId, setEditingTemplateId] =
    useState<string | null>(null);

  const [builderExercises, setBuilderExercises] =
    useState<BuilderExercise[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [dialog, setDialog] = useState<DialogState | null>(null);

  const showDialog = useCallback(
    (title: string, message?: string, buttons?: DialogButton[]) => {
      setDialog({
        title,
        message,
        buttons:
          buttons && buttons.length > 0
            ? buttons
            : [{ text: 'OK', style: 'default' }],
      });
    },
    [],
  );

  const Alert = { alert: showDialog };

  const handleDialogButton = (button: DialogButton) => {
    setDialog(null);

    if (button.onPress) {
      void button.onPress();
    }
  };


  const [restSeconds, setRestSeconds] = useState(0);
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  const [timerRunning, setTimerRunning] = useState(false);
  const [notificationId, setNotificationId] = useState<string | null>(null);
  const [restSetId, setRestSetId] = useState<string | null>(null);

  const isWorkoutActive =
    selectedSession !== null && selectedSession.finished_at === null;

  const loadHomeData = useCallback(async () => {
    setLoading(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user) {
        Alert.alert('Not signed in', 'Please sign in to view your workouts.');
        return;
      }

      const [sessionResult, templateResult] = await Promise.all([
        supabase
          .from('workout_sessions')
          .select('*')
          .eq('user_id', user.id)
          .order('started_at', { ascending: false }),

        supabase
          .from('workout_templates')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
      ]);

      if (sessionResult.error) throw sessionResult.error;
      if (templateResult.error) throw templateResult.error;

      setSessions((sessionResult.data ?? []) as WorkoutSession[]);
      setTemplates((templateResult.data ?? []) as WorkoutTemplate[]);
    } catch (error) {
      Alert.alert('Could not load workouts', getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHomeData();
  }, [loadHomeData]);


  const loadPreviousPerformance = useCallback(
    async (templateId: string | null | undefined, beforeStartedAt?: string) => {
      if (!templateId) {
        setPreviousPerformance([]);
        return;
      }

      try {
        let query = supabase
          .from('workout_sessions')
          .select('id, started_at')
          .eq('template_id', templateId)
          .not('finished_at', 'is', null)
          .order('started_at', { ascending: false })
          .limit(1);

        if (beforeStartedAt) {
          query = query.lt('started_at', beforeStartedAt);
        }

        const { data: previousSession, error: sessionError } =
          await query.maybeSingle();

        if (sessionError) throw sessionError;

        if (!previousSession) {
          setPreviousPerformance([]);
          return;
        }

        const { data: previousSets, error: setsError } = await supabase
          .from('workout_sets')
          .select(
            'exercise_name, set_number, reps, weight_kg, rest_seconds, completed_at',
          )
          .eq('session_id', previousSession.id)
          .not('completed_at', 'is', null)
          .order('set_number', { ascending: true });

        if (setsError) throw setsError;

        setPreviousPerformance((previousSets ?? []) as PreviousSet[]);
      } catch (error) {
        console.error('Could not load previous workout performance:', error);
        setPreviousPerformance([]);
      }
    },
    [],
  );

  const getPreviousSet = (
    exerciseName: string,
    setNumber: number,
  ): PreviousSet | undefined =>
    previousPerformance.find(
      (item) =>
        item.exercise_name.trim().toLowerCase() ===
          exerciseName.trim().toLowerCase() &&
        item.set_number === setNumber,
    );

  const loadWorkoutData = useCallback(async (sessionId: string) => {
    const [exerciseResult, setResult] = await Promise.all([
      supabase
        .from('workout_exercises')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true }),

      supabase
        .from('workout_sets')
        .select('*')
        .eq('session_id', sessionId)
        .order('set_number', { ascending: true }),
    ]);

    if (exerciseResult.error) throw exerciseResult.error;
    if (setResult.error) throw setResult.error;

    setExercises((exerciseResult.data ?? []) as WorkoutExercise[]);
    setSets((setResult.data ?? []) as WorkoutSet[]);
  }, []);

  useEffect(() => {
    if (!selectedSession) {
      setExercises([]);
      setSets([]);
      setPreviousPerformance([]);
      return;
    }

    loadWorkoutData(selectedSession.id).catch((error) => {
      Alert.alert('Could not load workout', getErrorMessage(error));
    });

    loadPreviousPerformance(
      selectedSession.template_id,
      selectedSession.started_at,
    );
  }, [selectedSession, loadWorkoutData, loadPreviousPerformance]);


  const openRoutine = async (template: WorkoutTemplate) => {
    setSaving(true);

    try {
      const { data: exerciseData, error: exerciseError } = await supabase
        .from('workout_template_exercises')
        .select('*')
        .eq('template_id', template.id)
        .order('position', { ascending: true });

      if (exerciseError) throw exerciseError;

      const loadedExercises = (exerciseData ?? []) as TemplateExercise[];

      let loadedSets: TemplateSet[] = [];

      if (loadedExercises.length > 0) {
        const exerciseIds = loadedExercises.map((exercise) => exercise.id);

        const { data: setData, error: setError } = await supabase
          .from('workout_template_sets')
          .select('*')
          .in('exercise_id', exerciseIds)
          .order('position', { ascending: true });

        if (setError) throw setError;

        loadedSets = (setData ?? []) as TemplateSet[];
      }

      setSelectedTemplate(template);

      setTemplateExercises(
        loadedExercises.map((exercise) => ({
          ...exercise,
          sets: loadedSets
            .filter((set) => set.exercise_id === exercise.id)
            .sort((a, b) => a.position - b.position),
        })),
      );

      await loadPreviousPerformance(template.id);
      setScreen('routine');
    } catch (error) {
      Alert.alert('Could not open routine', getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };


  const openBuilder = () => {
    setEditingTemplateId(null);
    setRoutineName('');
    setRoutineNotes('');
    setBuilderExercises([]);
    setScreen('builder');
  };

  const openExercisePicker = () => {
    setScreen('exercisePicker');
  };

  const handleExerciseSelect = (exercise: LibraryExercise) => {
    const name = exercise.name.trim();

    if (
      builderExercises.some(
        (item) =>
          item.exercise_name.toLowerCase() === name.toLowerCase(),
      )
    ) {
      Alert.alert(
        'Exercise already added',
        'This exercise is already in your routine. Add more sets to its card instead.',
      );
      return;
    }

    setBuilderExercises((previous) => [
      ...previous,
      {
        key: makeKey(),
        exercise_name: name,
        sets: [newPlannedSet(1)],
      },
    ]);

    setScreen('builder');
  };

  const openEditBuilder = () => {
    if (!selectedTemplate) return;

    setEditingTemplateId(selectedTemplate.id);
    setRoutineName(selectedTemplate.name);
    setRoutineNotes(selectedTemplate.notes ?? '');

    setBuilderExercises(
      templateExercises.map((exercise) => ({
        key: makeKey(),
        id: exercise.id,
        exercise_name: exercise.exercise_name,
        sets: exercise.sets.map((set) => ({
          key: makeKey(),
          id: set.id,
          reps: String(set.reps),
          weight: String(set.weight_kg),
          rest: String(set.rest_seconds),
        })),
      })),
    );

    setScreen('builder');
  };

  const addPlannedSet = (exerciseKey: string) => {
    setBuilderExercises((current) =>
      current.map((exercise) => {
        if (exercise.key !== exerciseKey) return exercise;

        const previousSet = exercise.sets[exercise.sets.length - 1];

        const newSet: PlannedSetDraft = previousSet
          ? {
              key: makeKey(),
              reps: previousSet.reps,
              weight: previousSet.weight,
              rest: previousSet.rest,
            }
          : newPlannedSet(1);

        return {
          ...exercise,
          sets: [...exercise.sets, newSet],
        };
      }),
    );
  };

  const removePlannedSet = (exerciseKey: string, setKey: string) => {
    setBuilderExercises((previous) =>
      previous.map((exercise) => {
        if (exercise.key !== exerciseKey) return exercise;

        return {
          ...exercise,
          sets: exercise.sets.filter((set) => set.key !== setKey),
        };
      }),
    );
  };

  const updatePlannedSet = (
    exerciseKey: string,
    setKey: string,
    field: keyof Omit<PlannedSetDraft, 'key' | 'id'>,
    value: string,
  ) => {
    setBuilderExercises((previous) =>
      previous.map((exercise) =>
        exercise.key === exerciseKey
          ? {
              ...exercise,
              sets: exercise.sets.map((set) =>
                set.key === setKey ? { ...set, [field]: value } : set,
              ),
            }
          : exercise,
      ),
    );
  };

  const removeBuilderExercise = (exerciseKey: string) => {
    setBuilderExercises((previous) =>
      previous.filter((exercise) => exercise.key !== exerciseKey),
    );
  };

  const updateTemplateSetDraft = (
    exerciseId: string,
    setId: string,
    field: 'draftReps' | 'draftWeight' | 'draftRest',
    value: string,
  ) => {
    setTemplateExercises((previous) =>
      previous.map((exercise) =>
        exercise.id === exerciseId
          ? {
              ...exercise,
              sets: exercise.sets.map((set) =>
                set.id === setId ? { ...set, [field]: value } : set,
              ),
            }
          : exercise,
      ),
    );
  };

  const saveTemplateSetEdits = async (
    set: TemplateSet,
  ): Promise<TemplateSet> => {
    const repsText = set.draftReps ?? String(set.reps);
    const weightText = set.draftWeight ?? String(set.weight_kg);
    const restText = set.draftRest ?? String(set.rest_seconds);

    const reps = Number(repsText);
    const weight = Number(weightText);
    const rest = Number(restText);

    if (!repsText.trim() || !Number.isInteger(reps) || reps <= 0) {
      throw new Error('Reps must be a positive whole number.');
    }

    if (!weightText.trim() || !Number.isFinite(weight) || weight < 0) {
      throw new Error('Weight must be a valid number of 0 or greater.');
    }

    if (
      !restText.trim() ||
      !Number.isInteger(rest) ||
      rest < 0 ||
      rest > 86400
    ) {
      throw new Error(
        'Rest must be a whole number between 0 and 86400 seconds.',
      );
    }

    const { data, error } = await supabase
      .from('workout_template_sets')
      .update({
        reps,
        weight_kg: weight,
        rest_seconds: rest,
      })
      .eq('id', set.id)
      .eq('exercise_id', set.exercise_id)
      .select()
      .single();

    if (error) throw error;

    const savedSet = data as TemplateSet;

    setTemplateExercises((previous) =>
      previous.map((exercise) =>
        exercise.id === savedSet.exercise_id
          ? {
              ...exercise,
              sets: exercise.sets.map((item) =>
                item.id === savedSet.id
                  ? {
                      ...savedSet,
                      draftReps: undefined,
                      draftWeight: undefined,
                      draftRest: undefined,
                    }
                  : item,
              ),
            }
          : exercise,
      ),
    );

    return savedSet;
  };


  const saveRoutine = async () => {
    if (saving) return;

    const name = routineName.trim();

    if (!name) {
      Alert.alert('Routine name required', 'Give your routine a name.');
      return;
    }

    if (builderExercises.length === 0) {
      Alert.alert(
        'Add an exercise',
        'Add at least one exercise before saving your routine.',
      );
      return;
    }

    for (const exercise of builderExercises) {
      if (exercise.sets.length === 0) {
        Alert.alert(
          'Exercise has no sets',
          `Add at least one set for ${exercise.exercise_name}.`,
        );
        return;
      }

      for (const set of exercise.sets) {
        const reps = Number(set.reps);
        const weight = Number(set.weight);
        const rest = Number(set.rest);

        if (!set.reps.trim() || !Number.isInteger(reps) || reps <= 0) {
          Alert.alert(
            'Invalid reps',
            `Enter a positive whole number of reps for ${exercise.exercise_name}.`,
          );
          return;
        }

        if (!set.weight.trim() || !Number.isFinite(weight) || weight < 0) {
          Alert.alert(
            'Invalid weight',
            `Enter a valid weight for ${exercise.exercise_name}.`,
          );
          return;
        }

        if (
          !set.rest.trim() ||
          !Number.isInteger(rest) ||
          rest < 0 ||
          rest > 86400
        ) {
          Alert.alert(
            'Invalid rest time',
            `Enter a whole number of seconds between 0 and 86400 for ${exercise.exercise_name}.`,
          );
          return;
        }
      }
    }

    setSaving(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error('Please sign in again.');

      if (editingTemplateId) {
        const { data: updatedData, error: updateError } = await supabase
          .from('workout_templates')
          .update({
            name,
            notes: routineNotes.trim() || null,
          })
          .eq('id', editingTemplateId)
          .eq('user_id', user.id)
          .select()
          .single();

        if (updateError) throw updateError;

        const updatedTemplate = updatedData as WorkoutTemplate;

        const retainedExerciseIds = new Set(
          builderExercises
            .map((exercise) => exercise.id)
            .filter((id): id is string => Boolean(id)),
        );

        for (const oldExercise of templateExercises) {
          if (!retainedExerciseIds.has(oldExercise.id)) {
            const { error: deleteSetsError } = await supabase
              .from('workout_template_sets')
              .delete()
              .eq('exercise_id', oldExercise.id);

            if (deleteSetsError) throw deleteSetsError;

            const { error: deleteExerciseError } = await supabase
              .from('workout_template_exercises')
              .delete()
              .eq('id', oldExercise.id)
              .eq('template_id', editingTemplateId);

            if (deleteExerciseError) throw deleteExerciseError;
          }
        }

        for (
          let exerciseIndex = 0;
          exerciseIndex < builderExercises.length;
          exerciseIndex += 1
        ) {
          const exercise = builderExercises[exerciseIndex];
          let savedExerciseId: string;

          if (exercise.id) {
            const { error: exerciseUpdateError } = await supabase
              .from('workout_template_exercises')
              .update({
                exercise_name: exercise.exercise_name.trim(),
                position: exerciseIndex,
              })
              .eq('id', exercise.id)
              .eq('template_id', editingTemplateId);

            if (exerciseUpdateError) throw exerciseUpdateError;

            savedExerciseId = exercise.id;
          } else {
            const { data: newExercise, error: newExerciseError } =
              await supabase
                .from('workout_template_exercises')
                .insert({
                  template_id: editingTemplateId,
                  exercise_name: exercise.exercise_name.trim(),
                  position: exerciseIndex,
                })
                .select()
                .single();

            if (newExerciseError) throw newExerciseError;

            savedExerciseId = (newExercise as TemplateExercise).id;
          }

          const originalExercise = templateExercises.find(
            (item) => item.id === exercise.id,
          );

          const retainedSetIds = new Set(
            exercise.sets
              .map((set) => set.id)
              .filter((id): id is string => Boolean(id)),
          );

          for (const oldSet of originalExercise?.sets ?? []) {
            if (!retainedSetIds.has(oldSet.id)) {
              const { error: deleteSetError } = await supabase
                .from('workout_template_sets')
                .delete()
                .eq('id', oldSet.id)
                .eq('exercise_id', savedExerciseId);

              if (deleteSetError) throw deleteSetError;
            }
          }

          for (
            let setIndex = 0;
            setIndex < exercise.sets.length;
            setIndex += 1
          ) {
            const set = exercise.sets[setIndex];

            const setValues = {
              exercise_id: savedExerciseId,
              set_number: setIndex + 1,
              reps: Number(set.reps),
              weight_kg: Number(set.weight),
              rest_seconds: Number(set.rest),
              position: setIndex,
            };

            if (set.id) {
              const { error: setUpdateError } = await supabase
                .from('workout_template_sets')
                .update(setValues)
                .eq('id', set.id)
                .eq('exercise_id', savedExerciseId);

              if (setUpdateError) throw setUpdateError;
            } else {
              const { error: setInsertError } = await supabase
                .from('workout_template_sets')
                .insert(setValues);

              if (setInsertError) throw setInsertError;
            }
          }
        }

        setTemplates((previous) =>
          previous.map((item) =>
            item.id === updatedTemplate.id ? updatedTemplate : item,
          ),
        );

        setSelectedTemplate(updatedTemplate);

        Alert.alert(
          'Routine updated',
          `"${updatedTemplate.name}" has been updated.`,
        );

        await openRoutine(updatedTemplate);
        return;
      }

      const { data: templateData, error: templateError } = await supabase
        .from('workout_templates')
        .insert({
          user_id: user.id,
          name,
          notes: routineNotes.trim() || null,
        })
        .select()
        .single();

      if (templateError) throw templateError;

      const template = templateData as WorkoutTemplate;

      for (let index = 0; index < builderExercises.length; index += 1) {
        const exercise = builderExercises[index];

        const { data: exerciseData, error: exerciseError } = await supabase
          .from('workout_template_exercises')
          .insert({
            template_id: template.id,
            exercise_name: exercise.exercise_name.trim(),
            position: index,
          })
          .select()
          .single();

        if (exerciseError) throw exerciseError;

        const savedExercise = exerciseData as TemplateExercise;

        const plannedSets = exercise.sets.map((set, setIndex) => ({
          exercise_id: savedExercise.id,
          set_number: setIndex + 1,
          reps: Number(set.reps),
          weight_kg: Number(set.weight),
          rest_seconds: Number(set.rest),
          position: setIndex,
        }));

        const { error: setsError } = await supabase
          .from('workout_template_sets')
          .insert(plannedSets);

        if (setsError) throw setsError;
      }

      setTemplates((previous) => [template, ...previous]);
      setSelectedTemplate(template);

      Alert.alert('Routine saved', `"${template.name}" is ready to use.`);
      await openRoutine(template);
    } catch (error: unknown) {
      console.error('Failed to save routine:', error);

      Alert.alert(
        editingTemplateId ? 'Routine Update Error' : 'Routine Save Error',
        getErrorMessage(error),
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteRoutine = (template: WorkoutTemplate) => {
    Alert.alert(
      'Delete routine?',
      `Delete "${template.name}"? Your previously completed workouts will be kept.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);

            try {
              const { error } = await supabase
                .from('workout_templates')
                .delete()
                .eq('id', template.id);

              if (error) throw error;

              setTemplates((previous) =>
                previous.filter((item) => item.id !== template.id),
              );

              if (selectedTemplate?.id === template.id) {
                setSelectedTemplate(null);
                setTemplateExercises([]);
                setPreviousPerformance([]);
                setScreen('home');
              }
            } catch (error) {
              Alert.alert('Could not delete routine', getErrorMessage(error));
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  };


  const cancelRestNotification = async () => {
    if (Platform.OS === 'web') {
      setNotificationId(null);
      return;
    }

    if (!notificationId) return;

    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
    } catch {
    }

    setNotificationId(null);
  };

  const startRestTimer = async (seconds: number, setId: string) => {
    await cancelRestNotification();

    const safeSeconds = Math.max(0, Math.floor(seconds));

    setRestSeconds(safeSeconds);

    if (safeSeconds <= 0) {
      setTimerRunning(false);
      setRestEndsAt(null);
      setRestSetId(null);
      return;
    }

    const endTime = Date.now() + safeSeconds * 1000;

    setRestSetId(setId);
    setRestEndsAt(endTime);
    setTimerRunning(true);

    if (Platform.OS === 'web') return;

    try {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('rest-timer', {
          name: 'Workout rest timer',
          importance: Notifications.AndroidImportance.MAX,
          sound: 'default',
          vibrationPattern: [0, 250, 250, 250],
        });
      }

      const permission = await Notifications.getPermissionsAsync();

      if (permission.granted) {
        const id = await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Rest finished',
            body: 'Time for your next set!',
            sound: 'default',
            ...(Platform.OS === 'android' ? { channelId: 'rest-timer' } : {}),
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: safeSeconds,
          },
        });

        setNotificationId(id);
      }
    } catch (error) {
      console.warn('Could not schedule rest notification:', error);
    }
  };

  const stopRestTimer = async () => {
    await cancelRestNotification();
    setTimerRunning(false);
    setRestEndsAt(null);
    setRestSeconds(0);
    setRestSetId(null);
  };

  useEffect(() => {
    if (!timerRunning || restEndsAt === null) return;

    const updateTimer = () => {
      const remaining = Math.max(
        0,
        Math.ceil((restEndsAt - Date.now()) / 1000),
      );

      setRestSeconds(remaining);

      if (remaining <= 0) {
        setTimerRunning(false);
        setRestEndsAt(null);
        setRestSetId(null);
        setNotificationId(null);
      }
    };

    updateTimer();

    const interval = setInterval(updateTimer, 500);

    return () => clearInterval(interval);
  }, [timerRunning, restEndsAt]);

  const startRoutineWorkout = async () => {
    if (!selectedTemplate || saving) return;

    if (templateExercises.length === 0) {
      Alert.alert(
        'Routine is empty',
        'Add exercises to this routine before starting it.',
      );
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error('Please sign in again.');

      const { data: sessionData, error: sessionError } = await supabase
        .from('workout_sessions')
        .insert({
          user_id: user.id,
          name: selectedTemplate.name,
          notes: selectedTemplate.notes,
          template_id: selectedTemplate.id,
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (sessionError) throw sessionError;

      const session = sessionData as WorkoutSession;
      const newSessionExercises: WorkoutExercise[] = [];
      const newSessionSets: WorkoutSet[] = [];

      for (const templateExercise of templateExercises) {
        const { data: exerciseData, error: exerciseError } = await supabase
          .from('workout_exercises')
          .insert({
            session_id: session.id,
            exercise_name: templateExercise.exercise_name,
          })
          .select()
          .single();

        if (exerciseError) throw exerciseError;

        const exercise = exerciseData as WorkoutExercise;
        newSessionExercises.push(exercise);

        if (templateExercise.sets.length > 0) {
          const rows = templateExercise.sets.map((set, index) => {
            const previous = getPreviousSet(
              templateExercise.exercise_name,
              index + 1,
            );

            return {
              session_id: session.id,
              exercise_id: exercise.id,
              exercise_name: exercise.exercise_name,
              set_number: index + 1,
              reps: previous?.reps ?? Number(set.draftReps ?? set.reps),
              weight_kg:
                previous?.weight_kg ??
                Number(set.draftWeight ?? set.weight_kg),
              rest_seconds:
                previous?.rest_seconds ??
                Number(set.draftRest ?? set.rest_seconds),
              completed_at: null,
            };
          });

          const { data: insertedSets, error: setsError } = await supabase
            .from('workout_sets')
            .insert(rows)
            .select();

          if (setsError) throw setsError;

          newSessionSets.push(...((insertedSets ?? []) as WorkoutSet[]));
        }
      }

      setSessions((previous) => [session, ...previous]);
      setSelectedSession(session);
      setExercises(newSessionExercises);
      setSets(newSessionSets);
      setRestSeconds(0);
      setTimerRunning(false);
      setRestEndsAt(null);
      setRestSetId(null);
      setScreen('session');
    } catch (error) {
      Alert.alert(
        'Could not start workout',
        `${getErrorMessage(error)}\n\nIf the error occurred during setup, check your workout history in Supabase before trying again.`,
      );
    } finally {
      setSaving(false);
    }
  };

  const updateWorkoutSetDraft = (
    setId: string,
    field: 'draftReps' | 'draftWeight' | 'draftRest',
    value: string,
  ) => {
    setSets((previous) =>
      previous.map((set) =>
        set.id === setId ? { ...set, [field]: value } : set,
      ),
    );
  };

  const saveWorkoutSetEdits = async (
    set: WorkoutSet,
  ): Promise<WorkoutSet> => {
    if (!selectedSession) {
      throw new Error('No workout session is selected.');
    }

    const repsText = set.draftReps ?? String(set.reps);
    const weightText = set.draftWeight ?? String(set.weight_kg);
    const restText = set.draftRest ?? String(set.rest_seconds);

    const reps = Number(repsText);
    const weight = Number(weightText);
    const rest = Number(restText);

    if (!repsText.trim() || !Number.isInteger(reps) || reps <= 0) {
      throw new Error('Reps must be a positive whole number.');
    }

    if (!weightText.trim() || !Number.isFinite(weight) || weight < 0) {
      throw new Error('Weight must be a valid number of 0 or greater.');
    }

    if (
      !restText.trim() ||
      !Number.isInteger(rest) ||
      rest < 0 ||
      rest > 86400
    ) {
      throw new Error(
        'Rest must be a whole number between 0 and 86400 seconds.',
      );
    }

    const { data, error } = await supabase
      .from('workout_sets')
      .update({
        reps,
        weight_kg: weight,
        rest_seconds: rest,
      })
      .eq('id', set.id)
      .eq('session_id', selectedSession.id)
      .select()
      .single();

    if (error) throw error;

    const savedSet = data as WorkoutSet;

    setSets((previous) =>
      previous.map((item) =>
        item.id === savedSet.id
          ? {
              ...savedSet,
              draftReps: undefined,
              draftWeight: undefined,
              draftRest: undefined,
            }
          : item,
      ),
    );

    return savedSet;
  };

  const completeSet = async (set: WorkoutSet) => {
    if (!selectedSession || !isWorkoutActive || saving) return;
    if (set.completed_at) return;

    setSaving(true);

    try {
      const editedSet = await saveWorkoutSetEdits(set);
      const completedAt = new Date().toISOString();

      const { data, error } = await supabase
        .from('workout_sets')
        .update({ completed_at: completedAt })
        .eq('id', editedSet.id)
        .eq('session_id', selectedSession.id)
        .select()
        .single();

      if (error) throw error;

      const completedSet = data as WorkoutSet;

      setSets((previous) =>
        previous.map((item) =>
          item.id === completedSet.id ? completedSet : item,
        ),
      );

      await startRestTimer(
        Number(editedSet.rest_seconds ?? 90),
        editedSet.id,
      );
    } catch (error) {
      Alert.alert('Could not complete set', getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const finishWorkout = () => {
    if (!selectedSession || !isWorkoutActive || saving) return;

    Alert.alert(
      'Finish workout?',
      'Your session will be marked as completed.',
      [
        { text: 'Keep training', style: 'cancel' },
        {
          text: 'Finish workout',
          onPress: async () => {
            setSaving(true);

            try {
              const { data, error } = await supabase
                .from('workout_sessions')
                .update({ finished_at: new Date().toISOString() })
                .eq('id', selectedSession.id)
                .is('finished_at', null)
                .select()
                .single();

              if (error) throw error;

              const finished = data as WorkoutSession;

              setSelectedSession(finished);

              setSessions((previous) =>
                previous.map((session) =>
                  session.id === finished.id ? finished : session,
                ),
              );

              setTimerRunning(false);
              setRestEndsAt(null);
              setRestSeconds(0);
              setRestSetId(null);
              await cancelRestNotification();

              Alert.alert(
                'Workout completed',
                'Your workout has been saved to your history.',
              );
            } catch (error) {
              Alert.alert('Could not finish workout', getErrorMessage(error));
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  };

  const deleteWorkout = (session: WorkoutSession) => {
    if (saving) return;

    Alert.alert(
      'Delete workout?',
      `Delete "${session.name}" and all its exercises and sets? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);

            try {
              const { error } = await supabase
                .from('workout_sessions')
                .delete()
                .eq('id', session.id)
                .select('id')
                .single();

              if (error) throw error;

              setSessions((previous) =>
                previous.filter((item) => item.id !== session.id),
              );

              if (selectedSession?.id === session.id) {
                setSelectedSession(null);
                setExercises([]);
                setSets([]);
                setPreviousPerformance([]);
                setScreen('home');
                setTimerRunning(false);
                setRestEndsAt(null);
                setRestSeconds(0);
                setRestSetId(null);
                await cancelRestNotification();
              }

              Alert.alert('Workout deleted', 'The workout has been removed.');
            } catch (error) {
              Alert.alert('Could not delete workout', getErrorMessage(error));
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  };

  const formatDate = (value: string) =>
    new Date(value).toLocaleString([], {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const formatTimer = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    return `${String(minutes).padStart(2, '0')}:${String(
      remainingSeconds,
    ).padStart(2, '0')}`;
  };

  const backHome = () => {
    setSelectedSession(null);
    setSelectedTemplate(null);
    setTemplateExercises([]);
    setPreviousPerformance([]);
    setEditingTemplateId(null);
    setScreen('home');
  };

  const countRoutineSets = (routineExercises: TemplateExerciseWithSets[]) =>
    routineExercises.reduce(
      (total, exercise) => total + exercise.sets.length,
      0,
    );

  const completedSetCount = sets.filter((set) => set.completed_at).length;

  const sessionExerciseSets = (exercise: WorkoutExercise) =>
    sets
      .filter(
        (set) =>
          set.exercise_id === exercise.id ||
          (!set.exercise_id &&
            set.exercise_name.toLowerCase() ===
              exercise.exercise_name.toLowerCase()),
      )
      .sort((a, b) => a.set_number - b.set_number);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={PURPLE} />
        <Text style={styles.mutedText}>Loading workouts...</Text>
      </View>
    );
  }

  if (screen === 'exercisePicker') {
    return (
      <ExercisePickerScreen
        onBack={() => setScreen('builder')}
        onSelect={handleExerciseSelect}
        selectedNames={builderExercises.map(
          (exercise) => exercise.exercise_name,
        )}
      />
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* HOME */}
        {screen === 'home' && (
          <>
            <Text style={styles.title}>Workouts</Text>
            <Text style={styles.subtitle}>Your routines. Your progress.</Text>

            <Pressable style={styles.primaryButton} onPress={openBuilder}>
              <Text style={styles.primaryButtonText}>＋ Add Workout</Text>
            </Pressable>

            <View style={styles.sectionHeadingRow}>
              <Text style={styles.sectionTitle}>Saved Workouts</Text>
              <Text style={styles.countText}>{templates.length}</Text>
            </View>

            {templates.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No saved routines yet</Text>
                <Text style={styles.mutedText}>
                  Create a routine with your exercises, reps, weights and rest
                  times. You can reuse it every time you train.
                </Text>
              </View>
            ) : (
              templates.map((template) => (
                <Pressable
                  key={template.id}
                  style={styles.routineCard}
                  onPress={() => openRoutine(template)}
                >
                  <View style={styles.routineIcon}>
                    <Text style={styles.routineIconText}>↗</Text>
                  </View>

                  <View style={styles.routineMain}>
                    <Text style={styles.historyTitle}>{template.name}</Text>
                    <Text style={styles.mutedText}>
                      {template.notes || 'Saved workout routine'}
                    </Text>
                  </View>

                  <Text style={styles.chevron}>›</Text>
                </Pressable>
              ))
            )}

            <View style={[styles.sectionHeadingRow, styles.historyHeading]}>
              <Text style={styles.sectionTitle}>Previous Workouts</Text>
              <Text style={styles.countText}>{sessions.length}</Text>
            </View>

            {sessions.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No workout history yet</Text>
                <Text style={styles.mutedText}>
                  Start a saved routine to record your first workout.
                </Text>
              </View>
            ) : (
              sessions.map((session) => (
                <View key={session.id} style={styles.historyCard}>
                  <Pressable
                    style={styles.historyMain}
                    onPress={() => {
                      setSelectedSession(session);
                      setScreen('session');
                    }}
                  >
                    <Text style={styles.historyTitle}>{session.name}</Text>
                    <Text style={styles.mutedText}>
                      {formatDate(session.started_at)}
                    </Text>
                    <Text
                      style={[
                        styles.statusText,
                        session.finished_at
                          ? styles.completedText
                          : styles.activeText,
                      ]}
                    >
                      {session.finished_at ? 'Completed' : 'In progress'}
                    </Text>
                  </Pressable>

                  <Pressable
                    style={styles.deleteButton}
                    onPress={() => deleteWorkout(session)}
                    disabled={saving}
                  >
                    <Text style={styles.deleteButtonText}>Delete</Text>
                  </Pressable>
                </View>
              ))
            )}
          </>
        )}

        {/* CREATE OR EDIT ROUTINE BUILDER */}
        {screen === 'builder' && (
          <>
            <Pressable
              style={styles.backButton}
              onPress={() => {
                if (editingTemplateId) {
                  setScreen('routine');
                } else {
                  backHome();
                }
              }}
            >
              <Text style={styles.backButtonText}>‹ Workouts</Text>
            </Pressable>

            <Text style={styles.title}>
              {editingTemplateId ? 'Edit Routine' : 'Create Routine'}
            </Text>
            <Text style={styles.subtitle}>
              Plan your exercises and sets before you start.
            </Text>

            <View style={styles.card}>
              <Text style={styles.label}>Routine name</Text>
              <TextInput
                style={styles.input}
                value={routineName}
                onChangeText={setRoutineName}
                placeholder="e.g. Push Day"
                placeholderTextColor="#777777"
                maxLength={100}
              />

              <Text style={styles.label}>Notes (optional)</Text>
              <TextInput
                style={[styles.input, styles.notesInput]}
                value={routineNotes}
                onChangeText={setRoutineNotes}
                placeholder="e.g. Focus on progressive overload"
                placeholderTextColor="#777777"
                multiline
              />
            </View>

            <Text style={styles.sectionTitle}>Exercises</Text>

            {builderExercises.map((exercise, exerciseIndex) => (
              <View key={exercise.key} style={styles.exerciseCard}>
                <View style={styles.exerciseHeader}>
                  <View style={styles.exerciseHeading}>
                    <Text style={styles.exerciseTitle}>
                      {exerciseIndex + 1}. {exercise.exercise_name}
                    </Text>
                    <Text style={styles.mutedText}>
                      {exercise.sets.length}{' '}
                      {exercise.sets.length === 1 ? 'set' : 'sets'}
                    </Text>
                  </View>

                  <Pressable
                    onPress={() => removeBuilderExercise(exercise.key)}
                    style={styles.smallTextButton}
                  >
                    <Text style={styles.deleteButtonText}>Remove</Text>
                  </Pressable>
                </View>

                {exercise.sets.map((set, setIndex) => (
                  <View key={set.key} style={styles.plannedSetCard}>
                    <View style={styles.plannedSetHeading}>
                      <Text style={styles.plannedSetTitle}>
                        Set {setIndex + 1}
                      </Text>

                      <Pressable
                        onPress={() =>
                          removePlannedSet(exercise.key, set.key)
                        }
                      >
                        <Text style={styles.removeSetText}>×</Text>
                      </Pressable>
                    </View>

                    <View style={styles.inputRow}>
                      <View style={styles.inputColumn}>
                        <Text style={styles.label}>Reps</Text>
                        <TextInput
                          style={styles.input}
                          value={set.reps}
                          onChangeText={(value) =>
                            updatePlannedSet(
                              exercise.key,
                              set.key,
                              'reps',
                              value,
                            )
                          }
                          keyboardType="number-pad"
                          placeholder="10"
                          placeholderTextColor="#777777"
                        />
                      </View>

                      <View style={styles.inputColumn}>
                        <Text style={styles.label}>Weight (kg)</Text>
                        <TextInput
                          style={styles.input}
                          value={set.weight}
                          onChangeText={(value) =>
                            updatePlannedSet(
                              exercise.key,
                              set.key,
                              'weight',
                              value,
                            )
                          }
                          keyboardType="decimal-pad"
                          placeholder="0"
                          placeholderTextColor="#777777"
                        />
                      </View>

                      <View style={styles.inputColumn}>
                        <Text style={styles.label}>Rest (sec)</Text>
                        <TextInput
                          style={styles.input}
                          value={set.rest}
                          onChangeText={(value) =>
                            updatePlannedSet(
                              exercise.key,
                              set.key,
                              'rest',
                              value,
                            )
                          }
                          keyboardType="number-pad"
                          placeholder="90"
                          placeholderTextColor="#777777"
                        />
                      </View>
                    </View>
                  </View>
                ))}

                <Pressable
                  style={styles.secondaryButton}
                  onPress={() => addPlannedSet(exercise.key)}
                >
                  <Text style={styles.secondaryButtonText}>＋ Add Set</Text>
                </Pressable>
              </View>
            ))}

            <Pressable
              style={styles.exerciseSearchCard}
              onPress={openExercisePicker}
            >
              <View style={styles.exerciseSearchIcon}>
                <Text style={styles.exerciseSearchIconText}>⌕</Text>
              </View>

              <View style={styles.exerciseSearchContent}>
                <Text style={styles.exerciseSearchTitle}>Add an exercise</Text>
                <Text style={styles.mutedText}>
                  Search muscles, equipment and exercises
                </Text>
              </View>

              <Text style={styles.exerciseSearchArrow}>›</Text>
            </Pressable>

            <Pressable
              style={[styles.primaryButton, saving && styles.disabledButton]}
              onPress={saveRoutine}
              disabled={saving}
            >
              <Text style={styles.primaryButtonText}>
                {saving
                  ? 'Saving Routine...'
                  : editingTemplateId
                    ? 'Save Changes'
                    : 'Save Routine'}
              </Text>
            </Pressable>

            <Pressable
              style={styles.cancelButton}
              onPress={() => {
                if (editingTemplateId) {
                  setScreen('routine');
                } else {
                  backHome();
                }
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
          </>
        )}

        {/* SAVED ROUTINE DETAILS */}
        {screen === 'routine' && selectedTemplate && (
          <>
            <Pressable style={styles.backButton} onPress={backHome}>
              <Text style={styles.backButtonText}>‹ Workouts</Text>
            </Pressable>

            <Text style={styles.title}>{selectedTemplate.name}</Text>
            <Text style={styles.subtitle}>Saved routine</Text>

            {selectedTemplate.notes ? (
              <Text style={styles.noteText}>{selectedTemplate.notes}</Text>
            ) : null}

            <View style={styles.summaryRow}>
              <View style={styles.summaryBox}>
                <Text style={styles.summaryNumber}>
                  {templateExercises.length}
                </Text>
                <Text style={styles.mutedText}>Exercises</Text>
              </View>

              <View style={styles.summaryBox}>
                <Text style={styles.summaryNumber}>
                  {countRoutineSets(templateExercises)}
                </Text>
                <Text style={styles.mutedText}>Planned sets</Text>
              </View>
            </View>

            <Pressable
              style={styles.secondaryButton}
              onPress={openEditBuilder}
              disabled={saving}
            >
              <Text style={styles.secondaryButtonText}>✎ Edit Routine</Text>
            </Pressable>

            <Pressable
              style={[styles.primaryButton, saving && styles.disabledButton]}
              onPress={startRoutineWorkout}
              disabled={saving}
            >
              <Text style={styles.primaryButtonText}>
                {saving ? 'Preparing Workout...' : '▶  Start Workout'}
              </Text>
            </Pressable>

            <Text style={[styles.sectionTitle, styles.detailHeading]}>
              Planned Exercises
            </Text>
            <Text style={[styles.mutedText, { marginBottom: 12 }]}>
              These are your saved routine values. Starting a workout will
              automatically prefill matching sets with your latest completed
              results.
            </Text>

            {templateExercises.map((exercise, index) => (
              <View key={exercise.id} style={styles.exerciseCard}>
                <Text style={styles.exerciseTitle}>
                  {index + 1}. {exercise.exercise_name}
                </Text>

                {exercise.sets.map((set) => (
                  <View key={set.id} style={styles.routineEditableSet}>
                    <Text style={styles.plannedSetTitle}>
                      Set {set.set_number}
                    </Text>

                    <View style={styles.inputRow}>
                      <View style={styles.inputColumn}>
                        <Text style={styles.label}>Reps</Text>
                        <TextInput
                          style={styles.sessionInput}
                          value={set.draftReps ?? String(set.reps)}
                          onChangeText={(value) =>
                            updateTemplateSetDraft(
                              exercise.id,
                              set.id,
                              'draftReps',
                              value,
                            )
                          }
                          onEndEditing={() => {
                            void saveTemplateSetEdits(set).catch((error) =>
                              Alert.alert(
                                'Could not save set',
                                getErrorMessage(error),
                              ),
                            );
                          }}
                          keyboardType="number-pad"
                          editable={!saving}
                          selectTextOnFocus
                        />
                      </View>

                      <View style={styles.inputColumn}>
                        <Text style={styles.label}>Weight (kg)</Text>
                        <TextInput
                          style={styles.sessionInput}
                          value={set.draftWeight ?? String(set.weight_kg)}
                          onChangeText={(value) =>
                            updateTemplateSetDraft(
                              exercise.id,
                              set.id,
                              'draftWeight',
                              value,
                            )
                          }
                          onEndEditing={() => {
                            void saveTemplateSetEdits(set).catch((error) =>
                              Alert.alert(
                                'Could not save set',
                                getErrorMessage(error),
                              ),
                            );
                          }}
                          keyboardType="decimal-pad"
                          editable={!saving}
                          selectTextOnFocus
                        />
                      </View>

                      <View style={styles.inputColumn}>
                        <Text style={styles.label}>Rest (sec)</Text>
                        <TextInput
                          style={styles.sessionInput}
                          value={set.draftRest ?? String(set.rest_seconds)}
                          onChangeText={(value) =>
                            updateTemplateSetDraft(
                              exercise.id,
                              set.id,
                              'draftRest',
                              value,
                            )
                          }
                          onEndEditing={() => {
                            void saveTemplateSetEdits(set).catch((error) =>
                              Alert.alert(
                                'Could not save set',
                                getErrorMessage(error),
                              ),
                            );
                          }}
                          keyboardType="number-pad"
                          editable={!saving}
                          selectTextOnFocus
                        />
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            ))}

            <Pressable
              style={styles.cancelButton}
              onPress={() => deleteRoutine(selectedTemplate)}
              disabled={saving}
            >
              <Text style={styles.deleteButtonText}>Delete Routine</Text>
            </Pressable>
          </>
        )}

        {/* ACTIVE OR COMPLETED WORKOUT */}
        {screen === 'session' && selectedSession && (
          <>
            <Pressable style={styles.backButton} onPress={backHome}>
              <Text style={styles.backButtonText}>‹ Workouts</Text>
            </Pressable>

            <Text style={styles.title}>{selectedSession.name}</Text>
            <Text style={styles.subtitle}>
              {isWorkoutActive ? 'Workout in progress' : 'Workout summary'}
            </Text>

            <View style={styles.summaryRow}>
              <View style={styles.summaryBox}>
                <Text style={styles.summaryNumber}>{exercises.length}</Text>
                <Text style={styles.mutedText}>Exercises</Text>
              </View>

              <View style={styles.summaryBox}>
                <Text style={styles.summaryNumber}>
                  {completedSetCount}/{sets.length}
                </Text>
                <Text style={styles.mutedText}>Sets completed</Text>
              </View>
            </View>

            {!isWorkoutActive && (
              <View style={styles.completedBanner}>
                <Text style={styles.completedBannerText}>
                  Workout completed
                </Text>
              </View>
            )}

            <Text style={[styles.sectionTitle, styles.detailHeading]}>
              Exercises
            </Text>
            <Text style={[styles.mutedText, { marginBottom: 12 }]}>
              Reps, weight and rest are editable for this session only.
              Changes here will not alter your saved routine or other workouts.
            </Text>

            {exercises.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No exercises</Text>
                <Text style={styles.mutedText}>
                  This workout has no recorded exercises.
                </Text>
              </View>
            ) : (
              exercises.map((exercise, index) => {
                const exerciseSets = sessionExerciseSets(exercise);

                return (
                  <View key={exercise.id} style={styles.exerciseCard}>
                    <Text style={styles.exerciseTitle}>
                      {index + 1}. {exercise.exercise_name}
                    </Text>

                    {exerciseSets.length === 0 ? (
                      <Text style={styles.mutedText}>No sets recorded.</Text>
                    ) : (
                      exerciseSets.map((set) => (
                        <View key={set.id} style={styles.activeSetRow}>
                          <View style={styles.activeSetDetails}>
                            <View style={styles.setHeadingRow}>
                              <Text style={styles.activeSetTitle}>
                                Set {set.set_number}
                              </Text>

                              {set.completed_at ? (
                                <View style={styles.doneBadge}>
                                  <Text style={styles.doneBadgeText}>
                                    ✓ Done
                                  </Text>
                                </View>
                              ) : !isWorkoutActive ? (
                                <Text style={styles.notDoneText}>
                                  Not completed
                                </Text>
                              ) : null}
                            </View>

                            <View style={styles.sessionSetInputs}>
                              <View style={styles.sessionInputColumn}>
                                <Text style={styles.label}>Reps</Text>
                                <TextInput
                                  style={styles.sessionInput}
                                  value={set.draftReps ?? String(set.reps)}
                                  onChangeText={(value) =>
                                    updateWorkoutSetDraft(
                                      set.id,
                                      'draftReps',
                                      value,
                                    )
                                  }
                                  onEndEditing={() => {
                                    void saveWorkoutSetEdits(set).catch(
                                      (error) =>
                                        Alert.alert(
                                          'Could not save set',
                                          getErrorMessage(error),
                                        ),
                                    );
                                  }}
                                  keyboardType="number-pad"
                                  editable={!saving}
                                  selectTextOnFocus
                                />
                              </View>

                              <View style={styles.sessionInputColumn}>
                                <Text style={styles.label}>Weight (kg)</Text>
                                <TextInput
                                  style={styles.sessionInput}
                                  value={
                                    set.draftWeight ?? String(set.weight_kg)
                                  }
                                  onChangeText={(value) =>
                                    updateWorkoutSetDraft(
                                      set.id,
                                      'draftWeight',
                                      value,
                                    )
                                  }
                                  onEndEditing={() => {
                                    void saveWorkoutSetEdits(set).catch(
                                      (error) =>
                                        Alert.alert(
                                          'Could not save set',
                                          getErrorMessage(error),
                                        ),
                                    );
                                  }}
                                  keyboardType="decimal-pad"
                                  editable={!saving}
                                  selectTextOnFocus
                                />
                              </View>

                              <View style={styles.sessionInputColumn}>
                                <Text style={styles.label}>Rest (sec)</Text>

                                {isWorkoutActive &&
                                timerRunning &&
                                restSetId === set.id ? (
                                  <Pressable
                                    style={[
                                      styles.sessionInput,
                                      styles.restTimerActive,
                                    ]}
                                    onPress={() => {
                                      void stopRestTimer();
                                    }}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Rest timer ${formatTimer(restSeconds)} remaining. Tap to stop.`}
                                  >
                                    <Text style={styles.restTimerText}>
                                      {formatTimer(restSeconds)}
                                    </Text>
                                    <Text style={styles.restTimerHint}>
                                      Tap to stop
                                    </Text>
                                  </Pressable>
                                ) : (
                                  <TextInput
                                    style={styles.sessionInput}
                                    value={
                                      set.draftRest ??
                                      String(set.rest_seconds ?? 90)
                                    }
                                    onChangeText={(value) =>
                                      updateWorkoutSetDraft(
                                        set.id,
                                        'draftRest',
                                        value,
                                      )
                                    }
                                    onEndEditing={() => {
                                      void saveWorkoutSetEdits(set).catch(
                                        (error) =>
                                          Alert.alert(
                                            'Could not save set',
                                            getErrorMessage(error),
                                          ),
                                      );
                                    }}
                                    keyboardType="number-pad"
                                    editable={!saving}
                                    selectTextOnFocus
                                  />
                                )}
                              </View>
                            </View>
                          </View>

                          {isWorkoutActive && !set.completed_at && (
                            <Pressable
                              style={[
                                styles.completeSetButton,
                                saving && styles.disabledButton,
                              ]}
                              onPress={() => completeSet(set)}
                              disabled={saving}
                            >
                              <Text style={styles.completeSetButtonText}>
                                Complete Set
                              </Text>
                            </Pressable>
                          )}
                        </View>
                      ))
                    )}
                  </View>
                );
              })
            )}

            {isWorkoutActive && (
              <Pressable
                style={[styles.finishButton, saving && styles.disabledButton]}
                onPress={finishWorkout}
                disabled={saving}
              >
                <Text style={styles.primaryButtonText}>Finish Workout</Text>
              </Pressable>
            )}
          </>
        )}
      </ScrollView>

      {/* WEB-COMPATIBLE CONFIRMATION / ALERT DIALOG */}
      {dialog && (
        <View
          style={styles.dialogOverlay}
          accessibilityViewIsModal
          accessibilityRole="alert"
        >
          <Pressable
            style={styles.dialogBackdrop}
            onPress={() => setDialog(null)}
            accessibilityLabel="Close dialog"
          />

          <View style={styles.dialogCard}>
            <Text style={styles.dialogTitle}>{dialog.title}</Text>

            {dialog.message ? (
              <Text style={styles.dialogMessage}>{dialog.message}</Text>
            ) : null}

            <View style={styles.dialogButtons}>
              {dialog.buttons.map((button, index) => (
                <Pressable
                  key={`${button.text}-${index}`}
                  style={[
                    styles.dialogButton,
                    button.style === 'destructive' &&
                      styles.dialogDestructiveButton,
                    button.style === 'cancel' && styles.dialogCancelButton,
                    dialog.buttons.length === 1 && styles.dialogSingleButton,
                  ]}
                  onPress={() => handleDialogButton(button)}
                >
                  <Text
                    style={[
                      styles.dialogButtonText,
                      button.style === 'destructive' &&
                        styles.dialogDestructiveText,
                      button.style === 'cancel' && styles.dialogCancelText,
                    ]}
                  >
                    {button.text}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111111',
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingTop: 65,
    paddingBottom: 50,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#111111',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    color: '#ffffff',
    fontSize: 30,
    fontWeight: '700',
  },
  subtitle: {
    color: '#888888',
    fontSize: 15,
    marginTop: 8,
    marginBottom: 24,
  },
  card: {
    backgroundColor: '#1c1c1e',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2c2c2e',
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 14,
  },
  sectionHeadingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 28,
    marginBottom: 4,
  },
  historyHeading: {
    marginTop: 30,
  },
  countText: {
    color: '#999999',
    fontSize: 14,
    marginBottom: 14,
  },
  label: {
    color: '#cccccc',
    fontSize: 13,
    marginBottom: 7,
    marginTop: 10,
  },
  input: {
    backgroundColor: '#29292c',
    color: '#ffffff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#3a3a3c',
    minWidth: 0,
  },
  notesInput: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  inputColumn: {
    flex: 1,
    minWidth: 0,
  },
  primaryButton: {
    backgroundColor: PURPLE,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  disabledButton: {
    opacity: 0.5,
  },
  secondaryButton: {
    backgroundColor: '#30264d',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  secondaryButtonText: {
    color: '#c9baff',
    fontSize: 14,
    fontWeight: '700',
  },
  emptyCard: {
    backgroundColor: '#1c1c1e',
    borderRadius: 14,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2c2c2e',
  },
  emptyTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 7,
  },
  mutedText: {
    color: '#888888',
    fontSize: 13,
    lineHeight: 19,
  },
  routineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1c1c1e',
    borderRadius: 14,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2c2c2e',
  },
  routineIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#30264d',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  routineIconText: {
    color: '#c9baff',
    fontSize: 23,
    fontWeight: '700',
  },
  routineMain: {
    flex: 1,
    paddingRight: 8,
  },
  chevron: {
    color: '#999999',
    fontSize: 27,
  },
  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1c1c1e',
    borderRadius: 14,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2c2c2e',
  },
  historyMain: {
    flex: 1,
    paddingRight: 8,
  },
  historyTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 5,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 7,
  },
  completedText: {
    color: '#4ade80',
  },
  activeText: {
    color: '#b5a0ff',
  },
  deleteButton: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  deleteButtonText: {
    color: '#ff7777',
    fontSize: 13,
    fontWeight: '600',
  },
  backButton: {
    marginBottom: 18,
    alignSelf: 'flex-start',
    paddingVertical: 6,
  },
  backButtonText: {
    color: '#b5a0ff',
    fontSize: 15,
    fontWeight: '600',
  },
  smallTextButton: {
    padding: 8,
  },
  exerciseCard: {
    backgroundColor: '#1c1c1e',
    borderRadius: 15,
    padding: 15,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#303034',
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  exerciseHeading: {
    flex: 1,
  },
  exerciseTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 5,
  },
  plannedSetCard: {
    backgroundColor: '#242426',
    borderRadius: 10,
    padding: 10,
    marginTop: 9,
  },
  plannedSetHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  plannedSetTitle: {
    color: '#eeeeee',
    fontSize: 13,
    fontWeight: '700',
  },
  removeSetText: {
    color: '#ff7777',
    fontSize: 23,
    paddingHorizontal: 5,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginVertical: 18,
  },
  summaryBox: {
    flex: 1,
    backgroundColor: '#1c1c1e',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#303034',
  },
  summaryNumber: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 3,
  },
  noteText: {
    color: '#bbbbbb',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
  },
  detailHeading: {
    marginTop: 24,
  },
  routineEditableSet: {
    backgroundColor: '#242426',
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
  },
  sessionSetInputs: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  sessionInputColumn: {
    flex: 1,
    minWidth: 0,
  },
  sessionInput: {
    backgroundColor: '#29292c',
    color: '#ffffff',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#51416f',
    minWidth: 0,
  },
  restTimerActive: {
    backgroundColor: '#263C31',
    borderColor: '#72D6A0',
    minHeight: 54,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 6,
  },
  restTimerText: {
    color: '#72D6A0',
    fontSize: 17,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  restTimerHint: {
    color: '#72D6A0',
    fontSize: 9,
    marginTop: 2,
  },
  activeSetRow: {
    flexDirection: 'column',
    alignItems: 'stretch',
    paddingVertical: 13,
    borderTopWidth: 1,
    borderTopColor: '#333335',
    gap: 8,
  },
  activeSetDetails: {
    flex: 1,
  },
  setHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  activeSetTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  completeSetButton: {
    backgroundColor: '#30264d',
    borderRadius: 9,
    paddingHorizontal: 11,
    paddingVertical: 10,
    alignSelf: 'flex-start',
  },
  completeSetButtonText: {
    color: '#d2c5ff',
    fontSize: 12,
    fontWeight: '700',
  },
  doneBadge: {
    backgroundColor: '#163322',
    borderRadius: 9,
    paddingHorizontal: 11,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  doneBadgeText: {
    color: '#4ade80',
    fontSize: 12,
    fontWeight: '700',
  },
  notDoneText: {
    color: '#888888',
    fontSize: 11,
  },
  completedBanner: {
    backgroundColor: '#163322',
    borderRadius: 10,
    padding: 12,
    marginTop: 16,
  },
  completedBannerText: {
    color: '#4ade80',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  finishButton: {
    backgroundColor: '#d94848',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 14,
    marginBottom: 16,
  },
  cancelButtonText: {
    color: '#aaaaaa',
    fontSize: 14,
    fontWeight: '600',
  },
  exerciseSearchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1c1c1e',
    borderRadius: 14,
    padding: 15,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#51416f',
  },
  exerciseSearchIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#30264d',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  exerciseSearchIconText: {
    color: '#c9baff',
    fontSize: 28,
  },
  exerciseSearchContent: {
    flex: 1,
  },
  exerciseSearchTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  exerciseSearchArrow: {
    color: '#b5a0ff',
    fontSize: 28,
    marginLeft: 8,
  },

  dialogOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 9999,
    elevation: 20,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  dialogBackdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  dialogCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#222224',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#414145',
    padding: 22,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 20,
  },
  dialogTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 10,
  },
  dialogMessage: {
    color: '#c4c4c8',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 22,
  },
  dialogButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
  },
  dialogButton: {
    minHeight: 42,
    minWidth: 82,
    paddingHorizontal: 15,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: PURPLE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogSingleButton: {
    minWidth: 100,
  },
  dialogCancelButton: {
    backgroundColor: '#353538',
    borderWidth: 1,
    borderColor: '#505055',
  },
  dialogDestructiveButton: {
    backgroundColor: '#d94848',
  },
  dialogButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  dialogCancelText: {
    color: '#eeeeee',
  },
  dialogDestructiveText: {
    color: '#ffffff',
  },
});
