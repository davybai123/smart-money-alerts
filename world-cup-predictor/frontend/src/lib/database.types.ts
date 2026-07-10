// Auto-generated types matching 001_initial_schema.sql
// Re-run `supabase gen types typescript` after schema changes

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      teams: {
        Row: {
          id: string;
          fifa_code: string;
          name: string;
          group_letter: string | null;
          flag_url: string | null;
          is_host_nation: boolean;
          elo_rating: number;
          attack_strength: number;
          defence_strength: number;
          form_score: number;
          avg_xg_scored: number | null;
          avg_xg_conceded: number | null;
          api_football_id: number | null;
          created_at: string;
          updated_at: string;
        };
      };
      matches: {
        Row: {
          id: string;
          match_number: number;
          stage: string;
          group_letter: string | null;
          kickoff_utc: string;
          status: string;
          venue: string | null;
          city: string | null;
          country: string | null;
          home_team_id: string;
          away_team_id: string;
          score_home: number | null;
          score_away: number | null;
          score_home_et: number | null;
          score_away_et: number | null;
          score_home_pens: number | null;
          score_away_pens: number | null;
          api_fixture_id: number | null;
          created_at: string;
          updated_at: string;
        };
      };
      match_predictions: {
        Row: {
          id: string;
          match_id: string;
          version: number;
          is_published: boolean;
          is_locked: boolean;
          published_at: string | null;
          prob_home_win: number;
          prob_draw: number;
          prob_away_win: number;
          fair_odds_home: number;
          fair_odds_draw: number;
          fair_odds_away: number;
          expected_goals_home: number;
          expected_goals_away: number;
          prob_over_15: number;
          prob_over_25: number;
          prob_over_35: number;
          prob_btts_yes: number;
          fair_odds_over_25: number;
          fair_odds_under_25: number;
          fair_odds_btts_yes: number;
          fair_odds_btts_no: number;
          confidence_score: number;
          confidence_factors: Json | null;
          key_factors: string[] | null;
          narrative: Json | null;
          home_elo: number;
          away_elo: number;
          lambda_home: number;
          lambda_away: number;
          rho: number;
          created_at: string;
          updated_at: string;
        };
      };
      value_bets: {
        Row: {
          id: string;
          match_id: string;
          prediction_id: string;
          market: string;
          selection: string;
          bookmaker: string;
          decimal_odds: number;
          our_probability: number;
          market_implied_prob: number;
          ev_percentage: number;
          ev_fraction: number;
          kelly_fraction: number;
          half_kelly: number;
          quarter_kelly: number;
          recommended_fraction: number;
          confidence_score: number;
          is_active: boolean;
          refreshed_at: string;
          created_at: string;
        };
      };
      bookmaker_odds: {
        Row: {
          id: string;
          match_id: string;
          bookmaker: string;
          market: string;
          selection: string;
          decimal_odds: number;
          line: number | null;
          fetched_at: string;
          created_at: string;
        };
      };
      tournament_simulation: {
        Row: {
          id: string;
          team_id: string;
          iterations: number;
          prob_group_advance: number;
          prob_r16: number;
          prob_qf: number;
          prob_sf: number;
          prob_final: number;
          prob_winner: number;
          avg_group_position: number;
          simulated_at: string;
          created_at: string;
        };
      };
      saved_bets: {
        Row: {
          id: string;
          user_id: string;
          match_id: string;
          market: string;
          selection: string;
          decimal_odds: number;
          stake: number;
          bookmaker: string | null;
          outcome: string;
          actual_return: number | null;
          settled_at: string | null;
          notes: string | null;
          created_at: string;
        };
      };
    };
    Views: {
      v_active_value_bets: {
        Row: {
          id: string;
          match_id: string;
          market: string;
          selection: string;
          bookmaker: string;
          decimal_odds: number;
          our_probability: number;
          ev_percentage: number;
          recommended_fraction: number;
          confidence_score: number;
          refreshed_at: string;
        };
      };
    };
  };
}

// Convenience types
export type Team             = Database['public']['Tables']['teams']['Row'];
export type Match            = Database['public']['Tables']['matches']['Row'];
export type Prediction       = Database['public']['Tables']['match_predictions']['Row'];
export type ValueBet         = Database['public']['Tables']['value_bets']['Row'];
export type BookmakerOdds    = Database['public']['Tables']['bookmaker_odds']['Row'];
export type TournamentSim    = Database['public']['Tables']['tournament_simulation']['Row'];
export type SavedBet         = Database['public']['Tables']['saved_bets']['Row'];

// Enriched types used by the UI
export interface MatchWithTeams extends Match {
  home_team: Team;
  away_team: Team;
  prediction?: Prediction | null;
  top_value_bet?: ValueBet | null;
}

export interface MatchAnalysis {
  match: {
    id: string;
    match_number: number;
    stage: string;
    group: string | null;
    kickoff_utc: string;
    status: string;
    venue: string | null;
    city: string | null;
    country: string | null;
    score: string | null;
    home_team: Team;
    away_team: Team;
  };
  prediction: {
    id: string;
    version: number;
    is_locked: boolean;
    published_at: string | null;
    markets: {
      '1x2': {
        home: MarketDetail;
        draw: MarketDetail;
        away: MarketDetail;
      };
      goals: {
        expected_home: number;
        expected_away: number;
        prob_over_15: number;
        prob_over_25: number;
        prob_over_35: number;
        fair_odds_over_25: number;
        fair_odds_under_25: number;
      };
      btts: {
        prob_yes: number;
        prob_no: number;
        fair_odds_yes: number;
        fair_odds_no: number;
      };
    };
    confidence: {
      score: number;
      factors: Record<string, number>;
      label: string;
    };
    model_inputs: {
      home_elo: number;
      away_elo: number;
      lambda_home: number;
      lambda_away: number;
      rho: number;
    };
    key_factors: string[];
  } | null;
  value_bets: ValueBetDisplay[];
  best_odds: Record<string, Record<string, { odds: number; bookmaker: string }>>;
  odds_count: number;
}

export interface MarketDetail {
  probability: number;
  fair_odds: number;
  best_book_odds: number | null;
  best_bookmaker: string | null;
}

export interface ValueBetDisplay {
  market: string;
  selection: string;
  bookmaker: string;
  odds: number;
  our_prob: number;
  implied_prob: number;
  ev_pct: number;
  ev_label: string;
  recommended_fraction: number;
  recommended_pct: number;
}
