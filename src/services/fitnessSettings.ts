
import { supabase } from './supabase';

export type FitnessGoal = 'lose_fat' | 'maintain' | 'build_muscle';

export type FitnessSettings = {
  calorie_target: number;
  protein_target: number;
  carbs_target: number;
  fat_target: number;
  workout_days_target: number;
  fitness_goal: FitnessGoal;
};

export const DEFAULT_FITNESS_SETTINGS: FitnessSettings = {
  calorie_target: 2400,
  protein_target: 160,
  carbs_target: 250,
  fat_target: 70,
  workout_days_target: 4,
  fitness_goal: 'maintain',
};

export async function loadFitnessSettings(): Promise<FitnessSettings> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) throw new Error('Please sign in to load your settings.');

  const { data, error } = await supabase
    .from('fitness_settings')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) throw error;

  return {
    ...DEFAULT_FITNESS_SETTINGS,
    ...(data ?? {}),
  } as FitnessSettings;
}
