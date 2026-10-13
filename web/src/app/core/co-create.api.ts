import { HttpClient, HttpEvent, HttpEventType, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, filter, map } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import {
  CoCreateDecision,
  CoCreateDetail,
  CoCreateListPage,
  CoCreateListQuery,
  MyCoCreateRequest,
  TermsResponse,
  UploadKind,
  UploadResult,
} from './co-create.models';

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export type UploadEvent = { progress: number } | { done: UploadResult };

@Injectable({ providedIn: 'root' })
export class CoCreateApi {
  private http = inject(HttpClient);
  private base = '/api';

  private params(q: Record<string, string | number | undefined>) {
    let p = new HttpParams();
    for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== '') p = p.set(k, String(v));
    return p;
  }

  // creator
  terms = (supportType: string) =>
    firstValueFrom(this.http.get<TermsResponse>(`${this.base}/co-create/terms`, { params: this.params({ supportType }) }));
  mine = () => firstValueFrom(this.http.get<MyCoCreateRequest[]>(`${this.base}/co-create/requests/mine`));
  submit = (payload: unknown, idempotencyKey: string) =>
    firstValueFrom(
      this.http.post<{ id?: string; status?: string }>(`${this.base}/co-create/requests`, payload, {
        headers: new HttpHeaders({ 'Idempotency-Key': idempotencyKey }),
      }),
    );

  upload(file: File, kind: UploadKind): Observable<UploadEvent> {
    const body = new FormData();
    body.append('kind', kind);
    body.append('file', file);
    return this.http.post<UploadResult>(`${this.base}/co-create/uploads`, body, { reportProgress: true, observe: 'events' }).pipe(
      map((e: HttpEvent<UploadResult>): UploadEvent | null => {
        if (e.type === HttpEventType.UploadProgress) return { progress: e.total ? Math.round((100 * e.loaded) / e.total) : 0 };
        if (e.type === HttpEventType.Response) return { done: e.body as UploadResult };
        return null;
      }),
      filter((e): e is UploadEvent => e !== null),
    );
  }

  // admin
  summary = () => firstValueFrom(this.http.get<{ pending: number }>(`${this.base}/admin/co-create/summary`));
  adminList = (q: CoCreateListQuery) =>
    firstValueFrom(
      this.http.get<CoCreateListPage>(`${this.base}/admin/co-create/requests`, {
        params: this.params({ ...q }),
      }),
    );
  adminGet = (id: string) => firstValueFrom(this.http.get<CoCreateDetail>(`${this.base}/admin/co-create/requests/${id}`));
  decide = (id: string, decision: CoCreateDecision, note: string) =>
    firstValueFrom(this.http.post<unknown>(`${this.base}/admin/co-create/requests/${id}/decision`, { decision, note }));
  fileUrl = (id: string, fileId: string) =>
    firstValueFrom(this.http.get<{ url: string }>(`${this.base}/admin/co-create/requests/${id}/files/${fileId}/url`));
  revealAccount = (id: string) =>
    firstValueFrom(this.http.post<{ accountNumber: string }>(`${this.base}/admin/co-create/requests/${id}/reveal-account`, {}));
}
