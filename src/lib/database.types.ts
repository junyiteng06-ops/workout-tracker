// supabase/migrations のスキーマに対応する型(`supabase gen types typescript` と同じ形式)
// スキーマを変更したらここも更新すること

export type BodyPart = 'chest' | 'back' | 'shoulders' | 'arms' | 'legs' | 'core' | 'other';

export interface Database {
  public: {
    Tables: {
      exercises: {
        Row: { id: number; user_id: string | null; name: string; body_part: BodyPart; created_at: string };
        Insert: { name: string; body_part?: BodyPart; user_id?: string | null };
        Update: { name?: string; body_part?: BodyPart };
        Relationships: [];
      };
      workouts: {
        Row: { id: number; user_id: string; performed_on: string; note: string | null; created_at: string; updated_at: string };
        Insert: { performed_on: string; note?: string | null };
        Update: { performed_on?: string; note?: string | null };
        Relationships: [];
      };
      workout_sets: {
        Row: { id: number; workout_id: number; user_id: string; exercise_id: number; set_no: number; weight: number; reps: number };
        Insert: { workout_id: number; exercise_id: number; set_no: number; weight: number; reps: number };
        Update: { weight?: number; reps?: number };
        Relationships: [
          {
            foreignKeyName: 'workout_sets_workout_id_fkey';
            columns: ['workout_id'];
            isOneToOne: false;
            referencedRelation: 'workouts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'workout_sets_exercise_id_fkey';
            columns: ['exercise_id'];
            isOneToOne: false;
            referencedRelation: 'exercises';
            referencedColumns: ['id'];
          },
        ];
      };
      body_metrics: {
        Row: { id: number; user_id: string; measured_on: string; weight: number | null; body_fat: number | null; created_at: string };
        Insert: { measured_on: string; weight?: number | null; body_fat?: number | null; user_id?: string };
        Update: { weight?: number | null; body_fat?: number | null };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      save_workout: {
        Args: {
          p_workout_id: number | null;
          p_performed_on: string;
          p_note: string | null;
          p_sets: { exercise_id: number; weight: number; reps: number }[];
        };
        Returns: number;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}
