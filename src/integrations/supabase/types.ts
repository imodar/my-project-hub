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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      admin_transfer_requests: {
        Row: {
          approvals: Json
          created_at: string
          family_id: string
          id: string
          reason: string | null
          requested_by: string
          required_approvals: number
          status: string
        }
        Insert: {
          approvals?: Json
          created_at?: string
          family_id: string
          id?: string
          reason?: string | null
          requested_by: string
          required_approvals?: number
          status?: string
        }
        Update: {
          approvals?: Json
          created_at?: string
          family_id?: string
          id?: string
          reason?: string | null
          requested_by?: string
          required_approvals?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_transfer_requests_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      album_photos: {
        Row: {
          album_id: string
          caption: string | null
          created_at: string
          date: string | null
          id: string
          url: string
        }
        Insert: {
          album_id: string
          caption?: string | null
          created_at?: string
          date?: string | null
          id?: string
          url: string
        }
        Update: {
          album_id?: string
          caption?: string | null
          created_at?: string
          date?: string | null
          id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "album_photos_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "albums"
            referencedColumns: ["id"]
          },
        ]
      }
      albums: {
        Row: {
          cover_color: string | null
          created_at: string
          created_by: string
          family_id: string
          id: string
          linked_trip_id: string | null
          name: string
        }
        Insert: {
          cover_color?: string | null
          created_at?: string
          created_by: string
          family_id: string
          id?: string
          linked_trip_id?: string | null
          name: string
        }
        Update: {
          cover_color?: string | null
          created_at?: string
          created_by?: string
          family_id?: string
          id?: string
          linked_trip_id?: string | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "albums_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "albums_linked_trip_id_fkey"
            columns: ["linked_trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_expenses: {
        Row: {
          amount: number
          budget_id: string
          created_at: string
          currency: string
          date: string | null
          id: string
          name: string
        }
        Insert: {
          amount?: number
          budget_id: string
          created_at?: string
          currency?: string
          date?: string | null
          id?: string
          name: string
        }
        Update: {
          amount?: number
          budget_id?: string
          created_at?: string
          currency?: string
          date?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_expenses_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          created_at: string
          created_by: string
          family_id: string
          id: string
          income: number
          label: string | null
          month: string | null
          shared_with: string[] | null
          trip_id: string | null
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          family_id: string
          id?: string
          income?: number
          label?: string | null
          month?: string | null
          shared_with?: string[] | null
          trip_id?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          family_id?: string
          id?: string
          income?: number
          label?: string | null
          month?: string | null
          shared_with?: string[] | null
          trip_id?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budgets_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          added_by: string
          created_at: string
          date: string
          family_id: string
          icon: string | null
          id: string
          personal_reminders: string[] | null
          reminder_before: string[] | null
          title: string
        }
        Insert: {
          added_by: string
          created_at?: string
          date: string
          family_id: string
          icon?: string | null
          id?: string
          personal_reminders?: string[] | null
          reminder_before?: string[] | null
          title: string
        }
        Update: {
          added_by?: string
          created_at?: string
          date?: string
          family_id?: string
          icon?: string | null
          id?: string
          personal_reminders?: string[] | null
          reminder_before?: string[] | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          created_at: string
          encrypted_text: string
          family_id: string
          id: string
          iv: string
          mention_user_id: string | null
          pinned: boolean
          reactions: Json | null
          sender_id: string
          status: string
        }
        Insert: {
          created_at?: string
          encrypted_text: string
          family_id: string
          id?: string
          iv: string
          mention_user_id?: string | null
          pinned?: boolean
          reactions?: Json | null
          sender_id: string
          status?: string
        }
        Update: {
          created_at?: string
          encrypted_text?: string
          family_id?: string
          id?: string
          iv?: string
          mention_user_id?: string | null
          pinned?: boolean
          reactions?: Json | null
          sender_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      consent_log: {
        Row: {
          accepted: boolean
          consent_type: string
          created_at: string
          id: string
          ip_address: string | null
          user_id: string
          version: string
        }
        Insert: {
          accepted?: boolean
          consent_type: string
          created_at?: string
          id?: string
          ip_address?: string | null
          user_id: string
          version: string
        }
        Update: {
          accepted?: boolean
          consent_type?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          user_id?: string
          version?: string
        }
        Relationships: []
      }
      debt_payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          date: string
          debt_id: string
          id: string
          item_description: string | null
          payment_details: Json | null
          type: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          date?: string
          debt_id: string
          id?: string
          item_description?: string | null
          payment_details?: Json | null
          type?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          date?: string
          debt_id?: string
          id?: string
          item_description?: string | null
          payment_details?: Json | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "debt_payments_debt_id_fkey"
            columns: ["debt_id"]
            isOneToOne: false
            referencedRelation: "debts"
            referencedColumns: ["id"]
          },
        ]
      }
      debt_postponements: {
        Row: {
          created_at: string
          debt_id: string
          id: string
          new_date: string
          reason: string | null
        }
        Insert: {
          created_at?: string
          debt_id: string
          id?: string
          new_date: string
          reason?: string | null
        }
        Update: {
          created_at?: string
          debt_id?: string
          id?: string
          new_date?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "debt_postponements_debt_id_fkey"
            columns: ["debt_id"]
            isOneToOne: false
            referencedRelation: "debts"
            referencedColumns: ["id"]
          },
        ]
      }
      debts: {
        Row: {
          amount: number
          created_at: string
          currency: string
          date: string
          direction: string
          due_date: string | null
          family_id: string
          has_reminder: boolean
          id: string
          is_archived: boolean
          is_fully_paid: boolean
          note: string | null
          payment_details: Json | null
          person_name: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          date?: string
          direction: string
          due_date?: string | null
          family_id: string
          has_reminder?: boolean
          id?: string
          is_archived?: boolean
          is_fully_paid?: boolean
          note?: string | null
          payment_details?: Json | null
          person_name: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          date?: string
          direction?: string
          due_date?: string | null
          family_id?: string
          has_reminder?: boolean
          id?: string
          is_archived?: boolean
          is_fully_paid?: boolean
          note?: string | null
          payment_details?: Json | null
          person_name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "debts_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      document_files: {
        Row: {
          added_at: string | null
          document_id: string
          file_url: string
          id: string
          name: string
          size: number | null
          type: string | null
        }
        Insert: {
          added_at?: string | null
          document_id: string
          file_url: string
          id?: string
          name: string
          size?: number | null
          type?: string | null
        }
        Update: {
          added_at?: string | null
          document_id?: string
          file_url?: string
          id?: string
          name?: string
          size?: number | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_files_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "document_items"
            referencedColumns: ["id"]
          },
        ]
      }
      document_items: {
        Row: {
          added_at: string | null
          added_by: string | null
          category: string | null
          expiry_date: string | null
          id: string
          list_id: string
          name: string
          note: string | null
          reminder_enabled: boolean | null
        }
        Insert: {
          added_at?: string | null
          added_by?: string | null
          category?: string | null
          expiry_date?: string | null
          id?: string
          list_id: string
          name: string
          note?: string | null
          reminder_enabled?: boolean | null
        }
        Update: {
          added_at?: string | null
          added_by?: string | null
          category?: string | null
          expiry_date?: string | null
          id?: string
          list_id?: string
          name?: string
          note?: string | null
          reminder_enabled?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "document_items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "document_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      document_lists: {
        Row: {
          created_at: string
          created_by: string
          family_id: string
          id: string
          name: string
          shared_with: string[] | null
          type: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          family_id: string
          id?: string
          name: string
          shared_with?: string[] | null
          type?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          family_id?: string
          id?: string
          name?: string
          shared_with?: string[] | null
          type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_lists_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      emergency_contacts: {
        Row: {
          created_by: string
          family_id: string
          id: string
          name: string
          phone: string
        }
        Insert: {
          created_by: string
          family_id: string
          id?: string
          name: string
          phone: string
        }
        Update: {
          created_by?: string
          family_id?: string
          id?: string
          name?: string
          phone?: string
        }
        Relationships: [
          {
            foreignKeyName: "emergency_contacts_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      families: {
        Row: {
          created_at: string
          created_by: string
          id: string
          invite_code: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          invite_code?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          invite_code?: string
          name?: string
        }
        Relationships: []
      }
      family_deletions: {
        Row: {
          deleted_at: string
          deleted_by: string
          family_id: string
          id: string
          permanent_delete_at: string
          reason: string | null
          restored_at: string | null
          status: string
        }
        Insert: {
          deleted_at?: string
          deleted_by: string
          family_id: string
          id?: string
          permanent_delete_at?: string
          reason?: string | null
          restored_at?: string | null
          status?: string
        }
        Update: {
          deleted_at?: string
          deleted_by?: string
          family_id?: string
          id?: string
          permanent_delete_at?: string
          reason?: string | null
          restored_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_deletions_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      family_invites: {
        Row: {
          created_at: string
          expires_at: string
          family_id: string
          id: string
          invite_type: string
          invited_by: string
          role_assigned: Database["public"]["Enums"]["family_role"] | null
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          created_at?: string
          expires_at?: string
          family_id: string
          id?: string
          invite_type?: string
          invited_by: string
          role_assigned?: Database["public"]["Enums"]["family_role"] | null
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          family_id?: string
          id?: string
          invite_type?: string
          invited_by?: string
          role_assigned?: Database["public"]["Enums"]["family_role"] | null
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "family_invites_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      family_keys: {
        Row: {
          created_at: string
          encrypted_key: string
          family_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          encrypted_key: string
          family_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          encrypted_key?: string
          family_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_keys_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      family_members: {
        Row: {
          family_id: string
          id: string
          is_admin: boolean
          joined_at: string
          role: Database["public"]["Enums"]["family_role"]
          status: string
          user_id: string
        }
        Insert: {
          family_id: string
          id?: string
          is_admin?: boolean
          joined_at?: string
          role?: Database["public"]["Enums"]["family_role"]
          status?: string
          user_id: string
        }
        Update: {
          family_id?: string
          id?: string
          is_admin?: boolean
          joined_at?: string
          role?: Database["public"]["Enums"]["family_role"]
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_members_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      islamic_reminder_prefs: {
        Row: {
          enabled: boolean
          id: string
          reminder_id: string
          user_id: string
        }
        Insert: {
          enabled?: boolean
          id?: string
          reminder_id: string
          user_id: string
        }
        Update: {
          enabled?: boolean
          id?: string
          reminder_id?: string
          user_id?: string
        }
        Relationships: []
      }
      kids_worship_data: {
        Row: {
          child_id: string
          day: number
          id: string
          items: Json | null
          month: number
          user_id: string | null
          year: number
        }
        Insert: {
          child_id: string
          day: number
          id?: string
          items?: Json | null
          month: number
          user_id?: string | null
          year: number
        }
        Update: {
          child_id?: string
          day?: number
          id?: string
          items?: Json | null
          month?: number
          user_id?: string | null
          year?: number
        }
        Relationships: []
      }
      market_items: {
        Row: {
          added_by: string | null
          category: string | null
          checked: boolean
          checked_by: string | null
          created_at: string
          id: string
          list_id: string
          name: string
          quantity: number
        }
        Insert: {
          added_by?: string | null
          category?: string | null
          checked?: boolean
          checked_by?: string | null
          created_at?: string
          id?: string
          list_id: string
          name: string
          quantity?: number
        }
        Update: {
          added_by?: string | null
          category?: string | null
          checked?: boolean
          checked_by?: string | null
          created_at?: string
          id?: string
          list_id?: string
          name?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "market_items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "market_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      market_lists: {
        Row: {
          created_at: string
          created_by: string
          family_id: string
          id: string
          name: string
          shared_with: string[] | null
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          family_id: string
          id?: string
          name: string
          shared_with?: string[] | null
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          family_id?: string
          id?: string
          name?: string
          shared_with?: string[] | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_lists_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      medication_logs: {
        Row: {
          created_at: string
          id: string
          medication_id: string
          notes: string | null
          skipped: boolean
          taken_at: string
          taken_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          medication_id: string
          notes?: string | null
          skipped?: boolean
          taken_at?: string
          taken_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          medication_id?: string
          notes?: string | null
          skipped?: boolean
          taken_at?: string
          taken_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "medication_logs_medication_id_fkey"
            columns: ["medication_id"]
            isOneToOne: false
            referencedRelation: "medications"
            referencedColumns: ["id"]
          },
        ]
      }
      medications: {
        Row: {
          color: string | null
          created_at: string
          dosage: string | null
          end_date: string | null
          family_id: string
          frequency_type: string | null
          frequency_value: number | null
          id: string
          member_id: string | null
          member_name: string | null
          name: string
          notes: string | null
          reminder_enabled: boolean | null
          selected_days: number[] | null
          specific_times: string[] | null
          start_date: string | null
          times_per_day: number | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          dosage?: string | null
          end_date?: string | null
          family_id: string
          frequency_type?: string | null
          frequency_value?: number | null
          id?: string
          member_id?: string | null
          member_name?: string | null
          name: string
          notes?: string | null
          reminder_enabled?: boolean | null
          selected_days?: number[] | null
          specific_times?: string[] | null
          start_date?: string | null
          times_per_day?: number | null
        }
        Update: {
          color?: string | null
          created_at?: string
          dosage?: string | null
          end_date?: string | null
          family_id?: string
          frequency_type?: string | null
          frequency_value?: number | null
          id?: string
          member_id?: string | null
          member_name?: string | null
          name?: string
          notes?: string | null
          reminder_enabled?: boolean | null
          selected_days?: number[] | null
          specific_times?: string[] | null
          start_date?: string | null
          times_per_day?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "medications_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      member_removals: {
        Row: {
          deleted_at: string
          family_id: string
          id: string
          permanent_delete_at: string
          personal_data_migrated: boolean
          reason: string | null
          removed_by: string
          removed_user_id: string
          restored_at: string | null
        }
        Insert: {
          deleted_at?: string
          family_id: string
          id?: string
          permanent_delete_at?: string
          personal_data_migrated?: boolean
          reason?: string | null
          removed_by: string
          removed_user_id: string
          restored_at?: string | null
        }
        Update: {
          deleted_at?: string
          family_id?: string
          id?: string
          permanent_delete_at?: string
          personal_data_migrated?: boolean
          reason?: string | null
          removed_by?: string
          removed_user_id?: string
          restored_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_removals_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      place_lists: {
        Row: {
          created_at: string
          created_by: string
          family_id: string
          id: string
          name: string
          shared_with: string[] | null
          type: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          family_id: string
          id?: string
          name: string
          shared_with?: string[] | null
          type?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          family_id?: string
          id?: string
          name?: string
          shared_with?: string[] | null
          type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_lists_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      places: {
        Row: {
          added_by: string | null
          address: string | null
          category: string | null
          description: string | null
          id: string
          kid_friendly: boolean | null
          lat: number | null
          list_id: string
          lng: number | null
          must_visit: boolean | null
          name: string
          note: string | null
          phone: string | null
          price_range: string | null
          rating: number | null
          social_link: string | null
          suggested_by: string | null
          visited: boolean | null
        }
        Insert: {
          added_by?: string | null
          address?: string | null
          category?: string | null
          description?: string | null
          id?: string
          kid_friendly?: boolean | null
          lat?: number | null
          list_id: string
          lng?: number | null
          must_visit?: boolean | null
          name: string
          note?: string | null
          phone?: string | null
          price_range?: string | null
          rating?: number | null
          social_link?: string | null
          suggested_by?: string | null
          visited?: boolean | null
        }
        Update: {
          added_by?: string | null
          address?: string | null
          category?: string | null
          description?: string | null
          id?: string
          kid_friendly?: boolean | null
          lat?: number | null
          list_id?: string
          lng?: number | null
          must_visit?: boolean | null
          name?: string
          note?: string | null
          phone?: string | null
          price_range?: string | null
          rating?: number | null
          social_link?: string | null
          suggested_by?: string | null
          visited?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "places_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "place_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      prayer_logs: {
        Row: {
          child_id: string
          created_at: string
          date: string
          id: string
          notes: string | null
          prayers: Json | null
          user_id: string | null
        }
        Insert: {
          child_id: string
          created_at?: string
          date: string
          id?: string
          notes?: string | null
          prayers?: Json | null
          user_id?: string | null
        }
        Update: {
          child_id?: string
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          prayers?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          deleted_at: string | null
          id: string
          is_deleted: boolean
          last_login_at: string | null
          name: string | null
          phone: string | null
          subscription_expires_at: string | null
          subscription_plan: Database["public"]["Enums"]["subscription_plan"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          deleted_at?: string | null
          id: string
          is_deleted?: boolean
          last_login_at?: string | null
          name?: string | null
          phone?: string | null
          subscription_expires_at?: string | null
          subscription_plan?: Database["public"]["Enums"]["subscription_plan"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_deleted?: boolean
          last_login_at?: string | null
          name?: string | null
          phone?: string | null
          subscription_expires_at?: string | null
          subscription_plan?: Database["public"]["Enums"]["subscription_plan"]
          updated_at?: string
        }
        Relationships: []
      }
      tasbih_sessions: {
        Row: {
          count: number
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          count?: number
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          count?: number
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      task_items: {
        Row: {
          assigned_to: string | null
          created_at: string
          done: boolean
          id: string
          list_id: string
          name: string
          note: string | null
          priority: string | null
          repeat_count: number
          repeat_days: number[] | null
          repeat_enabled: boolean
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          done?: boolean
          id?: string
          list_id: string
          name: string
          note?: string | null
          priority?: string | null
          repeat_count?: number
          repeat_days?: number[] | null
          repeat_enabled?: boolean
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          done?: boolean
          id?: string
          list_id?: string
          name?: string
          note?: string | null
          priority?: string | null
          repeat_count?: number
          repeat_days?: number[] | null
          repeat_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "task_items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "task_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      task_lists: {
        Row: {
          created_at: string
          created_by: string
          family_id: string
          id: string
          name: string
          shared_with: string[] | null
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          family_id: string
          id?: string
          name: string
          shared_with?: string[] | null
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          family_id?: string
          id?: string
          name?: string
          shared_with?: string[] | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_lists_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_activities: {
        Row: {
          completed: boolean | null
          cost: number | null
          day_plan_id: string
          id: string
          location: string | null
          name: string
          time: string | null
        }
        Insert: {
          completed?: boolean | null
          cost?: number | null
          day_plan_id: string
          id?: string
          location?: string | null
          name: string
          time?: string | null
        }
        Update: {
          completed?: boolean | null
          cost?: number | null
          day_plan_id?: string
          id?: string
          location?: string | null
          name?: string
          time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trip_activities_day_plan_id_fkey"
            columns: ["day_plan_id"]
            isOneToOne: false
            referencedRelation: "trip_day_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_day_plans: {
        Row: {
          city: string | null
          day_number: number
          id: string
          trip_id: string
        }
        Insert: {
          city?: string | null
          day_number: number
          id?: string
          trip_id: string
        }
        Update: {
          city?: string | null
          day_number?: number
          id?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_day_plans_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_documents: {
        Row: {
          added_at: string
          file_name: string | null
          file_url: string | null
          id: string
          name: string
          notes: string | null
          trip_id: string
          type: string | null
        }
        Insert: {
          added_at?: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          name: string
          notes?: string | null
          trip_id: string
          type?: string | null
        }
        Update: {
          added_at?: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          name?: string
          notes?: string | null
          trip_id?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trip_documents_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_expenses: {
        Row: {
          amount: number
          id: string
          name: string
          trip_id: string
        }
        Insert: {
          amount?: number
          id?: string
          name: string
          trip_id: string
        }
        Update: {
          amount?: number
          id?: string
          name?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_expenses_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_packing: {
        Row: {
          id: string
          name: string
          packed: boolean | null
          trip_id: string
        }
        Insert: {
          id?: string
          name: string
          packed?: boolean | null
          trip_id: string
        }
        Update: {
          id?: string
          name?: string
          packed?: boolean | null
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_packing_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_suggestions: {
        Row: {
          id: string
          location: string | null
          place_name: string
          reason: string | null
          status: string | null
          suggested_by: string | null
          trip_id: string
          type: string | null
        }
        Insert: {
          id?: string
          location?: string | null
          place_name: string
          reason?: string | null
          status?: string | null
          suggested_by?: string | null
          trip_id: string
          type?: string | null
        }
        Update: {
          id?: string
          location?: string | null
          place_name?: string
          reason?: string | null
          status?: string | null
          suggested_by?: string | null
          trip_id?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trip_suggestions_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          budget: number
          created_at: string
          created_by: string
          destination: string | null
          end_date: string | null
          family_id: string
          id: string
          name: string
          start_date: string | null
          status: string
        }
        Insert: {
          budget?: number
          created_at?: string
          created_by: string
          destination?: string | null
          end_date?: string | null
          family_id: string
          id?: string
          name: string
          start_date?: string | null
          status?: string
        }
        Update: {
          budget?: number
          created_at?: string
          created_by?: string
          destination?: string | null
          end_date?: string | null
          family_id?: string
          id?: string
          name?: string
          start_date?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "trips_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      user_keypairs: {
        Row: {
          created_at: string
          encrypted_private_key: string
          id: string
          iv: string
          public_key: string
          salt: string
          user_id: string
        }
        Insert: {
          created_at?: string
          encrypted_private_key: string
          id?: string
          iv: string
          public_key: string
          salt: string
          user_id: string
        }
        Update: {
          created_at?: string
          encrypted_private_key?: string
          id?: string
          iv?: string
          public_key?: string
          salt?: string
          user_id?: string
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
      vaccination_children: {
        Row: {
          birth_date: string | null
          completed_vaccines: Json | null
          created_at: string
          family_id: string
          gender: string | null
          id: string
          name: string
          reminder_settings: Json | null
        }
        Insert: {
          birth_date?: string | null
          completed_vaccines?: Json | null
          created_at?: string
          family_id: string
          gender?: string | null
          id?: string
          name: string
          reminder_settings?: Json | null
        }
        Update: {
          birth_date?: string | null
          completed_vaccines?: Json | null
          created_at?: string
          family_id?: string
          gender?: string | null
          id?: string
          name?: string
          reminder_settings?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "vaccination_children_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      vaccine_notes: {
        Row: {
          child_id: string
          created_at: string
          id: string
          note: string
          vaccine_id: string
        }
        Insert: {
          child_id: string
          created_at?: string
          id?: string
          note: string
          vaccine_id: string
        }
        Update: {
          child_id?: string
          created_at?: string
          id?: string
          note?: string
          vaccine_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vaccine_notes_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "vaccination_children"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_maintenance: {
        Row: {
          date: string | null
          id: string
          label: string | null
          mileage_at_service: number | null
          next_date: string | null
          next_mileage: number | null
          notes: string | null
          type: string
          vehicle_id: string
        }
        Insert: {
          date?: string | null
          id?: string
          label?: string | null
          mileage_at_service?: number | null
          next_date?: string | null
          next_mileage?: number | null
          notes?: string | null
          type: string
          vehicle_id: string
        }
        Update: {
          date?: string | null
          id?: string
          label?: string | null
          mileage_at_service?: number | null
          next_date?: string | null
          next_mileage?: number | null
          notes?: string | null
          type?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_maintenance_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          color: string | null
          created_at: string
          created_by: string
          family_id: string
          id: string
          manufacturer: string | null
          mileage: number | null
          mileage_unit: string | null
          model: string | null
          plate_number: string | null
          shared_with: string[] | null
          year: number | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          created_by: string
          family_id: string
          id?: string
          manufacturer?: string | null
          mileage?: number | null
          mileage_unit?: string | null
          model?: string | null
          plate_number?: string | null
          shared_with?: string[] | null
          year?: number | null
        }
        Update: {
          color?: string | null
          created_at?: string
          created_by?: string
          family_id?: string
          id?: string
          manufacturer?: string | null
          mileage?: number | null
          mileage_unit?: string | null
          model?: string | null
          plate_number?: string | null
          shared_with?: string[] | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      will_open_requests: {
        Row: {
          approvals: Json
          created_at: string
          id: string
          reason: string | null
          requested_by: string
          required_approvals: number
          status: string | null
          will_id: string
        }
        Insert: {
          approvals?: Json
          created_at?: string
          id?: string
          reason?: string | null
          requested_by: string
          required_approvals?: number
          status?: string | null
          will_id: string
        }
        Update: {
          approvals?: Json
          created_at?: string
          id?: string
          reason?: string | null
          requested_by?: string
          required_approvals?: number
          status?: string | null
          will_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "will_open_requests_will_id_fkey"
            columns: ["will_id"]
            isOneToOne: false
            referencedRelation: "wills"
            referencedColumns: ["id"]
          },
        ]
      }
      wills: {
        Row: {
          created_at: string
          id: string
          is_locked: boolean
          password_hash: string | null
          sections: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_locked?: boolean
          password_hash?: string | null
          sections?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_locked?: boolean
          password_hash?: string | null
          sections?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      zakat_assets: {
        Row: {
          amount: number
          created_at: string
          currency: string | null
          id: string
          name: string
          purchase_date: string | null
          reminder: boolean | null
          type: string
          user_id: string
          weight_grams: number | null
          zakat_paid_at: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          currency?: string | null
          id?: string
          name: string
          purchase_date?: string | null
          reminder?: boolean | null
          type: string
          user_id: string
          weight_grams?: number | null
          zakat_paid_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string | null
          id?: string
          name?: string
          purchase_date?: string | null
          reminder?: boolean | null
          type?: string
          user_id?: string
          weight_grams?: number | null
          zakat_paid_at?: string | null
        }
        Relationships: []
      }
      zakat_history: {
        Row: {
          amount_paid: number
          asset_id: string
          id: string
          notes: string | null
          paid_at: string
        }
        Insert: {
          amount_paid: number
          asset_id: string
          id?: string
          notes?: string | null
          paid_at?: string
        }
        Update: {
          amount_paid?: number
          asset_id?: string
          id?: string
          notes?: string | null
          paid_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "zakat_history_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "zakat_assets"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_family_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_family_admin: {
        Args: { _family_id: string; _user_id: string }
        Returns: boolean
      }
      is_family_member: {
        Args: { _family_id: string; _user_id: string }
        Returns: boolean
      }
      is_staff_member: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      family_role:
        | "father"
        | "mother"
        | "husband"
        | "wife"
        | "son"
        | "daughter"
        | "worker"
        | "maid"
        | "driver"
      subscription_plan: "free" | "monthly" | "yearly" | "family"
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
      app_role: ["admin", "moderator", "user"],
      family_role: [
        "father",
        "mother",
        "husband",
        "wife",
        "son",
        "daughter",
        "worker",
        "maid",
        "driver",
      ],
      subscription_plan: ["free", "monthly", "yearly", "family"],
    },
  },
} as const
