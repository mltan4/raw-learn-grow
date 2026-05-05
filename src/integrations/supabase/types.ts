export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      post_drafts: {
        Row: {
          angle: string
          content: string
          created_at: string
          id: string
          is_selected: boolean
          note_id: string | null
          quality_flags: string[]
          selected_at: string | null
          tags: string[]
          title: string
          updated_at: string
          user_id: string
          word_count: number
        }
        Insert: {
          angle: string
          content: string
          created_at?: string
          id?: string
          is_selected?: boolean
          note_id?: string | null
          quality_flags?: string[]
          selected_at?: string | null
          tags?: string[]
          title: string
          updated_at?: string
          user_id: string
          word_count?: number
        }
        Update: {
          angle?: string
          content?: string
          created_at?: string
          id?: string
          is_selected?: boolean
          note_id?: string | null
          quality_flags?: string[]
          selected_at?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
          user_id?: string
          word_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "post_drafts_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "writing_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      preference_signals: {
        Row: {
          angle: string | null
          created_at: string
          draft_id: string | null
          id: string
          notes: string | null
          signal_type: string
          user_id: string
        }
        Insert: {
          angle?: string | null
          created_at?: string
          draft_id?: string | null
          id?: string
          notes?: string | null
          signal_type: string
          user_id: string
        }
        Update: {
          angle?: string | null
          created_at?: string
          draft_id?: string | null
          id?: string
          notes?: string | null
          signal_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "preference_signals_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "post_drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          default_reminder_time: string
          email: string | null
          github_handle: string | null
          github_repo: string | null
          id: string
          raw_mode_default: boolean
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          default_reminder_time?: string
          email?: string | null
          github_handle?: string | null
          github_repo?: string | null
          id?: string
          raw_mode_default?: boolean
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          default_reminder_time?: string
          email?: string | null
          github_handle?: string | null
          github_repo?: string | null
          id?: string
          raw_mode_default?: boolean
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      scheduled_posts: {
        Row: {
          copy_snapshot: string
          created_at: string
          draft_id: string | null
          follow_up_sent_at: string | null
          id: string
          note_id: string | null
          posted_at: string | null
          reminder_sent_at: string | null
          scheduled_for: string
          snoozed_until: string | null
          status: string
          tags: string[]
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          copy_snapshot: string
          created_at?: string
          draft_id?: string | null
          follow_up_sent_at?: string | null
          id?: string
          note_id?: string | null
          posted_at?: string | null
          reminder_sent_at?: string | null
          scheduled_for: string
          snoozed_until?: string | null
          status?: string
          tags?: string[]
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          copy_snapshot?: string
          created_at?: string
          draft_id?: string | null
          follow_up_sent_at?: string | null
          id?: string
          note_id?: string | null
          posted_at?: string | null
          reminder_sent_at?: string | null
          scheduled_for?: string
          snoozed_until?: string | null
          status?: string
          tags?: string[]
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_posts_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "post_drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_posts_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "writing_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      webinars: {
        Row: {
          context: string | null
          created_at: string
          final_version: string | null
          generated_post: string | null
          id: string
          notes: string
          presenter: string | null
          source: string
          tags: string[]
          title: string
          topic: string | null
          updated_at: string
          user_id: string
          watched_at: string
        }
        Insert: {
          context?: string | null
          created_at?: string
          final_version?: string | null
          generated_post?: string | null
          id?: string
          notes: string
          presenter?: string | null
          source?: string
          tags?: string[]
          title: string
          topic?: string | null
          updated_at?: string
          user_id: string
          watched_at?: string
        }
        Update: {
          context?: string | null
          created_at?: string
          final_version?: string | null
          generated_post?: string | null
          id?: string
          notes?: string
          presenter?: string | null
          source?: string
          tags?: string[]
          title?: string
          topic?: string | null
          updated_at?: string
          user_id?: string
          watched_at?: string
        }
        Relationships: []
      }
      writing_notes: {
        Row: {
          content: string
          created_at: string
          id: string
          raw_mode: boolean
          source: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          raw_mode?: boolean
          source?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          raw_mode?: boolean
          source?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
