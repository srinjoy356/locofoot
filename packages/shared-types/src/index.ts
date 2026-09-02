export enum PlatformRole {
  USER = 'USER',
  PLATFORM_ADMIN = 'PLATFORM_ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN'
}

export enum AccountStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  BANNED = 'BANNED',
  DELETED = 'DELETED'
}

export enum DmPermission {
  EVERYONE = 'EVERYONE',
  FRIENDS = 'FRIENDS',
  NONE = 'NONE'
}

export enum MediaOwnerType {
  USER_AVATAR = 'USER_AVATAR',
  TEAM_LOGO = 'TEAM_LOGO',
  EVENT_BANNER = 'EVENT_BANNER',
  EVENT_LOGO = 'EVENT_LOGO',
  MATCH_PHOTO = 'MATCH_PHOTO',
  MATCH_VIDEO = 'MATCH_VIDEO',
  CERTIFICATE = 'CERTIFICATE',
  MESSAGE_ATTACHMENT = 'MESSAGE_ATTACHMENT'
}

export enum MediaResourceType {
  IMAGE = 'image',
  VIDEO = 'video',
  RAW = 'raw'
}

export interface MediaAsset {
  id: string;
  owner_type: MediaOwnerType;
  owner_id: string;
  cloudinary_public_id: string;
  secure_url: string;
  resource_type: MediaResourceType;
  width: number | null;
  height: number | null;
  format: string | null;
  bytes: number | null;
  uploaded_by: string;
  tags: string[] | null;
  created_at: string;
}

export interface User {
  id: string;
  unique_code: string | null;
  username: string | null;
  display_name: string | null;
  avatar_media_id: string | null;
  date_of_birth: string | null;
  gender: string | null;
  phone: string | null;
  email: string;
  preferred_position: string | null;
  strong_foot: string | null;
  bio: string | null;
  location_text: string | null;
  platform_role: PlatformRole;
  account_status: AccountStatus;
  email_verified: boolean;
  phone_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserPrivacySettings {
  user_id: string;
  profile_public: boolean;
  stats_public: boolean;
  friends_visible: boolean;
  teams_visible: boolean;
  match_history_public: boolean;
  dm_permission: DmPermission;
  created_at: string;
  updated_at: string;
}

export enum FriendshipStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
  BLOCKED = 'BLOCKED'
}

export enum NotificationType {
  TEAM_REGISTRATION_APPROVED = 'TEAM_REGISTRATION_APPROVED',
  PLAYER_INVITED = 'PLAYER_INVITED',
  PLAYER_ACCEPTED = 'PLAYER_ACCEPTED',
  ROSTER_INCOMPLETE = 'ROSTER_INCOMPLETE',
  MATCH_SCHEDULED = 'MATCH_SCHEDULED',
  MATCH_CHANGED = 'MATCH_CHANGED',
  MATCH_STARTING_SOON = 'MATCH_STARTING_SOON',
  REFEREE_ASSIGNED = 'REFEREE_ASSIGNED',
  REFEREE_ACCEPTED = 'REFEREE_ACCEPTED',
  MATCH_STARTED = 'MATCH_STARTED',
  MATCH_ENDED = 'MATCH_ENDED',
  TOURNAMENT_COMPLETED = 'TOURNAMENT_COMPLETED',
  FRIEND_REQUEST = 'FRIEND_REQUEST',
  FRIEND_ACCEPTED = 'FRIEND_ACCEPTED',
  DM_RECEIVED = 'DM_RECEIVED'
}

export interface Friendship {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: FriendshipStatus;
  created_at: string;
  updated_at: string;
}

export interface Block {
  id: string;
  blocker_id: string;
  blocked_id: string;
  created_at: string;
}

export interface Conversation {
  id: string;
  is_group: boolean;
  created_at: string;
  updated_at: string;
}

export interface ConversationMember {
  conversation_id: string;
  user_id: string;
  joined_at: string;
  last_read_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  media_id: string | null;
  created_at: string;
  deleted_at: string | null;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  payload: any;
  read_at: string | null;
  created_at: string;
}

