import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { SiteDoc } from '../builder/model';

export interface UserDto { id: string; email: string; displayName: string; isAdmin: boolean }
export interface AuthResult { token: string; user: UserDto }
export interface SiteSummary { id: string; name: string; slug: string; updatedAt: string; publishedAt: string | null; published: boolean; role: 'owner' | 'editor'; url: string | null }
export interface SiteDetail extends SiteSummary {
  version: number; document: SiteDoc; unpublishedChanges: boolean; publicBase: string;
}
export interface Member { userId: string; email: string; displayName: string; role: 'owner' | 'editor' }
export interface VersionRow { number: number; note: string | null; createdAt: string; by: string }
export interface AssetDto { id: string; name: string; size: number; url: string }

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);

  status() { return this.http.get<{ hasUsers: boolean; allowRegistration: boolean }>('/api/auth/status'); }
  login(email: string, password: string) { return this.http.post<AuthResult>('/api/auth/login', { email, password }); }
  register(email: string, password: string, displayName: string) { return this.http.post<AuthResult>('/api/auth/register', { email, password, displayName }); }
  me() { return this.http.get<UserDto>('/api/auth/me'); }
  changePassword(current: string, next: string) { return this.http.post<void>('/api/auth/password', { current, new: next }); }

  users() { return this.http.get<UserDto[]>('/api/users'); }
  createUser(u: { email: string; password: string; displayName: string; isAdmin: boolean }) { return this.http.post<UserDto>('/api/users', u); }
  resetPassword(id: string, password: string) { return this.http.put<void>(`/api/users/${id}/password`, { password }); }
  deleteUser(id: string) { return this.http.delete<void>(`/api/users/${id}`); }

  sites() { return this.http.get<SiteSummary[]>('/api/sites'); }
  createSite(name: string, document: SiteDoc, slug?: string) { return this.http.post<SiteDetail>('/api/sites', { name, slug: slug || null, document }); }
  site(id: string) { return this.http.get<SiteDetail>(`/api/sites/${id}`); }
  saveDraft(id: string, baseVersion: number, document: SiteDoc) { return this.http.put<{ version: number; updatedAt: string }>(`/api/sites/${id}/draft`, { baseVersion, document }); }
  renameSite(id: string, patch: { name?: string; slug?: string }) { return this.http.patch<{ name: string; slug: string }>(`/api/sites/${id}`, patch); }
  deleteSite(id: string) { return this.http.delete<void>(`/api/sites/${id}`); }
  publish(id: string, baseVersion: number, html: string, note: string) { return this.http.post<{ url: string; publishedAt: string; versionNumber: number }>(`/api/sites/${id}/publish`, { baseVersion, html, note }); }
  unpublish(id: string) { return this.http.post<void>(`/api/sites/${id}/unpublish`, {}); }
  versions(id: string) { return this.http.get<VersionRow[]>(`/api/sites/${id}/versions`); }
  restore(id: string, n: number) { return this.http.post<{ version: number }>(`/api/sites/${id}/versions/${n}/restore`, {}); }
  members(id: string) { return this.http.get<Member[]>(`/api/sites/${id}/members`); }
  addMember(id: string, email: string, role: string) { return this.http.post<void>(`/api/sites/${id}/members`, { email, role }); }
  removeMember(id: string, userId: string) { return this.http.delete<void>(`/api/sites/${id}/members/${userId}`); }

  assets(id: string) { return this.http.get<AssetDto[]>(`/api/sites/${id}/assets`); }
  upload(id: string, file: File) { const f = new FormData(); f.append('file', file); return this.http.post<AssetDto>(`/api/sites/${id}/assets`, f); }
  deleteAsset(id: string, assetId: string) { return this.http.delete<void>(`/api/sites/${id}/assets/${assetId}`); }
}

/** Turns an API error into one sentence a person can act on. */
export function errMsg(e: any, fallback = 'Something went wrong. Try again.'): string {
  const d = e?.error;
  if (d?.detail) return d.detail;
  if (e?.status === 0) return 'Cannot reach the server. Check your connection.';
  // An HTML body means the request never reached the API (for example `ng serve` without its /api proxy, or a wrong address).
  if (typeof d === 'string' && /^\s*<(!doctype|html)/i.test(d)) return 'The API did not answer at /api. Check that it is running, and that the dev proxy (web/proxy.conf.json) points at it.';
  if (typeof d === 'string' && d) return d;
  if (e?.status === 413) return 'That file is too large.';
  return fallback;
}
