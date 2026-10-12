export type Tier = 'core_creator' | 'campaign_creator' | 'vcc_community' | 'inactive';
export type ProfileStatus = 'pending' | 'approved' | 'rejected' | 'inactive';
export type Platform = 'instagram' | 'youtube' | 'facebook' | 'linkedin' | 'threads';
export type CampaignStatus = 'draft' | 'open' | 'closed' | 'completed';
export type CampaignType = 'free' | 'paid' | 'gifted';
export type AssignmentStatus = 'invited' | 'accepted' | 'declined' | 'submitted' | 'completed' | 'cancelled';
export type NotificationType = 'info' | 'campaign' | 'approval' | 'alert';
export type AdminRole = 'super_admin' | 'admin' | 'viewer';

export interface Me {
  signedIn: boolean;
  user?: { id: string; email: string; name: string | null; avatarUrl: string | null };
  admin?: { role: AdminRole; name: string } | null;
  profile?: { status: ProfileStatus; fullName: string } | null;
}

/** Editable creator fields (enrollment form + profile edit). */
export interface ProfileForm {
  fullName: string;
  email: string;
  phone: string;
  city: string;
  coordinationMode: 'direct' | 'manager';
  managerName: string | null;
  managerContact: string | null;
  corePlatform: Platform | '';
  instagramHandle: string | null;
  instagramUrl: string | null;
  instagramFollowers: number | null;
  youtubeHandle: string | null;
  youtubeUrl: string | null;
  youtubeSubscribers: number | null;
  facebookUrl: string | null;
  facebookFollowers: number | null;
  linkedinUrl: string | null;
  linkedinFollowers: number | null;
  threadsHandle: string | null;
  threadsUrl: string | null;
  threadsFollowers: number | null;
  otherPlatforms: string | null;
  contentCategory: string;
  contentLanguages: string[];
  contentTypes: string[];
  bio: string | null;
  rateStory: number | null;
  ratePost: number | null;
  rateReel: number | null;
  rateTvc: number | null;
  workedWithVivo: boolean;
  vivoWorkDetails: string | null;
}

export interface Profile extends ProfileForm {
  id: string;
  profilePhotoUrl: string | null;
  status: ProfileStatus;
  tier: Tier;
  enrolledAt: string;
  approvedAt: string | null;
  adminNotes?: string | null;
  emailOptIn: boolean;
}

export interface EmailLog {
  id: string;
  template: string;
  subject: string;
  status: 'queued' | 'sent' | 'failed' | 'skipped';
  error: string | null;
  createdAt: string;
  sentAt: string | null;
}

export interface Campaign {
  id: string;
  title: string;
  description: string | null;
  product: string | null;
  campaignType: CampaignType;
  budgetInr: number | null;
  deliverables: string[];
  deadline: string | null;
  status: CampaignStatus;
  eligibleTiers: Tier[];
  maxCreators: number | null;
  createdAt: string;
  bannerUrl?: string | null;
  assignmentCount?: number;
  myAssignmentStatus?: AssignmentStatus;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  createdAt: string;
}

export interface Summary {
  profile: Profile;
  notifications?: AppNotification[];
  unreadCount?: number;
  campaigns?: Campaign[];
}

export interface EnrollmentToken {
  id: string;
  token: string;
  label: string | null;
  isEventToken: boolean;
  usedCount: number;
  maxUses: number;
  expiresAt: string;
  isActive: boolean;
  state: 'active' | 'expired' | 'exhausted' | 'inactive';
  createdAt: string;
}

export interface AdminStats {
  totalEnrolled: number;
  pending: number;
  approved: number;
  activeCampaigns: number;
  recent: Profile[];
}

export type AssignableRole = AdminRole | 'none';

export interface AdminUser {
  id: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  role: AdminRole | null;
  isCreator: boolean;
  isYou: boolean;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CampaignDetail extends Campaign {
  assignments: {
    id: string;
    creatorId: string;
    fullName: string;
    phone: string;
    instagramHandle: string | null;
    city: string | null;
    tier: Tier;
    status: AssignmentStatus;
    contentUrl: string | null;
    adminNotes: string | null;
    createdAt: string;
  }[];
}

export interface CreatorDetail extends Profile {
  assignments: { id: string; status: AssignmentStatus; createdAt: string; title: string; product: string | null }[];
}
