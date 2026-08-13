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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          metadata: Json
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      affiliate_commissions: {
        Row: {
          cancelled_at: string | null
          click_reference: string | null
          commission_amount_cents: number
          confirmed_at: string | null
          created_at: string
          currency: string
          event_id: string | null
          external_id: string
          id: string
          item_id: string | null
          merchant_id: string | null
          network: string
          occurred_at: string
          order_amount_cents: number | null
          order_reference: string | null
          registry_id: string | null
          status: Database["public"]["Enums"]["affiliate_commission_status"]
          updated_at: string
        }
        Insert: {
          cancelled_at?: string | null
          click_reference?: string | null
          commission_amount_cents: number
          confirmed_at?: string | null
          created_at?: string
          currency?: string
          event_id?: string | null
          external_id: string
          id?: string
          item_id?: string | null
          merchant_id?: string | null
          network: string
          occurred_at?: string
          order_amount_cents?: number | null
          order_reference?: string | null
          registry_id?: string | null
          status?: Database["public"]["Enums"]["affiliate_commission_status"]
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          click_reference?: string | null
          commission_amount_cents?: number
          confirmed_at?: string | null
          created_at?: string
          currency?: string
          event_id?: string | null
          external_id?: string
          id?: string
          item_id?: string | null
          merchant_id?: string | null
          network?: string
          occurred_at?: string
          order_amount_cents?: number | null
          order_reference?: string | null
          registry_id?: string | null
          status?: Database["public"]["Enums"]["affiliate_commission_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_commissions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "affiliate_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_commissions_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_commissions_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_commissions_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_commissions_registry_id_fkey"
            columns: ["registry_id"]
            isOneToOne: false
            referencedRelation: "registries"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_events: {
        Row: {
          created_at: string
          external_id: string
          id: string
          network: string
          payload: Json
          processed_at: string | null
        }
        Insert: {
          created_at?: string
          external_id: string
          id?: string
          network: string
          payload?: Json
          processed_at?: string | null
        }
        Update: {
          created_at?: string
          external_id?: string
          id?: string
          network?: string
          payload?: Json
          processed_at?: string | null
        }
        Relationships: []
      }
      click_events: {
        Row: {
          affiliate: boolean
          click_type: string
          country: string | null
          created_at: string
          id: string
          item_id: string | null
          merchant_id: string | null
          registry_id: string | null
        }
        Insert: {
          affiliate?: boolean
          click_type?: string
          country?: string | null
          created_at?: string
          id?: string
          item_id?: string | null
          merchant_id?: string | null
          registry_id?: string | null
        }
        Update: {
          affiliate?: boolean
          click_type?: string
          country?: string | null
          created_at?: string
          id?: string
          item_id?: string | null
          merchant_id?: string | null
          registry_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "click_events_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "click_events_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "click_events_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "click_events_registry_id_fkey"
            columns: ["registry_id"]
            isOneToOne: false
            referencedRelation: "registries"
            referencedColumns: ["id"]
          },
        ]
      }
      contribution_goals: {
        Row: {
          collected_amount: number
          created_at: string
          currency: string
          id: string
          item_id: string | null
          provider: string | null
          provider_ref: string | null
          registry_id: string
          target_amount: number | null
          title: string
          updated_at: string
        }
        Insert: {
          collected_amount?: number
          created_at?: string
          currency?: string
          id?: string
          item_id?: string | null
          provider?: string | null
          provider_ref?: string | null
          registry_id: string
          target_amount?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          collected_amount?: number
          created_at?: string
          currency?: string
          id?: string
          item_id?: string | null
          provider?: string | null
          provider_ref?: string | null
          registry_id?: string
          target_amount?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contribution_goals_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contribution_goals_registry_id_fkey"
            columns: ["registry_id"]
            isOneToOne: false
            referencedRelation: "registries"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          created_at: string
          description: string | null
          enabled: boolean
          key: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          key: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          key?: string
          updated_at?: string
        }
        Relationships: []
      }
      items: {
        Row: {
          contribution_collected: number
          contribution_target: number | null
          created_at: string
          currency: string
          description: string | null
          hidden_by_moderator: boolean
          id: string
          image_url: string | null
          kind: Database["public"]["Enums"]["item_kind"]
          merchant_id: string | null
          position: number
          price: number | null
          public_token: string
          quantity: number
          registry_id: string
          reserved_qty: number
          status: Database["public"]["Enums"]["item_status"]
          store_name: string | null
          title: string
          updated_at: string
          url: string | null
        }
        Insert: {
          contribution_collected?: number
          contribution_target?: number | null
          created_at?: string
          currency?: string
          description?: string | null
          hidden_by_moderator?: boolean
          id?: string
          image_url?: string | null
          kind?: Database["public"]["Enums"]["item_kind"]
          merchant_id?: string | null
          position?: number
          price?: number | null
          public_token?: string
          quantity?: number
          registry_id: string
          reserved_qty?: number
          status?: Database["public"]["Enums"]["item_status"]
          store_name?: string | null
          title: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          contribution_collected?: number
          contribution_target?: number | null
          created_at?: string
          currency?: string
          description?: string | null
          hidden_by_moderator?: boolean
          id?: string
          image_url?: string | null
          kind?: Database["public"]["Enums"]["item_kind"]
          merchant_id?: string | null
          position?: number
          price?: number | null
          public_token?: string
          quantity?: number
          registry_id?: string
          reserved_qty?: number
          status?: Database["public"]["Enums"]["item_status"]
          store_name?: string | null
          title?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "items_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_registry_id_fkey"
            columns: ["registry_id"]
            isOneToOne: false
            referencedRelation: "registries"
            referencedColumns: ["id"]
          },
        ]
      }
      list_entitlements: {
        Row: {
          created_at: string
          expires_at: string | null
          features: Json
          granted_at: string
          plan: string
          registry_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          features?: Json
          granted_at?: string
          plan?: string
          registry_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          features?: Json
          granted_at?: string
          plan?: string
          registry_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "list_entitlements_registry_id_fkey"
            columns: ["registry_id"]
            isOneToOne: true
            referencedRelation: "registries"
            referencedColumns: ["id"]
          },
        ]
      }
      list_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          registry_id: string
          role: Database["public"]["Enums"]["member_role"]
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          registry_id: string
          role?: Database["public"]["Enums"]["member_role"]
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          registry_id?: string
          role?: Database["public"]["Enums"]["member_role"]
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "list_invitations_registry_id_fkey"
            columns: ["registry_id"]
            isOneToOne: false
            referencedRelation: "registries"
            referencedColumns: ["id"]
          },
        ]
      }
      list_members: {
        Row: {
          created_at: string
          id: string
          registry_id: string
          role: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          registry_id: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          registry_id?: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "list_members_registry_id_fkey"
            columns: ["registry_id"]
            isOneToOne: false
            referencedRelation: "registries"
            referencedColumns: ["id"]
          },
        ]
      }
      merchants: {
        Row: {
          affiliate_enabled: boolean
          affiliate_id: string | null
          affiliate_network: string | null
          affiliate_template: string | null
          api_config: Json
          api_endpoint: string | null
          api_key: string | null
          created_at: string
          domains: string[]
          enabled: boolean
          id: string
          link_mode: string
          logo_url: string | null
          name: string
          reward_enabled: boolean
          reward_share_rate_bps: number | null
          updated_at: string
        }
        Insert: {
          affiliate_enabled?: boolean
          affiliate_id?: string | null
          affiliate_network?: string | null
          affiliate_template?: string | null
          api_config?: Json
          api_endpoint?: string | null
          api_key?: string | null
          created_at?: string
          domains?: string[]
          enabled?: boolean
          id?: string
          link_mode?: string
          logo_url?: string | null
          name: string
          reward_enabled?: boolean
          reward_share_rate_bps?: number | null
          updated_at?: string
        }
        Update: {
          affiliate_enabled?: boolean
          affiliate_id?: string | null
          affiliate_network?: string | null
          affiliate_template?: string | null
          api_config?: Json
          api_endpoint?: string | null
          api_key?: string | null
          created_at?: string
          domains?: string[]
          enabled?: boolean
          id?: string
          link_mode?: string
          logo_url?: string | null
          name?: string
          reward_enabled?: boolean
          reward_share_rate_bps?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          read_at: string | null
          registry_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          read_at?: string | null
          registry_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          read_at?: string | null
          registry_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_registry_id_fkey"
            columns: ["registry_id"]
            isOneToOne: false
            referencedRelation: "registries"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_campaigns: {
        Row: {
          active: boolean
          bonus_amount_cents: number
          campaign_name: string
          conditions: string | null
          created_at: string
          currency: string
          description: string | null
          ends_at: string | null
          id: string
          partner_name: string
          starts_at: string | null
          updated_at: string
          usage_count: number
          usage_limit: number | null
          visible: boolean
        }
        Insert: {
          active?: boolean
          bonus_amount_cents: number
          campaign_name: string
          conditions?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          partner_name: string
          starts_at?: string | null
          updated_at?: string
          usage_count?: number
          usage_limit?: number | null
          visible?: boolean
        }
        Update: {
          active?: boolean
          bonus_amount_cents?: number
          campaign_name?: string
          conditions?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          partner_name?: string
          starts_at?: string | null
          updated_at?: string
          usage_count?: number
          usage_limit?: number | null
          visible?: boolean
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          onboarding_completed: boolean
          referral_code: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          onboarding_completed?: boolean
          referral_code?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          onboarding_completed?: boolean
          referral_code?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          cancelled_at: string | null
          code: string
          created_at: string
          id: string
          needs_review: boolean
          qualified_at: string | null
          referred_user_id: string
          referrer_user_id: string
          rewarded_at: string | null
          risk_signals: Json
          status: Database["public"]["Enums"]["referral_status"]
          updated_at: string
        }
        Insert: {
          cancelled_at?: string | null
          code: string
          created_at?: string
          id?: string
          needs_review?: boolean
          qualified_at?: string | null
          referred_user_id: string
          referrer_user_id: string
          rewarded_at?: string | null
          risk_signals?: Json
          status?: Database["public"]["Enums"]["referral_status"]
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          code?: string
          created_at?: string
          id?: string
          needs_review?: boolean
          qualified_at?: string | null
          referred_user_id?: string
          referrer_user_id?: string
          rewarded_at?: string | null
          risk_signals?: Json
          status?: Database["public"]["Enums"]["referral_status"]
          updated_at?: string
        }
        Relationships: []
      }
      registries: {
        Row: {
          accent_color: string | null
          access_code_hash: string | null
          allow_indexing: boolean
          baby_name: string | null
          cover_image_url: string | null
          created_at: string
          description: string | null
          due_date: string | null
          font_pair: string
          hero_style: string
          id: string
          is_demo: boolean
          is_public: boolean
          layout: string
          owner_id: string
          reserved_display: string
          show_progress: boolean
          slug: string
          status: Database["public"]["Enums"]["list_status"]
          surprise_mode: boolean
          surprises_revealed_at: string | null
          theme: string
          title: string
          type: Database["public"]["Enums"]["list_type"]
          updated_at: string
          view_count: number
          visibility: Database["public"]["Enums"]["list_visibility"]
          welcome_message: string | null
        }
        Insert: {
          accent_color?: string | null
          access_code_hash?: string | null
          allow_indexing?: boolean
          baby_name?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          font_pair?: string
          hero_style?: string
          id?: string
          is_demo?: boolean
          is_public?: boolean
          layout?: string
          owner_id: string
          reserved_display?: string
          show_progress?: boolean
          slug: string
          status?: Database["public"]["Enums"]["list_status"]
          surprise_mode?: boolean
          surprises_revealed_at?: string | null
          theme?: string
          title: string
          type?: Database["public"]["Enums"]["list_type"]
          updated_at?: string
          view_count?: number
          visibility?: Database["public"]["Enums"]["list_visibility"]
          welcome_message?: string | null
        }
        Update: {
          accent_color?: string | null
          access_code_hash?: string | null
          allow_indexing?: boolean
          baby_name?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          font_pair?: string
          hero_style?: string
          id?: string
          is_demo?: boolean
          is_public?: boolean
          layout?: string
          owner_id?: string
          reserved_display?: string
          show_progress?: boolean
          slug?: string
          status?: Database["public"]["Enums"]["list_status"]
          surprise_mode?: boolean
          surprises_revealed_at?: string | null
          theme?: string
          title?: string
          type?: Database["public"]["Enums"]["list_type"]
          updated_at?: string
          view_count?: number
          visibility?: Database["public"]["Enums"]["list_visibility"]
          welcome_message?: string | null
        }
        Relationships: []
      }
      reports: {
        Row: {
          admin_notes: string | null
          created_at: string
          details: string | null
          id: string
          reason: string
          reporter_id: string | null
          status: Database["public"]["Enums"]["report_status"]
          target_id: string
          target_type: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          details?: string | null
          id?: string
          reason: string
          reporter_id?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          target_id: string
          target_type: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          details?: string | null
          id?: string
          reason?: string
          reporter_id?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          target_id?: string
          target_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      reservations: {
        Row: {
          cancelled_at: string | null
          created_at: string
          guest_email: string | null
          guest_name: string
          id: string
          intent: string
          item_id: string
          message: string | null
          purchased_at: string | null
          quantity: number
          registry_id: string
          revealed_at: string | null
          status: Database["public"]["Enums"]["reservation_status"]
          token_expires_at: string
          token_hash: string | null
          user_id: string | null
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          guest_email?: string | null
          guest_name: string
          id?: string
          intent?: string
          item_id: string
          message?: string | null
          purchased_at?: string | null
          quantity?: number
          registry_id: string
          revealed_at?: string | null
          status?: Database["public"]["Enums"]["reservation_status"]
          token_expires_at?: string
          token_hash?: string | null
          user_id?: string | null
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          guest_email?: string | null
          guest_name?: string
          id?: string
          intent?: string
          item_id?: string
          message?: string | null
          purchased_at?: string | null
          quantity?: number
          registry_id?: string
          revealed_at?: string | null
          status?: Database["public"]["Enums"]["reservation_status"]
          token_expires_at?: string
          token_hash?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reservations_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_registry_id_fkey"
            columns: ["registry_id"]
            isOneToOne: false
            referencedRelation: "registries"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_offers: {
        Row: {
          active: boolean
          cost_cents: number
          created_at: string
          currency: string
          description: string | null
          id: string
          image_url: string | null
          partner_campaign_id: string | null
          stock: number | null
          title: string
          type: Database["public"]["Enums"]["redemption_type"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          cost_cents: number
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          image_url?: string | null
          partner_campaign_id?: string | null
          stock?: number | null
          title: string
          type?: Database["public"]["Enums"]["redemption_type"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          cost_cents?: number
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          image_url?: string | null
          partner_campaign_id?: string | null
          stock?: number | null
          title?: string
          type?: Database["public"]["Enums"]["redemption_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reward_offers_partner_campaign_id_fkey"
            columns: ["partner_campaign_id"]
            isOneToOne: false
            referencedRelation: "partner_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_redemptions: {
        Row: {
          amount_cents: number
          cancelled_at: string | null
          currency: string
          external_reference: string | null
          id: string
          metadata: Json
          offer_id: string | null
          processed_at: string | null
          provider: string | null
          requested_at: string
          requested_by: string | null
          status: Database["public"]["Enums"]["redemption_status"]
          transaction_id: string | null
          type: Database["public"]["Enums"]["redemption_type"]
          wallet_id: string
        }
        Insert: {
          amount_cents: number
          cancelled_at?: string | null
          currency?: string
          external_reference?: string | null
          id?: string
          metadata?: Json
          offer_id?: string | null
          processed_at?: string | null
          provider?: string | null
          requested_at?: string
          requested_by?: string | null
          status?: Database["public"]["Enums"]["redemption_status"]
          transaction_id?: string | null
          type: Database["public"]["Enums"]["redemption_type"]
          wallet_id: string
        }
        Update: {
          amount_cents?: number
          cancelled_at?: string | null
          currency?: string
          external_reference?: string | null
          id?: string
          metadata?: Json
          offer_id?: string | null
          processed_at?: string | null
          provider?: string | null
          requested_at?: string
          requested_by?: string | null
          status?: Database["public"]["Enums"]["redemption_status"]
          transaction_id?: string | null
          type?: Database["public"]["Enums"]["redemption_type"]
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reward_redemptions_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "reward_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_redemptions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "reward_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_settings: {
        Row: {
          affiliate_rewards_enabled: boolean
          affiliate_share_rate_bps: number
          anti_fraud_rules: Json
          bank_payout_enabled: boolean
          created_at: string
          currency: string
          enabled: boolean
          expiry_days: number | null
          explainer_text: string
          id: boolean
          lifetime_cap_cents_per_list: number | null
          marketplace_enabled: boolean
          min_redemption_cents: number
          monthly_cap_cents_per_list: number | null
          partner_rewards_enabled: boolean
          per_transaction_cap_cents: number | null
          premium_bonus_cents: number
          premium_rewards_enabled: boolean
          promotional_cap_cents: number | null
          promotional_rewards_enabled: boolean
          redemption_enabled: boolean
          referral_bonus_cents: number
          referral_cap_cents: number | null
          referral_min_items: number
          referral_requires_list: boolean
          referral_requires_verified_email: boolean
          referral_rewards_enabled: boolean
          updated_at: string
          validation_rules: Json
        }
        Insert: {
          affiliate_rewards_enabled?: boolean
          affiliate_share_rate_bps?: number
          anti_fraud_rules?: Json
          bank_payout_enabled?: boolean
          created_at?: string
          currency?: string
          enabled?: boolean
          expiry_days?: number | null
          explainer_text?: string
          id?: boolean
          lifetime_cap_cents_per_list?: number | null
          marketplace_enabled?: boolean
          min_redemption_cents?: number
          monthly_cap_cents_per_list?: number | null
          partner_rewards_enabled?: boolean
          per_transaction_cap_cents?: number | null
          premium_bonus_cents?: number
          premium_rewards_enabled?: boolean
          promotional_cap_cents?: number | null
          promotional_rewards_enabled?: boolean
          redemption_enabled?: boolean
          referral_bonus_cents?: number
          referral_cap_cents?: number | null
          referral_min_items?: number
          referral_requires_list?: boolean
          referral_requires_verified_email?: boolean
          referral_rewards_enabled?: boolean
          updated_at?: string
          validation_rules?: Json
        }
        Update: {
          affiliate_rewards_enabled?: boolean
          affiliate_share_rate_bps?: number
          anti_fraud_rules?: Json
          bank_payout_enabled?: boolean
          created_at?: string
          currency?: string
          enabled?: boolean
          expiry_days?: number | null
          explainer_text?: string
          id?: boolean
          lifetime_cap_cents_per_list?: number | null
          marketplace_enabled?: boolean
          min_redemption_cents?: number
          monthly_cap_cents_per_list?: number | null
          partner_rewards_enabled?: boolean
          per_transaction_cap_cents?: number | null
          premium_bonus_cents?: number
          premium_rewards_enabled?: boolean
          promotional_cap_cents?: number | null
          promotional_rewards_enabled?: boolean
          redemption_enabled?: boolean
          referral_bonus_cents?: number
          referral_cap_cents?: number | null
          referral_min_items?: number
          referral_requires_list?: boolean
          referral_requires_verified_email?: boolean
          referral_rewards_enabled?: boolean
          updated_at?: string
          validation_rules?: Json
        }
        Relationships: []
      }
      reward_transactions: {
        Row: {
          amount_cents: number
          cancelled_at: string | null
          confirmed_at: string | null
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          expires_at: string | null
          id: string
          merchant_id: string | null
          metadata: Json
          source_id: string | null
          source_reference: string | null
          source_type: string | null
          status: Database["public"]["Enums"]["reward_txn_status"]
          type: Database["public"]["Enums"]["reward_txn_type"]
          wallet_id: string
        }
        Insert: {
          amount_cents: number
          cancelled_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          merchant_id?: string | null
          metadata?: Json
          source_id?: string | null
          source_reference?: string | null
          source_type?: string | null
          status?: Database["public"]["Enums"]["reward_txn_status"]
          type: Database["public"]["Enums"]["reward_txn_type"]
          wallet_id: string
        }
        Update: {
          amount_cents?: number
          cancelled_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          merchant_id?: string | null
          metadata?: Json
          source_id?: string | null
          source_reference?: string | null
          source_type?: string | null
          status?: Database["public"]["Enums"]["reward_txn_status"]
          type?: Database["public"]["Enums"]["reward_txn_type"]
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reward_transactions_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_transactions_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "reward_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_wallets: {
        Row: {
          available_balance_cents: number
          created_at: string
          currency: string
          flagged: boolean
          id: string
          lifetime_earned_cents: number
          lifetime_redeemed_cents: number
          pending_balance_cents: number
          registry_id: string
          updated_at: string
        }
        Insert: {
          available_balance_cents?: number
          created_at?: string
          currency?: string
          flagged?: boolean
          id?: string
          lifetime_earned_cents?: number
          lifetime_redeemed_cents?: number
          pending_balance_cents?: number
          registry_id: string
          updated_at?: string
        }
        Update: {
          available_balance_cents?: number
          created_at?: string
          currency?: string
          flagged?: boolean
          id?: string
          lifetime_earned_cents?: number
          lifetime_redeemed_cents?: number
          pending_balance_cents?: number
          registry_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reward_wallets_registry_id_fkey"
            columns: ["registry_id"]
            isOneToOne: true
            referencedRelation: "registries"
            referencedColumns: ["id"]
          },
        ]
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
          role?: Database["public"]["Enums"]["app_role"]
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
      merchants_public: {
        Row: {
          affiliate_enabled: boolean | null
          domains: string[] | null
          enabled: boolean | null
          id: string | null
          link_mode: string | null
          logo_url: string | null
          name: string | null
          reward_enabled: boolean | null
        }
        Insert: {
          affiliate_enabled?: boolean | null
          domains?: string[] | null
          enabled?: boolean | null
          id?: string | null
          link_mode?: string | null
          logo_url?: string | null
          name?: string | null
          reward_enabled?: boolean | null
        }
        Update: {
          affiliate_enabled?: boolean | null
          domains?: string[] | null
          enabled?: boolean | null
          id?: string | null
          link_mode?: string | null
          logo_url?: string | null
          name?: string | null
          reward_enabled?: boolean | null
        }
        Relationships: []
      }
    }
    Functions: {
      ensure_reward_wallet: { Args: { _registry_id: string }; Returns: string }
      get_reservation_by_token: {
        Args: { _token: string }
        Returns: {
          created_at: string
          guest_email: string
          guest_name: string
          id: string
          item_currency: string
          item_image_url: string
          item_price: number
          item_title: string
          item_url: string
          message: string
          purchased_at: string
          quantity: number
          registry_slug: string
          registry_title: string
          status: Database["public"]["Enums"]["reservation_status"]
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_list_view: { Args: { _slug: string }; Returns: undefined }
      is_list_member: {
        Args: { _registry_id: string; _user_id: string }
        Returns: boolean
      }
      is_list_owner: {
        Args: { _registry_id: string; _user_id: string }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      recompute_reward_wallet: {
        Args: { _wallet_id: string }
        Returns: undefined
      }
      reserve_item: {
        Args: {
          _guest_email: string
          _guest_name: string
          _intent?: string
          _item_id: string
          _message: string
          _quantity?: number
        }
        Returns: {
          reservation_id: string
          token: string
        }[]
      }
      reward_apply_commission: {
        Args: { _commission_id: string }
        Returns: string
      }
      reward_credit: {
        Args: {
          _amount_cents: number
          _created_by?: string
          _description?: string
          _merchant_id?: string
          _metadata?: Json
          _registry_id: string
          _source_id?: string
          _source_reference: string
          _source_type: string
          _status: Database["public"]["Enums"]["reward_txn_status"]
          _type: Database["public"]["Enums"]["reward_txn_type"]
        }
        Returns: string
      }
      reward_redeem: {
        Args: {
          _amount_cents: number
          _metadata?: Json
          _offer_id?: string
          _registry_id: string
          _type: Database["public"]["Enums"]["redemption_type"]
          _user_id?: string
        }
        Returns: string
      }
      reward_set_status: {
        Args: {
          _source_reference: string
          _source_type: string
          _status: Database["public"]["Enums"]["reward_txn_status"]
        }
        Returns: number
      }
      track_click: {
        Args: {
          _affiliate?: boolean
          _click_type?: string
          _public_token: string
        }
        Returns: undefined
      }
      update_reservation_by_token: {
        Args: { _action: string; _message?: string; _token: string }
        Returns: string
      }
    }
    Enums: {
      affiliate_commission_status: "PENDING" | "CONFIRMED" | "CANCELLED"
      app_role: "USER" | "MODERATOR" | "ADMIN" | "SUPER_ADMIN"
      item_kind: "LINK" | "MANUAL" | "CONTRIBUTION"
      item_status: "AVAILABLE" | "RESERVED" | "PURCHASED"
      list_status: "ACTIVE" | "ARCHIVED" | "SUSPENDED"
      list_type:
        | "BIRTH"
        | "BIRTHDAY"
        | "CHRISTENING"
        | "WEDDING"
        | "CHRISTMAS"
        | "OTHER"
      list_visibility: "PUBLIC" | "UNLISTED" | "PROTECTED"
      member_role: "OWNER" | "CO_OWNER" | "EDITOR"
      redemption_status:
        | "REQUESTED"
        | "APPROVED"
        | "PROCESSED"
        | "REJECTED"
        | "CANCELLED"
      redemption_type:
        | "MILA_CREDIT"
        | "PREMIUM"
        | "PARTNER_VOUCHER"
        | "GIFT_CARD"
        | "BANK_PAYOUT"
      referral_status: "PENDING" | "QUALIFIED" | "REWARDED" | "CANCELLED"
      report_status: "OPEN" | "REVIEWING" | "RESOLVED" | "DISMISSED"
      reservation_status: "RESERVED" | "PURCHASED" | "CANCELLED"
      reward_txn_status: "PENDING" | "CONFIRMED" | "CANCELLED" | "EXPIRED"
      reward_txn_type:
        | "AFFILIATE_COMMISSION"
        | "REFERRAL"
        | "PREMIUM_PURCHASE"
        | "PARTNER_BONUS"
        | "PROMOTIONAL_BONUS"
        | "REDEMPTION"
        | "ADJUSTMENT"
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
      affiliate_commission_status: ["PENDING", "CONFIRMED", "CANCELLED"],
      app_role: ["USER", "MODERATOR", "ADMIN", "SUPER_ADMIN"],
      item_kind: ["LINK", "MANUAL", "CONTRIBUTION"],
      item_status: ["AVAILABLE", "RESERVED", "PURCHASED"],
      list_status: ["ACTIVE", "ARCHIVED", "SUSPENDED"],
      list_type: [
        "BIRTH",
        "BIRTHDAY",
        "CHRISTENING",
        "WEDDING",
        "CHRISTMAS",
        "OTHER",
      ],
      list_visibility: ["PUBLIC", "UNLISTED", "PROTECTED"],
      member_role: ["OWNER", "CO_OWNER", "EDITOR"],
      redemption_status: [
        "REQUESTED",
        "APPROVED",
        "PROCESSED",
        "REJECTED",
        "CANCELLED",
      ],
      redemption_type: [
        "MILA_CREDIT",
        "PREMIUM",
        "PARTNER_VOUCHER",
        "GIFT_CARD",
        "BANK_PAYOUT",
      ],
      referral_status: ["PENDING", "QUALIFIED", "REWARDED", "CANCELLED"],
      report_status: ["OPEN", "REVIEWING", "RESOLVED", "DISMISSED"],
      reservation_status: ["RESERVED", "PURCHASED", "CANCELLED"],
      reward_txn_status: ["PENDING", "CONFIRMED", "CANCELLED", "EXPIRED"],
      reward_txn_type: [
        "AFFILIATE_COMMISSION",
        "REFERRAL",
        "PREMIUM_PURCHASE",
        "PARTNER_BONUS",
        "PROMOTIONAL_BONUS",
        "REDEMPTION",
        "ADJUSTMENT",
      ],
    },
  },
} as const