export enum EventStatus {
  DRAFT = 'DRAFT',
  REGISTRATION_OPEN = 'REGISTRATION_OPEN',
  REGISTRATION_CLOSED = 'REGISTRATION_CLOSED',
  SCHEDULING = 'SCHEDULING',
  SCHEDULED = 'SCHEDULED',
  LIVE = 'LIVE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  ARCHIVED = 'ARCHIVED'
}

export enum EventRole {
  EVENT_OWNER = 'EVENT_OWNER',
  EVENT_ADMIN = 'EVENT_ADMIN',
  EVENT_MANAGER = 'EVENT_MANAGER',
  REFEREE = 'REFEREE',
  SCORER = 'SCORER',
  VOLUNTEER = 'VOLUNTEER',
  VIEWER = 'VIEWER'
}

export enum TournamentFormat {
  ROUND_ROBIN = 'ROUND_ROBIN',
  DOUBLE_ROUND_ROBIN = 'DOUBLE_ROUND_ROBIN',
  KNOCKOUT = 'KNOCKOUT',
  GROUP_KNOCKOUT = 'GROUP_KNOCKOUT',
  SWISS = 'SWISS',
  CUSTOM = 'CUSTOM'
}

export enum StatCategory {
  OFFENSIVE = 'OFFENSIVE',
  DEFENSIVE = 'DEFENSIVE',
  GOALKEEPER = 'GOALKEEPER',
  DISCIPLINE = 'DISCIPLINE',
  MISC = 'MISC'
}

export enum TeamMemberRole {
  CAPTAIN = 'CAPTAIN',
  VICE_CAPTAIN = 'VICE_CAPTAIN',
  PLAYER = 'PLAYER',
  COACH_MANAGER = 'COACH_MANAGER'
}

export enum TeamMemberStatus {
  INVITED = 'INVITED',
  ACCEPTED = 'ACCEPTED',
  DECLINED = 'DECLINED',
  REMOVED = 'REMOVED',
  LEFT = 'LEFT'
}

export enum RegistrationStatus {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  WITHDRAWN = 'WITHDRAWN'
}

export enum PlayerEligibilityStatus {
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  SUSPENDED = 'SUSPENDED',
  REMOVED = 'REMOVED'
}

