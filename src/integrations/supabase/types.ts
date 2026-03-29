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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      admin_subscriptions: {
        Row: {
          admin_id: string
          created_at: string | null
          end_date: string
          id: string
          payment_status: string | null
          plan_id: string
          start_date: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          admin_id: string
          created_at?: string | null
          end_date: string
          id?: string
          payment_status?: string | null
          plan_id: string
          start_date?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          admin_id?: string
          created_at?: string | null
          end_date?: string
          id?: string
          payment_status?: string | null
          plan_id?: string
          start_date?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_subscriptions_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluations: {
        Row: {
          created_at: string
          evaluator_id: string
          guard_id: string
          id: string
          scores: Json
          total_score: number
        }
        Insert: {
          created_at?: string
          evaluator_id: string
          guard_id: string
          id?: string
          scores?: Json
          total_score?: number
        }
        Update: {
          created_at?: string
          evaluator_id?: string
          guard_id?: string
          id?: string
          scores?: Json
          total_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "evaluations_evaluator_id_fkey"
            columns: ["evaluator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluations_guard_id_fkey"
            columns: ["guard_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      extras: {
        Row: {
          admin_id: string | null
          created_at: string
          created_by: string | null
          extra_date: string
          guard_id: string
          id: string
          justification: string
          month_reference: string
          percentage_type: number
          quantity: number
          updated_at: string
        }
        Insert: {
          admin_id?: string | null
          created_at?: string
          created_by?: string | null
          extra_date: string
          guard_id: string
          id?: string
          justification: string
          month_reference: string
          percentage_type?: number
          quantity?: number
          updated_at?: string
        }
        Update: {
          admin_id?: string | null
          created_at?: string
          created_by?: string | null
          extra_date?: string
          guard_id?: string
          id?: string
          justification?: string
          month_reference?: string
          percentage_type?: number
          quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "extras_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extras_guard_id_fkey"
            columns: ["guard_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      guard_notes: {
        Row: {
          admin_id: string | null
          created_at: string
          description: string
          guard_id: string
          id: string
          note_date: string
          note_type: string
          title: string
          updated_at: string
        }
        Insert: {
          admin_id?: string | null
          created_at?: string
          description: string
          guard_id: string
          id?: string
          note_date?: string
          note_type: string
          title: string
          updated_at?: string
        }
        Update: {
          admin_id?: string | null
          created_at?: string
          description?: string
          guard_id?: string
          id?: string
          note_date?: string
          note_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guard_notes_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guard_notes_guard_id_fkey"
            columns: ["guard_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      guard_tre_quotas: {
        Row: {
          admin_id: string | null
          created_at: string
          guard_id: string
          id: string
          total_days: number
          updated_at: string
        }
        Insert: {
          admin_id?: string | null
          created_at?: string
          guard_id: string
          id?: string
          total_days?: number
          updated_at?: string
        }
        Update: {
          admin_id?: string | null
          created_at?: string
          guard_id?: string
          id?: string
          total_days?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guard_tre_quotas_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guard_tre_quotas_guard_id_fkey"
            columns: ["guard_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      keep_alive: {
        Row: {
          id: number
          last_ping: string | null
        }
        Insert: {
          id?: number
          last_ping?: string | null
        }
        Update: {
          id?: number
          last_ping?: string | null
        }
        Relationships: []
      }
      leaves: {
        Row: {
          admin_id: string | null
          created_at: string
          custom_type: string | null
          end_date: string
          guard_id: string
          id: string
          leave_type: string
          notes: string | null
          protocol: string | null
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          admin_id?: string | null
          created_at?: string
          custom_type?: string | null
          end_date: string
          guard_id: string
          id?: string
          leave_type: string
          notes?: string | null
          protocol?: string | null
          start_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          admin_id?: string | null
          created_at?: string
          custom_type?: string | null
          end_date?: string
          guard_id?: string
          id?: string
          leave_type?: string
          notes?: string | null
          protocol?: string | null
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leaves_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leaves_guard_id_fkey"
            columns: ["guard_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_settings: {
        Row: {
          admin_id: string | null
          created_at: string | null
          extra_label: string
          extras_label: string
          guard_label: string
          guards_label: string
          id: string
          schedule_label: string
          schedules_label: string
          shift_label: string
          shifts_label: string
          swap_label: string
          swaps_label: string
          team_label: string
          teams_label: string
          updated_at: string | null
        }
        Insert: {
          admin_id?: string | null
          created_at?: string | null
          extra_label?: string
          extras_label?: string
          guard_label?: string
          guards_label?: string
          id?: string
          schedule_label?: string
          schedules_label?: string
          shift_label?: string
          shifts_label?: string
          swap_label?: string
          swaps_label?: string
          team_label?: string
          teams_label?: string
          updated_at?: string | null
        }
        Update: {
          admin_id?: string | null
          created_at?: string | null
          extra_label?: string
          extras_label?: string
          guard_label?: string
          guards_label?: string
          id?: string
          schedule_label?: string
          schedules_label?: string
          shift_label?: string
          shifts_label?: string
          swap_label?: string
          swaps_label?: string
          team_label?: string
          teams_label?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_settings_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          admin_id: string | null
          birth_date: string | null
          cpf: string | null
          created_at: string
          email: string
          emergency_contact: string | null
          emergency_phone: string | null
          full_name: string | null
          hire_date: string | null
          id: string
          is_active: boolean | null
          is_shift_chief: boolean
          name: string
          phone: string | null
          photo_url: string | null
          rg: string | null
          team_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          admin_id?: string | null
          birth_date?: string | null
          cpf?: string | null
          created_at?: string
          email: string
          emergency_contact?: string | null
          emergency_phone?: string | null
          full_name?: string | null
          hire_date?: string | null
          id?: string
          is_active?: boolean | null
          is_shift_chief?: boolean
          name: string
          phone?: string | null
          photo_url?: string | null
          rg?: string | null
          team_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          admin_id?: string | null
          birth_date?: string | null
          cpf?: string | null
          created_at?: string
          email?: string
          emergency_contact?: string | null
          emergency_phone?: string | null
          full_name?: string | null
          hire_date?: string | null
          id?: string
          is_active?: boolean | null
          is_shift_chief?: boolean
          name?: string
          phone?: string | null
          photo_url?: string | null
          rg?: string | null
          team_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          active: boolean | null
          created_at: string | null
          description: string | null
          duration_months: number
          features: Json | null
          id: string
          max_guards: number | null
          max_teams: number | null
          name: string
          price: number
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          duration_months: number
          features?: Json | null
          id?: string
          max_guards?: number | null
          max_teams?: number | null
          name: string
          price: number
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          duration_months?: number
          features?: Json | null
          id?: string
          max_guards?: number | null
          max_teams?: number | null
          name?: string
          price?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      swap_requests: {
        Row: {
          admin_approved: boolean | null
          admin_approved_at: string | null
          admin_approved_by: string | null
          admin_id: string | null
          created_at: string
          id: string
          reason: string
          requester_id: string
          requester_shift_date: string
          status: string
          target_confirmation: boolean | null
          target_id: string
          target_shift_date: string
          updated_at: string
        }
        Insert: {
          admin_approved?: boolean | null
          admin_approved_at?: string | null
          admin_approved_by?: string | null
          admin_id?: string | null
          created_at?: string
          id?: string
          reason: string
          requester_id: string
          requester_shift_date: string
          status?: string
          target_confirmation?: boolean | null
          target_id: string
          target_shift_date: string
          updated_at?: string
        }
        Update: {
          admin_approved?: boolean | null
          admin_approved_at?: string | null
          admin_approved_by?: string | null
          admin_id?: string | null
          created_at?: string
          id?: string
          reason?: string
          requester_id?: string
          requester_shift_date?: string
          status?: string
          target_confirmation?: boolean | null
          target_id?: string
          target_shift_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "swap_requests_admin_approved_by_fkey"
            columns: ["admin_approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "swap_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "swap_requests_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      team_schedules: {
        Row: {
          admin_id: string | null
          created_at: string
          id: string
          shift_date: string
          team_id: string
          updated_at: string
        }
        Insert: {
          admin_id?: string | null
          created_at?: string
          id?: string
          shift_date: string
          team_id: string
          updated_at?: string
        }
        Update: {
          admin_id?: string | null
          created_at?: string
          id?: string
          shift_date?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_schedules_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          admin_id: string | null
          color: string
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          admin_id?: string | null
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          admin_id?: string | null
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_admin_subscription_status: {
        Args: { _user_id: string }
        Returns: boolean
      }
      get_available_guards_for_swap: {
        Args: never
        Returns: {
          email: string
          id: string
          name: string
          phone: string
          team_color: string
          team_id: string
          team_name: string
        }[]
      }
      get_profile_id: { Args: { _user_id: string }; Returns: string }
      get_user_admin_id: { Args: { _user_id: string }; Returns: string }
      get_user_id_by_email: { Args: { email_address: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_active: { Args: { _user_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      suspend_expired_admins: { Args: never; Returns: undefined }
      swap_team_schedules: {
        Args: {
          _requester_id: string
          _requester_shift_date: string
          _target_id: string
          _target_shift_date: string
        }
        Returns: undefined
      }
      user_belongs_to_admin_org: {
        Args: { _admin_user_id: string; _target_user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "guard" | "super_admin"
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
    Enums: {
      app_role: ["admin", "guard", "super_admin"],
    },
  },
} as const
