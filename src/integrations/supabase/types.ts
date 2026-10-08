export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      leads: {
        Row: {
          id: string;
          created_at: string;
          phone: string;
          gender: string | null;
          has_laptop: string | null;
          watch_seconds: number | null;
          unlocked_class: boolean;
          whatsapp_followup_status: string;
          whatsapp_followup_sent_at: string | null;
          whatsapp_last_reply_at: string | null;
          video_completed_at: string | null;
          user_agent: string | null;
          consent?: boolean;
          email?: string | null;
          full_name?: string | null;
          interest?: string | null;
          whatsapp?: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          phone: string;
          gender?: string | null;
          has_laptop?: string | null;
          watch_seconds?: number | null;
          unlocked_class?: boolean;
          whatsapp_followup_status?: string;
          whatsapp_followup_sent_at?: string | null;
          whatsapp_last_reply_at?: string | null;
          video_completed_at?: string | null;
          user_agent?: string | null;
          consent?: boolean;
          email?: string | null;
          full_name?: string | null;
          interest?: string | null;
          whatsapp?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          phone?: string;
          gender?: string | null;
          has_laptop?: string | null;
          watch_seconds?: number | null;
          unlocked_class?: boolean;
          whatsapp_followup_status?: string;
          whatsapp_followup_sent_at?: string | null;
          whatsapp_last_reply_at?: string | null;
          video_completed_at?: string | null;
          user_agent?: string | null;
          consent?: boolean;
          email?: string | null;
          full_name?: string | null;
          interest?: string | null;
          whatsapp?: string | null;
        };
        Relationships: [];
      };
      registrations: {
        Row: {
          id: string;
          created_at: string;
          phone_country_code: string;
          phone_number: string;
          gender: string | null;
          device_availability: string | null;
          is_read: boolean;
          lead_status: string;
          admin_notes: string | null;
          last_contacted_at: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          phone_country_code?: string;
          phone_number: string;
          gender?: string | null;
          device_availability?: string | null;
          is_read?: boolean;
          lead_status?: string;
          admin_notes?: string | null;
          last_contacted_at?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          phone_country_code?: string;
          phone_number?: string;
          gender?: string | null;
          device_availability?: string | null;
          is_read?: boolean;
          lead_status?: string;
          admin_notes?: string | null;
          last_contacted_at?: string | null;
        };
        Relationships: [];
      };
      orders: {
        Row: {
          id: string;
          registration_id: string | null;
          selected_option: string;
          amount: number;
          currency: string;
          razorpay_order_id: string | null;
          razorpay_payment_id: string | null;
          payment_status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          registration_id?: string | null;
          selected_option: string;
          amount: number;
          currency?: string;
          razorpay_order_id?: string | null;
          razorpay_payment_id?: string | null;
          payment_status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          registration_id?: string | null;
          selected_option?: string;
          amount?: number;
          currency?: string;
          razorpay_order_id?: string | null;
          razorpay_payment_id?: string | null;
          payment_status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      video_progress: {
        Row: {
          id: string;
          registration_id: string;
          video_id: string;
          last_position_seconds: number;
          completion_status: boolean;
          video_completed_at: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          registration_id: string;
          video_id: string;
          last_position_seconds?: number;
          completion_status?: boolean;
          video_completed_at?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          registration_id?: string;
          video_id?: string;
          last_position_seconds?: number;
          completion_status?: boolean;
          video_completed_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      funnel_events: {
        Row: {
          id: string;
          registration_id: string | null;
          event_name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          registration_id?: string | null;
          event_name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          registration_id?: string | null;
          event_name?: string;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