export interface Venue {
  id: string;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface VenueField {
  id: string;
  venue_id: string;
  name: string;
  surface_type: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export enum SlotStructureState {
  DRAFT = 'DRAFT',
  FINALIZED = 'FINALIZED'
}

export enum SchedulingState {
  NOT_STARTED = 'NOT_STARTED',
  LIVE = 'LIVE',
  COMPLETED = 'COMPLETED'
}

export interface Event {
  id: string;
  event_code: string | null;
  slug: string | null;
  name: string;
  description: string;
  logo_media_id: string | null;
  banner_media_id: string | null;
  organizer_id: string;
  venue_id: string | null;
  start_date: string | null;
  end_date: string | null;
  registration_deadline: string | null;
  status: EventStatus;
  public_token: string | null;
  slot_structure_state: SlotStructureState;
  scheduling_state: SchedulingState;
  created_at: string;
  updated_at: string;
}

export interface EventSettings {
  event_id: string;
  players_on_field: number;
  substitutes_allowed: number;
  min_squad: number;
  max_squad: number;
  first_half_minutes: number;
  second_half_minutes: number;
  half_time_minutes: number;
  extra_time_allowed: boolean;
  extra_time_minutes: number | null;
  penalty_shootout_allowed: boolean;
  max_substitutions: number;
  rolling_subs: boolean;
  injury_time_tracking: boolean;
  buffer_minutes: number;
  min_rest_minutes: number;
  points_win: number;
  points_draw: number;
  points_loss: number;
  fair_play_affects_ranking: boolean;
  fair_play_as_tiebreak: boolean;
  tie_break_order: any;
  tournament_format: TournamentFormat;
  allow_duplicate_jersey_numbers: boolean;
}

export interface EventRoleAssignment {
  id: string;
  event_id: string;
  user_id: string;
  role: EventRole;
  granted_by: string | null;
  created_at: string;
}

export interface EventStatDefinition {
  id: string;
  event_id: string;
  stat_key: string;
  label: string;
  category: StatCategory;
  points_value: number;
  affects_fair_play: boolean;
  fair_play_delta: number;
}

export interface EventDisciplinaryRules {
  event_id: string;
  second_yellow_triggers_red: boolean;
  red_suspension_matches: number;
  accumulated_yellow_threshold: number;
  accumulated_yellow_suspension_matches: number;
}

export interface EventTeamRegistration {
  id: string;
  event_id: string;
  team_name: string;
  team_short_name: string | null;
  logo_media_id: string | null;
  captain_id: string;
  group_id: string | null;
  status: RegistrationStatus;
  seed: number | null;
  roster_locked: boolean;
  registered_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  points: number;
  fair_play_points: number;
  created_at: string;
  updated_at: string;
}

export interface EventTeamPlayer {
  id: string;
  event_registration_id: string;
  user_id: string;
  jersey_number: number | null;
  position: string | null;
  status: PlayerEligibilityStatus;
  is_captain_for_event: boolean;
  is_vice_captain_for_event: boolean;
  created_at: string;
  updated_at: string;
}

export enum SlotStatus {
  EMPTY = 'EMPTY',
  PARTIALLY_ASSIGNED = 'PARTIALLY_ASSIGNED',
  FULLY_ASSIGNED = 'FULLY_ASSIGNED'
}

export enum FixtureSchedulingStatus {
  UNASSIGNED = 'UNASSIGNED',
  ASSIGNED = 'ASSIGNED'
}

export enum MatchState {
  SCHEDULED = 'SCHEDULED',
  PRE_MATCH = 'PRE_MATCH',
  READY = 'READY',
  LIVE = 'LIVE',
  HALF_TIME = 'HALF_TIME',
  SECOND_HALF = 'SECOND_HALF',
  EXTRA_TIME_1 = 'EXTRA_TIME_1',
  EXTRA_TIME_BREAK = 'EXTRA_TIME_BREAK',
  EXTRA_TIME_2 = 'EXTRA_TIME_2',
  PENALTY_SHOOTOUT = 'PENALTY_SHOOTOUT',
  FULL_TIME = 'FULL_TIME',
  COMPLETED = 'COMPLETED',
  PAUSED = 'PAUSED',
  ABANDONED = 'ABANDONED',
  POSTPONED = 'POSTPONED',
  CANCELLED = 'CANCELLED'
}

export enum MatchResultType {
  NORMAL_TIME = 'NORMAL_TIME',
  EXTRA_TIME = 'EXTRA_TIME',
  PENALTIES = 'PENALTIES',
  WALKOVER = 'WALKOVER',
  VOID = 'VOID'
}

export interface Match {
  id: string;
  event_id: string;
  group_id: string | null;
  scheduling_status: FixtureSchedulingStatus;
  home_registration_id: string | null;
  away_registration_id: string | null;
  venue_field_id: string | null;
  scheduled_start: string | null;
  match_state: MatchState;
  home_score: number;
  away_score: number;
  home_penalties: number | null;
  away_penalties: number | null;
  rating_weights_snapshot: any | null;
  bracket_id: string | null;
}

export interface Group {
  id: string;
  event_id: string;
  name: string;
}

export interface ScheduleSlot {
  id: string;
  event_id: string;
  sequence_number: number;
  scheduled_start: string;
  scheduled_end: string;
  status: SlotStatus;
}

export interface SlotFieldAssignment {
  id: string;
  slot_id: string;
  venue_field_id: string;
  fixture_id: string | null;
}

export enum RefereeStatus {
  ASSIGNED = 'ASSIGNED',
  ACCEPTED = 'ACCEPTED',
  DECLINED = 'DECLINED',
  REPLACEMENT = 'REPLACEMENT'
}

export interface MatchReferee {
  id: string;
  match_id: string;
  user_id: string;
  status: RefereeStatus;
  assigned_by: string | null;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MatchStateTransition {
  id: string;
  match_id: string;
  previous_state: MatchState | null;
  new_state: MatchState;
  reason: string | null;
  actor_id: string | null;
  created_at: string;
}

export enum MatchPeriod {
  PRE_MATCH = 'PRE_MATCH',
  FIRST_HALF = 'FIRST_HALF',
  HALF_TIME = 'HALF_TIME',
  SECOND_HALF = 'SECOND_HALF',
  EXTRA_TIME_1 = 'EXTRA_TIME_1',
  EXTRA_TIME_BREAK = 'EXTRA_TIME_BREAK',
  EXTRA_TIME_2 = 'EXTRA_TIME_2',
  PENALTY_SHOOTOUT = 'PENALTY_SHOOTOUT',
  POST_MATCH = 'POST_MATCH'
}

export enum RefereeEventType {
  PERIOD_START = 'PERIOD_START',
  PERIOD_END = 'PERIOD_END',
  STOPPAGE_START = 'STOPPAGE_START',
  STOPPAGE_END = 'STOPPAGE_END',
  SUBSTITUTION = 'SUBSTITUTION',
  FOUL = 'FOUL',
  WARNING = 'WARNING',
  YELLOW_CARD = 'YELLOW_CARD',
  RED_CARD = 'RED_CARD',
  OFFSIDE = 'OFFSIDE',
  OFFICIAL_DECISION = 'OFFICIAL_DECISION'
}

export interface RefereeEvent {
  id: string;
  match_id: string;
  event_type: RefereeEventType;
  period: MatchPeriod;
  elapsed_seconds: number;
  display_minute: number;
  display_second: number;
  created_by: string | null;
  event_player_id: string | null;
  event_registration_id: string | null;
  metadata: any;
  created_at: string;
}

export enum TimelineEventType {
  PASS = 'PASS',
  CROSS = 'CROSS',
  SHOT = 'SHOT',
  DRIBBLE = 'DRIBBLE',
  TACKLE = 'TACKLE',
  INTERCEPTION = 'INTERCEPTION',
  BALL_RECOVERY = 'BALL_RECOVERY',
  CLEARANCE = 'CLEARANCE',
  BLOCK = 'BLOCK',
  AERIAL_DUEL = 'AERIAL_DUEL',
  SAVE = 'SAVE',
  GREAT_FIRST_TOUCH = 'GREAT_FIRST_TOUCH',
  AERIAL_CLAIM = 'AERIAL_CLAIM',
  SWEEPER_ACTION = 'SWEEPER_ACTION',
  DISTRIBUTION = 'DISTRIBUTION',
  CORNER = 'CORNER',
  FREE_KICK = 'FREE_KICK',
  DROP_BALL = 'DROP_BALL',
  OFF_BALL_RUN = 'OFF_BALL_RUN',
  ERROR = 'ERROR',
  INJURY_NOTE = 'INJURY_NOTE',
  OTHER = 'OTHER'
}

export interface MatchTimelineEvent {
  id: string;
  match_id: string;
  event_type: TimelineEventType;
  period: MatchPeriod;
  elapsed_seconds: number;
  display_minute: number;
  display_second: number;
  actor_player_id: string | null;
  actor_registration_id: string | null;
  target_player_id: string | null;
  target_registration_id: string | null;
  x: number | null;
  y: number | null;
  referee_event_id: string | null;
  metadata: any;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MatchParticipation {
  id: string;
  match_id: string;
  event_player_id: string;
  event_registration_id: string;
  entry_elapsed_seconds: number | null;
  exit_elapsed_seconds: number | null;
  minutes_played: number | null;
  created_at: string;
  updated_at: string;
}

export interface EventCorrection {
  id: string;
  match_id: string;
  timeline_event_id: string;
  original_payload: any;
  corrected_payload: any;
  reason: string | null;
  corrected_by: string | null;
  created_at: string;
}
