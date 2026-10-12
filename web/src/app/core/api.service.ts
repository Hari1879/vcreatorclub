import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  AdminRole,
  AdminStats,
  AdminUser,
  AssignableRole,
  AppNotification,
  Campaign,
  CampaignDetail,
  CreatorDetail,
  EmailLog,
  EnrollmentToken,
  Me,
  Paged,
  Profile,
  ProfileForm,
  Summary,
} from './models';

/** Human-readable message from a Nest error response. */
export function errorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) return 'You appear to be offline. Please check your connection.';
    if (err.status === 429) return 'Too many attempts. Please wait a minute and try again.';
    const m = err.error?.message;
    if (Array.isArray(m)) return m[0];
    if (typeof m === 'string') return m;
  }
  return fallback;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private get = <T>(url: string, params?: Record<string, string | number | undefined>) => {
    let p = new HttpParams();
    for (const [k, v] of Object.entries(params ?? {})) if (v !== undefined && v !== '') p = p.set(k, String(v));
    return firstValueFrom(this.http.get<T>(`/api${url}`, { params: p }));
  };
  private post = <T>(url: string, body: unknown = {}) => firstValueFrom(this.http.post<T>(`/api${url}`, body));
  private put = <T>(url: string, body: unknown) => firstValueFrom(this.http.put<T>(`/api${url}`, body));
  private patch = <T>(url: string, body: unknown) => firstValueFrom(this.http.patch<T>(`/api${url}`, body));
  private del = <T>(url: string) => firstValueFrom(this.http.delete<T>(`/api${url}`));

  // auth
  followerCount = (platform: 'youtube', url: string, token?: string) =>
    this.get<{ count: number | null; hidden: boolean }>('/creators/follower-count', { platform, url, token });
  me = () => this.get<Me>('/auth/me');
  logout = () => this.post<{ ok: boolean }>('/auth/logout');

  // enrollment
  validateToken = (token: string) =>
    this.get<{ state: 'valid' | 'invalid' | 'expired' | 'exhausted'; label?: string }>('/enrollment/tokens/validate', {
      token,
    });
  saveDraft = (body: { draftId: string; token: string; step: number; data: unknown }) =>
    this.post<{ savedAt: string }>('/enrollment/draft', body);
  getDraft = (draftId: string, token: string) =>
    this.get<{ step: number; data: Partial<ProfileForm>; savedAt: string }>(`/enrollment/draft/${draftId}`, { token });
  submitEnrollment = (body: unknown) => this.post<{ ok: boolean; status: string }>('/enrollment/submit', body);

  // creator
  summary = () => this.get<Summary>('/me/summary');
  profile = () => this.get<Profile>('/me/profile');
  updateProfile = (body: ProfileForm) => this.put<Profile>('/me/profile', body);
  myCampaigns = () => this.get<Campaign[]>('/me/campaigns');
  interest = (id: string) => this.post<{ ok: boolean; status: string }>(`/me/campaigns/${id}/interest`);
  notifications = () => this.get<AppNotification[]>('/me/notifications');
  setEmailPreference = (emailOptIn: boolean) => this.put<{ emailOptIn: boolean }>('/me/email-preferences', { emailOptIn });
  markRead = (id: string) => this.post(`/me/notifications/${id}/read`);
  markAllRead = () => this.post('/me/notifications/read-all');

  // admin
  adminMe = () => this.get<{ id: string; name: string; email: string; role: string }>('/admin/me');
  stats = () => this.get<AdminStats>('/admin/stats');
  creators = (q: { search?: string; status?: string; tier?: string; page?: number; pageSize?: number }) =>
    this.get<Paged<Profile>>('/admin/creators', q);
  creator = (id: string) => this.get<CreatorDetail>(`/admin/creators/${id}`);
  approve = (ids: string[]) => this.post<{ approved: number }>('/admin/creators/approve', { ids });
  reject = (id: string, note?: string) => this.post(`/admin/creators/${id}/reject`, { note: note || undefined });
  deleteCreator = (id: string) => this.del<{ ok: boolean }>(`/admin/creators/${id}`);
  updateCreator = (id: string, body: { tier?: string; status?: string; adminNotes?: string | null }) =>
    this.patch<Profile>(`/admin/creators/${id}`, body);
  creatorEmails = (id: string) => this.get<EmailLog[]>(`/admin/creators/${id}/emails`);
  adminUsers = (q: { search?: string; page?: number; pageSize?: number }) =>
    this.get<Paged<AdminUser>>('/admin/users', q);
  setUserRole = (userId: string, role: AssignableRole) =>
    this.put<{ id: string; role: AdminRole | null }>(`/admin/users/${userId}/role`, { role });
  sendTestEmail = () => this.post<{ status: string }>('/admin/email/test');
  campaigns = () => this.get<Campaign[]>('/admin/campaigns');
  campaign = (id: string) => this.get<CampaignDetail>(`/admin/campaigns/${id}`);
  createCampaign = (body: unknown) => this.post<Campaign>('/admin/campaigns', body);
  updateCampaign = (id: string, body: unknown) => this.put<Campaign>(`/admin/campaigns/${id}`, body);
  uploadCampaignBanner = (id: string, file: File) =>
    firstValueFrom(
      this.http.put<Campaign>(`/api/admin/campaigns/${id}/banner`, file, { headers: { 'Content-Type': file.type } }),
    );
  removeCampaignBanner = (id: string) => this.del(`/admin/campaigns/${id}/banner`);
  campaignStatus = (id: string, status: string) => this.post<Campaign>(`/admin/campaigns/${id}/status`, { status });
  deleteCampaign = (id: string) => this.del(`/admin/campaigns/${id}`);
  updateAssignment = (id: string, body: { status?: string; adminNotes?: string }) =>
    this.patch(`/admin/assignments/${id}`, body);
  tokens = () => this.get<EnrollmentToken[]>('/admin/tokens');
  createToken = (body: { label: string; isEventToken: boolean; maxUses: number; expiresAt: string }) =>
    this.post<EnrollmentToken>('/admin/tokens', body);
  setTokenActive = (id: string, isActive: boolean) => this.patch<EnrollmentToken>(`/admin/tokens/${id}`, { isActive });
  sendNotification = (body: {
    creatorIds?: string[];
    allApproved?: boolean;
    title: string;
    message: string;
    type: string;
    sendEmail?: boolean;
  }) => this.post<{ sent: number }>('/admin/notifications', body);
}
