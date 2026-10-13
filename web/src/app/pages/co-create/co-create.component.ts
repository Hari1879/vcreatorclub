import { NgTemplateOutlet } from '@angular/common';
import { Component, DestroyRef, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { LucideAngularModule } from 'lucide-angular';
import { distinctUntilChanged } from 'rxjs';
import { errorMessage } from '../../core/api.service';
import { CoCreateApi, MAX_UPLOAD_BYTES } from '../../core/co-create.api';
import { FieldError, MyCoCreateRequest, STATUS_LABEL, TermsResponse, UploadKind } from '../../core/co-create.models';
import { HasUnsavedChanges } from '../../core/guards';
import { I } from '../../shared/icons';
import { SpinnerComponent } from '../../shared/ui.components';
import { CcCheckComponent, CcChoiceComponent, CcTextComponent, controlError } from './cc-fields';
import {
  ACCOUNT_TYPE_OPTIONS,
  CONTENT_TYPE_OPTIONS,
  COVER_OPTIONS,
  DURATION_OPTIONS,
  FEATURED_OPTIONS,
  FIELD_PATHS,
  LOCATION_OPTIONS,
  MILESTONE_OPTIONS,
  PLATFORM_OPTIONS,
  REVIEW_DAY_OPTIONS,
  SUPPORT_OPTIONS,
  YES_NO,
  addDays,
  buildForm,
  clearDraft,
  invalidFieldIds,
  isIso,
  loadDraft,
  reviewWindowOk,
  saveDraft,
  sectionOf,
  syncForm,
  todayIso,
  toPayload,
  totalPieces,
} from './co-create.logic';

interface UploadState {
  name: string;
  progress: number;
  error: string | null;
  done: boolean;
}

const IDEA_EXT = ['pdf', 'ppt', 'pptx', 'doc', 'docx'];
const IDEA_MAX = 10 * 1024 * 1024;

@Component({
  selector: 'vcc-co-create',
  standalone: true,
  imports: [ReactiveFormsModule, NgTemplateOutlet, RouterLink, LucideAngularModule, SpinnerComponent, CcTextComponent, CcChoiceComponent, CcCheckComponent],
  template: `
    <div class="min-h-screen bg-vcc-navy-deep text-white">
      <div class="mx-auto max-w-5xl px-4 pb-24 pt-6">
        <a routerLink="/dashboard/campaigns" class="inline-flex items-center gap-2 text-sm text-vcc-gray-light hover:text-white">
          <lucide-icon [img]="I.ArrowLeft" [size]="16" /> Back to campaigns
        </a>
        <h1 class="mt-3 text-3xl font-bold sm:text-4xl">Co-Create</h1>
        <p class="mt-1 text-vcc-gray-light">Pitch your own idea to the V Team.</p>

        @if (submitted()) {
          <div class="card-dark mt-6 p-6 text-center" role="status">
            <lucide-icon [img]="I.CheckCircle2" [size]="44" class="mx-auto text-green-400" />
            <p class="mt-4 text-lg font-semibold">
              Your Co-Create request has been submitted successfully. Status: Sent to V Team. You will receive a response within 5-7 business days.
            </p>
            <div class="mt-6 flex justify-center gap-3">
              <button class="btn-primary px-5 py-2" (click)="startNew()">Submit another</button>
              <a routerLink="/dashboard" class="btn-ghost px-5 py-2">Back to dashboard</a>
            </div>
          </div>
        }

        @if (mine().length) {
          <section class="card-dark mt-6 p-4" aria-labelledby="mine-h">
            <h2 id="mine-h" class="mb-2 text-lg font-bold">My Co-Create requests</h2>
            <ul class="divide-y divide-white/10 text-sm">
              @for (r of mine(); track r.id) {
                <li class="flex items-center justify-between gap-3 py-2">
                  <span class="min-w-0 truncate">{{ r.title }}</span>
                  <span class="pill shrink-0 bg-vcc-blue/20 text-vcc-blue-light">{{ r.statusLabel ?? statusLabel(r) }}</span>
                </li>
              }
            </ul>
          </section>
        }

        @if (!submitted()) {
          <!-- mobile progress -->
          <div class="sticky top-0 z-20 -mx-4 mt-4 bg-vcc-navy-deep/95 px-4 py-3 backdrop-blur lg:hidden" aria-live="polite">
            <p class="text-xs text-vcc-gray-light">Section {{ currentIndex() + 1 }} of {{ sections().length }} — {{ sections()[currentIndex()].title }}</p>
            <div class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div class="h-full bg-vcc-blue transition-all" [style.width.%]="((currentIndex() + 1) / sections().length) * 100"></div>
            </div>
          </div>

          <div class="mt-4 flex gap-8">
            <!-- desktop navigator -->
            <nav class="sticky top-6 hidden h-fit w-56 shrink-0 lg:block" aria-label="Form sections">
              <ol class="space-y-1">
                @for (s of sections(); track s.n; let i = $index) {
                  <li>
                    <button type="button" (click)="goTo(s.n)"
                      [class]="'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-white/5 ' + (i === currentIndex() ? 'bg-vcc-blue/20 font-semibold' : 'text-vcc-gray-light')">
                      <span [class]="'grid h-6 w-6 place-items-center rounded-full text-xs ' + (sectionDone(s.n) ? 'bg-green-500 text-white' : 'bg-white/10')">
                        @if (sectionDone(s.n)) { <lucide-icon [img]="I.Check" [size]="14" /> } @else { {{ s.n }} }
                      </span>
                      {{ s.title }}
                    </button>
                  </li>
                }
              </ol>
            </nav>

            <form class="min-w-0 flex-1" [formGroup]="form" (ngSubmit)="submit()" novalidate>
              <!-- SECTION 1 -->
              <section id="sec-1" class="card-dark mb-6 scroll-mt-20 p-5" aria-labelledby="h-1" formGroupName="s1">
                <h2 id="h-1" class="mb-4 text-xl font-bold">1. Idea Brief</h2>
                <cc-text id="1.1" label="Collaboration Title *" [control]="form.controls.s1.controls.title" [max]="100"
                  hint="Give your idea a short, clear name (e.g. V80 Morning Routine Reel)" />
                <cc-text id="1.2" label="Describe Your Idea *" kind="textarea" [control]="form.controls.s1.controls.idea" [max]="500" />
                <cc-text id="1.3" label="Which Vivo product does this idea involve? *" [control]="form.controls.s1.controls.product" [max]="100"
                  hint="Exact model name, e.g. Vivo V80, Vivo X Fold 6, Vivo X300 Pro" />
                <div class="mb-5" id="f-1.4" tabindex="-1">
                  <span class="field-label">Upload your idea document / concept note <span class="font-normal text-vcc-gray-light">(optional)</span></span>
                  <p class="mb-1.5 text-xs text-vcc-gray-light">Not mandatory, but strongly recommended. .pdf .ppt .pptx .doc .docx, max 10 MB.</p>
                  <ng-container *ngTemplateOutlet="uploader; context: { key: 'idea', accept: '.pdf,.ppt,.pptx,.doc,.docx', label: 'Idea document' }" />
                </div>
                <cc-choice id="1.5" label="What type of support are you requesting? *" [control]="form.controls.s1.controls.supportType" [options]="supportOptions" />
              </section>

              <!-- SECTION 2 -->
              <section id="sec-2" class="card-dark mb-6 scroll-mt-20 p-5" aria-labelledby="h-2" formGroupName="s2">
                <h2 id="h-2" class="mb-4 text-xl font-bold">2. Compensation</h2>
                @if (!vis().a && !vis().b && !vis().c) {
                  <p class="text-sm text-vcc-gray-light">Choose a support type in Section 1 to see the relevant questions.</p>
                }
                <div aria-live="polite">
                  @if (vis().a) {
                    <div formGroupName="a" class="mb-2">
                      <h3 class="mb-3 font-semibold text-vcc-blue-light">Cash fee</h3>
                      <cc-text id="2A.1" label="Total fee for this collaboration (Rs.) *" kind="number" [control]="form.controls.s2.controls.a.controls.fee" />
                      <cc-choice id="2A.2" label="What does this fee cover? (select all) *" [multi]="true" [options]="coverOptions" [control]="form.controls.s2.controls.a.controls.covers" />
                      @if (vis().otherCosts) {
                        <cc-text id="2A.3" label="Specify &quot;Other&quot; cost items *" kind="textarea" [max]="200" [control]="form.controls.s2.controls.a.controls.otherCosts" />
                      }
                      <cc-text id="2A.4" label="Why is this the right fee for this collaboration? *" kind="textarea" [max]="300"
                        hint="Be specific - what effort, time, and resources does this involve?" [control]="form.controls.s2.controls.a.controls.why" />
                      <cc-choice id="2A.5" label="Preferred payment milestone *" [options]="milestoneOptions" [control]="form.controls.s2.controls.a.controls.milestone" />
                      <cc-choice id="2A.6" label="Are you GST registered? *" [options]="yesNo" [control]="form.controls.s2.controls.a.controls.gstRegistered" />
                      @if (vis().gst) {
                        <cc-text id="2A.7" label="GST Number *" [upper]="true" [max]="15" [control]="form.controls.s2.controls.a.controls.gstNumber" hint="e.g. 33AABCU9603R1ZV" />
                      }
                    </div>
                  }
                  @if (vis().b) {
                    <div formGroupName="b" class="mb-2">
                      <h3 class="mb-3 font-semibold text-vcc-blue-light">Product borrow</h3>
                      <cc-text id="2B.1" label="Which Vivo product do you need to borrow? *" [max]="100" [control]="form.controls.s2.controls.b.controls.product" hint="e.g. Vivo V80" />
                      <cc-text id="2B.2" label="Variant / Colour / Storage configuration *" [max]="150" [control]="form.controls.s2.controls.b.controls.variant" hint="e.g. Midnight Blue, 8 GB RAM / 256 GB Storage" />
                      <cc-text id="2B.3" label="Why this specific variant for your content? *" kind="textarea" [max]="200" [control]="form.controls.s2.controls.b.controls.why" />
                      <cc-text id="2B.4" label="How many units do you need? *" kind="number" [control]="form.controls.s2.controls.b.controls.units" />
                      <cc-choice id="2B.5" label="How long do you need the device? *" [options]="durationOptions" [control]="form.controls.s2.controls.b.controls.duration" />
                      <cc-choice id="2B.6" label="Where will the device be used? *" [options]="locationOptions" [control]="form.controls.s2.controls.b.controls.location" />
                      @if (vis().locationDetails) {
                        <cc-text id="2B.7" label="Specify location(s) *" kind="textarea" [max]="200" [control]="form.controls.s2.controls.b.controls.locationDetails" />
                      }
                      <div class="rounded-lg border border-amber-400/30 bg-amber-400/5 p-3">
                        <p class="mb-2 font-semibold">Device Return Commitment *</p>
                        <cc-check id="2B.8" [control]="form.controls.s2.controls.b.controls.returnCommitment"
                          label="I confirm I will return the device in its original condition by the date agreed with FTPL. I accept that any damage, loss, or theft of the device during the borrow period is my sole financial responsibility." />
                      </div>
                    </div>
                  }
                  @if (vis().c) {
                    <div formGroupName="c" class="mb-2">
                      <h3 class="mb-3 font-semibold text-vcc-blue-light">Product to keep</h3>
                      <cc-text id="2C.1" label="Which Vivo product are you requesting? *" [max]="100" [control]="form.controls.s2.controls.c.controls.product" />
                      <cc-text id="2C.2" label="Variant / Colour / Storage configuration *" [max]="150" [control]="form.controls.s2.controls.c.controls.variant" hint="e.g. Cosmic Black, 12 GB RAM / 512 GB Storage" />
                      <cc-text id="2C.3" label="Why this specific variant for your content? *" kind="textarea" [max]="200" [control]="form.controls.s2.controls.c.controls.why" />
                      <cc-text id="2C.4" label="How many units are you requesting? *" kind="number" [control]="form.controls.s2.controls.c.controls.units" />
                      @if (vis().unitsReason) {
                        <cc-text id="2C.5" label="If requesting more than 1 unit - state your reason *" kind="textarea" [max]="200" [control]="form.controls.s2.controls.c.controls.unitsReason" />
                      }
                    </div>
                  }
                </div>
              </section>

              <!-- SECTION 3 -->
              <section id="sec-3" class="card-dark mb-6 scroll-mt-20 p-5" aria-labelledby="h-3" formGroupName="s3">
                <h2 id="h-3" class="mb-4 text-xl font-bold">3. Content Deliverables</h2>
                <cc-choice id="3.1" label="What type of content will you create? (select all) *" [multi]="true" [options]="contentTypeOptions" [control]="form.controls.s3.controls.contentTypes" />
                @if (vis().otherType) {
                  <cc-text id="3.2" label="Specify &quot;Other&quot; content type *" [max]="200" hint="Describe the content format and platform" [control]="form.controls.s3.controls.otherType" />
                }
                @if (selectedTypes().length) {
                  <div class="mb-5" id="f-3.3" tabindex="-1" formGroupName="counts">
                    <span class="field-label">Number of pieces per content type *</span>
                    <div class="grid gap-3 sm:grid-cols-2">
                      @for (t of selectedTypes(); track t.value) {
                        <cc-text [id]="'3.3-' + t.value" [label]="t.label + ' *'" kind="number" [control]="countControl(t.value)" />
                      }
                    </div>
                    <p class="text-sm" aria-live="polite">Total pieces: <strong>{{ total() }}</strong></p>
                  </div>
                }
                <cc-choice id="3.4" label="Will the Vivo product be visibly featured? *" [options]="featuredOptions" [control]="form.controls.s3.controls.featured" />
                <cc-text id="3.5" label="Describe your content concept and story angle *" kind="textarea" [max]="400" [control]="form.controls.s3.controls.concept" />
                <cc-choice id="3.6" label="Will you tag @vivoIndia or @vcreatorclub in the published content? *" [options]="yesNo" [control]="form.controls.s3.controls.tag" />
                @if (vis().noTagReason) {
                  <cc-text id="3.7" label="Reason for not tagging Vivo / VCC *" kind="textarea" [max]="200" [control]="form.controls.s3.controls.noTagReason" />
                }
                <cc-text id="3.8" label="Planned content shoot date *" kind="date" [min]="tomorrow" [control]="form.controls.s3.controls.shootDate" />
                <cc-text id="3.9" label="Planned posting / publishing date *" kind="date" [min]="postMin()" [control]="form.controls.s3.controls.postDate"
                  hint="Must be at least 2 days after the shoot date" />
                <cc-choice id="3.10" label="Will you submit content to FTPL for review before posting? *" [options]="yesNo" [control]="form.controls.s3.controls.reviewBefore" />
                <div aria-live="polite">
                  @if (vis().reviewAck) {
                    <div class="mb-5 rounded-lg border border-red-400/40 bg-red-500/10 p-3 text-sm">
                      <p class="mb-3 font-semibold">IMPORTANT - FTPL requires review and written approval of all VCC-linked content before it is published on any platform. Without this, we cannot process your Co-Create request.</p>
                      <cc-check id="3.10a" [control]="form.controls.s3.controls.reviewAck" label="I confirm I will submit content for FTPL review and obtain written approval before publishing." />
                    </div>
                  }
                  @if (vis().reviewDays) {
                    <cc-choice id="3.11" label="How many days before your posting date will you submit content for review? *" [options]="reviewDayOptions"
                      [disabledValues]="blockedReviewDays()" [control]="form.controls.s3.controls.reviewDays" />
                  }
                </div>
              </section>

              <!-- SECTION 4 -->
              <section id="sec-4" class="card-dark mb-6 scroll-mt-20 p-5" aria-labelledby="h-4" formGroupName="s4">
                <h2 id="h-4" class="mb-4 text-xl font-bold">4. Platform &amp; Audience</h2>
                <cc-choice id="4.1" label="Primary platform for this collaboration *" [options]="platformOptions" [control]="form.controls.s4.controls.platform" />
                <cc-text id="4.2" label="Estimated reach for this content *" kind="number" [control]="form.controls.s4.controls.reach"
                  hint="Your honest estimate - views or impressions. This is not a commitment." />
                <cc-choice id="4.3" label="Are you currently running active paid collaborations with competing smartphone brands? *" [options]="noYes" [control]="form.controls.s4.controls.competing"
                  hint="Competing brands include Samsung, Apple, Xiaomi / Redmi, Realme, OnePlus, OPPO, Motorola, Nokia, or any other smartphone manufacturer." />
                @if (vis().competingDetails) {
                  <cc-text id="4.4" label="Disclose the competing brand(s) and nature of the active deal *" kind="textarea" [max]="300" [control]="form.controls.s4.controls.competingDetails"
                    hint="Name the brand(s) and briefly describe the deal (e.g. ongoing retainer, one-time campaign, pending agreement)." />
                }
              </section>

              <!-- SECTION 5 -->
              @if (vis().s5) {
                <section id="sec-5" class="card-dark mb-6 scroll-mt-20 p-5" aria-labelledby="h-5" formGroupName="s5">
                  <h2 id="h-5" class="mb-2 text-xl font-bold">5. Payment Details</h2>
                  <p class="mb-4 text-sm text-vcc-gray-light">
                    Collected now for faster processing if your request is approved. No payment is initiated until the collaboration agreement is signed and content is delivered and approved by FTPL.
                  </p>
                  <cc-text id="5.1" label="Account Holder Name *" [max]="100" [control]="form.controls.s5.controls.holder" hint="Name exactly as on the bank account" />
                  <cc-text id="5.2" label="Bank Name *" [max]="100" [control]="form.controls.s5.controls.bank" hint="e.g. HDFC Bank" />
                  <div class="relative">
                    <cc-text id="5.3" label="Account Number *" [kind]="showAcct() ? 'text' : 'password'" [digits]="true" [max]="18" [control]="form.controls.s5.controls.account" />
                    <button type="button" class="absolute right-2 top-8 rounded p-2 text-vcc-gray-light hover:text-white" (click)="showAcct.set(!showAcct())"
                      [attr.aria-label]="showAcct() ? 'Hide account number' : 'Show account number'" [attr.aria-pressed]="showAcct()">
                      <lucide-icon [img]="showAcct() ? I.EyeOff : I.Eye" [size]="18" />
                    </button>
                  </div>
                  <cc-text id="5.4" label="Confirm Account Number *" [kind]="showAcct() ? 'text' : 'password'" [digits]="true" [max]="18" [control]="form.controls.s5.controls.accountConfirm" />
                  <cc-text id="5.5" label="IFSC Code *" [upper]="true" [max]="11" [control]="form.controls.s5.controls.ifsc" hint="e.g. HDFC0001234" />
                  <cc-choice id="5.6" label="Account Type *" [options]="accountTypeOptions" [control]="form.controls.s5.controls.accountType" />
                  <cc-text id="5.7" label="UPI ID" [optional]="true" [max]="100" [control]="form.controls.s5.controls.upi" hint="e.g. yourname@upi" />
                  @if (vis().gst) {
                    <div class="mb-2" id="f-5.8" tabindex="-1">
                      <span class="field-label">GST Proforma Invoice Upload *</span>
                      <p class="mb-1.5 text-xs text-vcc-gray-light">
                        Upload your GST proforma invoice addressed to: Fangs Technology Pvt Ltd, Tamil Nadu. PDF only, max 5 MB. Your final GST invoice must be submitted after content delivery and FTPL approval. You will be prompted in your dashboard at that stage.
                      </p>
                      <ng-container *ngTemplateOutlet="uploader; context: { key: 'gst', accept: '.pdf,application/pdf', label: 'GST proforma' }" />
                      <p class="field-error" role="alert">{{ gstError() }}</p>
                    </div>
                  }
                </section>
              }

              <!-- SECTION 6 -->
              <section id="sec-6" class="card-dark mb-6 scroll-mt-20 p-5" aria-labelledby="h-6" formGroupName="s6">
                <h2 id="h-6" class="mb-4 text-xl font-bold">{{ sections()[sections().length - 1].n }}. Terms &amp; Conditions</h2>
                @if (!form.controls.s1.controls.supportType.value) {
                  <p class="text-sm text-vcc-gray-light">Choose a support type in Section 1 to load the terms.</p>
                } @else if (termsLoading()) {
                  <div class="grid place-items-center py-8"><vcc-spinner [size]="26" /></div>
                } @else if (termsError()) {
                  <p class="text-sm text-red-300">{{ termsError() }}</p>
                  <button type="button" class="btn-ghost mt-2 px-4 py-1.5 text-sm" (click)="loadTerms()">Retry</button>
                } @else if (terms()) {
                  <div #panel class="max-h-80 overflow-y-scroll rounded-lg border border-white/10 bg-vcc-navy-deep/60 p-4 text-sm" tabindex="0" role="region"
                    aria-label="Terms and conditions" (scroll)="checkScrolled(panel)">
                    @for (c of terms()!.clauses; track c.number) {
                      <h3 class="mt-3 font-semibold first:mt-0">{{ c.number }}. {{ c.title }}</h3>
                      <p class="mt-1 whitespace-pre-line text-vcc-gray-light">{{ c.body }}</p>
                    }
                  </div>
                  @if (!scrolled()) { <p class="mt-2 text-xs text-vcc-gray-light">Scroll to the bottom to enable the checkbox.</p> }
                  <div class="mt-4" id="f-6" tabindex="-1">
                    <label class="flex items-start gap-3 text-sm" [class.opacity-50]="!scrolled()">
                      <input type="checkbox" class="mt-0.5 h-4 w-4 accent-[#0D6EFD]" [checked]="form.controls.s6.controls.agreed.value" [disabled]="!scrolled()"
                        (change)="setAgreed($event)" aria-describedby="e-6" />
                      <span>I have read, understood, and agree to all the terms and conditions stated above.</span>
                    </label>
                    <p class="field-error" id="e-6" role="alert">{{ agreeError() }}</p>
                  </div>
                }
              </section>

              @if (submitError()) {
                <p class="mb-4 rounded-lg border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-200" role="alert">{{ submitError() }}</p>
              }
              <div class="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                <button type="submit" class="btn-primary px-8 py-3 uppercase disabled:cursor-not-allowed disabled:opacity-50" [disabled]="!canSubmit()">
                  @if (submitting()) { <vcc-spinner [size]="18" /> } Submit for review
                </button>
                @if (invalid().length) {
                  <p class="text-sm text-vcc-gray-light" aria-live="polite">
                    {{ invalid().length }} required field{{ invalid().length === 1 ? '' : 's' }} remaining —
                    <button type="button" class="underline hover:text-white" (click)="jumpTo(invalid()[0])">jump to the first one</button>
                  </p>
                } @else if (!form.controls.s6.controls.agreed.value) {
                  <p class="text-sm text-vcc-gray-light">Accept the terms to submit.</p>
                }
              </div>
            </form>
          </div>
        }
      </div>
    </div>

    <ng-template #uploader let-key="key" let-accept="accept" let-label="label">
      @let u = uploads()[key];
      <label class="btn-ghost inline-flex cursor-pointer items-center gap-2 px-4 py-2 text-sm">
        <lucide-icon [img]="I.Upload" [size]="16" /> {{ u?.done ? 'Replace file' : 'Choose file' }}
        <input type="file" class="sr-only" [accept]="accept" (change)="onFile($event, key)" [attr.aria-label]="label" />
      </label>
      @if (u) {
        <div class="mt-2 text-sm" aria-live="polite">
          <span class="inline-flex items-center gap-2"><lucide-icon [img]="I.FileText" [size]="16" /> {{ u.name }}</span>
          @if (!u.done && !u.error) {
            <div class="mt-1 h-1.5 w-48 overflow-hidden rounded-full bg-white/10"><div class="h-full bg-vcc-blue" [style.width.%]="u.progress"></div></div>
          }
          @if (u.done) { <span class="ml-2 text-green-400">Uploaded</span>
            <button type="button" class="ml-3 text-xs underline" (click)="removeFile(key)">Remove</button> }
          @if (u.error) { <p class="field-error" role="alert">{{ u.error }}</p> }
        </div>
      }
    </ng-template>
  `,
})
export class CoCreateComponent implements OnInit, HasUnsavedChanges {
  private api = inject(CoCreateApi);
  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);
  protected readonly I = I;

  protected form = buildForm();
  protected vis = signal(syncForm(this.form));
  protected raw = signal(this.form.getRawValue());
  protected invalid = signal<string[]>([]);
  protected showAcct = signal(false);
  protected submitting = signal(false);
  protected submitted = signal(false);
  protected submitError = signal<string | null>(null);
  protected mine = signal<MyCoCreateRequest[]>([]);
  protected uploads = signal<Record<string, UploadState>>({});
  protected currentIndex = signal(0);

  protected terms = signal<TermsResponse | null>(null);
  protected termsLoading = signal(false);
  protected termsError = signal<string | null>(null);
  protected scrolled = signal(false);

  protected supportOptions = SUPPORT_OPTIONS;
  protected coverOptions = COVER_OPTIONS;
  protected milestoneOptions = MILESTONE_OPTIONS;
  protected yesNo = YES_NO;
  protected noYes = [YES_NO[1], YES_NO[0]];
  protected durationOptions = DURATION_OPTIONS;
  protected locationOptions = LOCATION_OPTIONS;
  protected contentTypeOptions = CONTENT_TYPE_OPTIONS;
  protected featuredOptions = FEATURED_OPTIONS;
  protected reviewDayOptions = REVIEW_DAY_OPTIONS;
  protected platformOptions = PLATFORM_OPTIONS;
  protected accountTypeOptions = ACCOUNT_TYPE_OPTIONS;

  protected tomorrow = addDays(todayIso(), 1);
  protected postMin = computed(() => {
    const s = this.raw().s3.shootDate;
    return isIso(s) ? addDays(s, 2) : this.tomorrow;
  });
  protected selectedTypes = computed(() => CONTENT_TYPE_OPTIONS.filter((o) => this.raw().s3.contentTypes.includes(o.value)));
  protected total = computed(() => totalPieces(this.raw().s3.counts));
  protected blockedReviewDays = computed(() => {
    const { shootDate, postDate } = this.raw().s3;
    return REVIEW_DAY_OPTIONS.filter((o) => !reviewWindowOk(shootDate, postDate, o.value)).map((o) => o.value);
  });
  protected sections = computed(() => {
    const all = [
      { n: 1, title: 'Idea Brief' },
      { n: 2, title: 'Compensation' },
      { n: 3, title: 'Content' },
      { n: 4, title: 'Platform & Audience' },
      ...(this.vis().s5 ? [{ n: 5, title: 'Payment Details' }] : []),
    ];
    return [...all, { n: 6, title: 'Terms' }];
  });
  protected canSubmit = computed(() => this.invalid().length === 0 && !!this.terms() && !this.submitting());

  private lastKey: string | null = null;
  private lastPayload = '';
  private campaignId: string | null = null;
  private draftTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    this.destroyRef.onDestroy(() => clearTimeout(this.draftTimer));
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.refresh());
    this.form.controls.s1.controls.supportType.valueChanges
      .pipe(distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((t) => {
        this.form.controls.s6.controls.agreed.setValue(false, { emitEvent: false });
        this.scrolled.set(false);
        this.terms.set(null);
        if (t) this.loadTerms();
        this.refresh();
      });
  }

  ngOnInit() {
    this.campaignId = this.route.snapshot.queryParamMap.get('campaignId');
    if (loadDraft(this.form)) {
      this.refresh();
      if (this.form.controls.s1.controls.supportType.value) this.loadTerms();
    }
    this.api.mine().then((r) => this.mine.set(r)).catch(() => undefined);
  }

  hasUnsavedChanges() {
    return this.form.dirty && !this.submitted();
  }

  @HostListener('window:beforeunload', ['$event'])
  protected onUnload(e: BeforeUnloadEvent) {
    if (this.hasUnsavedChanges()) e.preventDefault();
  }

  @HostListener('window:scroll')
  protected onScroll() {
    const list = this.sections();
    let idx = 0;
    list.forEach((s, i) => {
      const el = document.getElementById('sec-' + s.n);
      if (el && el.getBoundingClientRect().top <= 140) idx = i;
    });
    if (idx !== this.currentIndex()) this.currentIndex.set(idx);
  }

  private refresh() {
    this.vis.set(syncForm(this.form));
    this.raw.set(this.form.getRawValue());
    this.invalid.set(invalidFieldIds(this.form));
    if (this.currentIndex() >= this.sections().length) this.currentIndex.set(this.sections().length - 1);
    clearTimeout(this.draftTimer);
    this.draftTimer = setTimeout(() => this.form.dirty && !this.submitted() && saveDraft(this.form), 800);
  }

  protected countControl(type: string) {
    return this.form.controls.s3.controls.counts.controls[type];
  }
  protected statusLabel = (r: MyCoCreateRequest) => STATUS_LABEL[r.status] ?? r.status;
  protected agreeError = () => controlError(this.form.controls.s6.controls.agreed);
  protected gstError = () => controlError(this.form.controls.s5.controls.gstProforma);

  protected sectionDone(n: number) {
    return !this.invalid().some((id) => sectionOf(id) === n);
  }

  protected goTo(n: number) {
    document.getElementById('sec-' + n)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  protected jumpTo(fieldId: string) {
    const el = document.getElementById('f-' + fieldId) ?? document.getElementById('sec-' + sectionOf(fieldId));
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const focusable = el?.matches('input,textarea,select,button') ? el : el?.querySelector<HTMLElement>('input,textarea,select,button');
    (focusable ?? (el as HTMLElement | null))?.focus({ preventScroll: true });
    const ctrl = this.form.get(FIELD_PATHS[fieldId]);
    ctrl?.markAllAsTouched();
  }

  // ---- terms

  async loadTerms() {
    const type = this.form.controls.s1.controls.supportType.value;
    if (!type) return;
    this.termsLoading.set(true);
    this.termsError.set(null);
    try {
      const t = await this.api.terms(type);
      if (type !== this.form.controls.s1.controls.supportType.value) return;
      this.terms.set(t);
      this.scrolled.set(false);
      setTimeout(() => {
        const panel = document.querySelector<HTMLElement>('#sec-6 [role=region]');
        if (panel) this.checkScrolled(panel);
      });
    } catch (e) {
      this.termsError.set(errorMessage(e, 'Could not load the terms. Please retry.'));
    } finally {
      this.termsLoading.set(false);
    }
  }

  protected checkScrolled(el: HTMLElement) {
    if (!this.scrolled() && el.scrollTop + el.clientHeight >= el.scrollHeight - 2) this.scrolled.set(true);
  }

  protected setAgreed(e: Event) {
    const c = this.form.controls.s6.controls.agreed;
    c.setValue((e.target as HTMLInputElement).checked);
    c.markAsDirty();
    c.markAsTouched();
  }

  // ---- uploads

  protected onFile(e: Event, key: 'idea' | 'gst') {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const kind: UploadKind = key === 'idea' ? 'idea_doc' : 'gst_proforma';
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    const setState = (s: Partial<UploadState>) =>
      this.uploads.update((u) => ({ ...u, [key]: { ...(u[key] ?? { name: file.name, progress: 0, error: null, done: false }), ...s } }));
    const control = key === 'idea' ? this.form.controls.s1.controls.ideaDoc : this.form.controls.s5.controls.gstProforma;

    const allowed = key === 'idea' ? IDEA_EXT : ['pdf'];
    const max = key === 'idea' ? IDEA_MAX : MAX_UPLOAD_BYTES;
    if (!allowed.includes(ext)) {
      this.uploads.update((u) => ({ ...u, [key]: { name: file.name, progress: 0, done: false, error: `Allowed file types: ${allowed.join(', ')}` } }));
      return;
    }
    if (file.size > max) {
      this.uploads.update((u) => ({ ...u, [key]: { name: file.name, progress: 0, done: false, error: `File is too large (max ${max / 1024 / 1024} MB)` } }));
      return;
    }

    control.setValue(null);
    this.uploads.update((u) => ({ ...u, [key]: { name: file.name, progress: 0, error: null, done: false } }));
    this.api.upload(file, kind).subscribe({
      next: (ev) => {
        if ('progress' in ev) setState({ progress: ev.progress });
        else {
          control.setValue(ev.done.fileId);
          control.markAsDirty();
          setState({ progress: 100, done: true });
        }
      },
      error: (err) => setState({ error: errorMessage(err, 'Upload failed. Please try again.'), done: false }),
    });
  }

  protected removeFile(key: 'idea' | 'gst') {
    (key === 'idea' ? this.form.controls.s1.controls.ideaDoc : this.form.controls.s5.controls.gstProforma).setValue(null);
    this.uploads.update((u) => {
      const { [key]: _gone, ...rest } = u;
      return rest;
    });
  }

  // ---- submit

  async submit() {
    this.form.markAllAsTouched();
    if (!this.canSubmit()) {
      if (this.invalid().length) this.jumpTo(this.invalid()[0]);
      return;
    }
    const body = toPayload(this.form, this.campaignId, this.terms()?.version ?? null);
    const json = JSON.stringify(body);
    if (!this.lastKey || json !== this.lastPayload) {
      this.lastKey = crypto.randomUUID();
      this.lastPayload = json;
    }
    this.submitting.set(true);
    this.submitError.set(null);
    try {
      await this.api.submit(body, this.lastKey);
      this.submitted.set(true);
      clearDraft();
      this.form.markAsPristine();
      this.lastKey = null;
      window.scrollTo({ top: 0, behavior: 'smooth' });
      this.api.mine().then((r) => this.mine.set(r)).catch(() => undefined);
    } catch (e) {
      this.handleSubmitError(e);
    } finally {
      this.submitting.set(false);
    }
  }

  private handleSubmitError(e: unknown) {
    const errors: FieldError[] | undefined = e instanceof HttpErrorResponse && e.status === 422 ? e.error?.errors : undefined;
    if (!errors?.length) {
      this.submitError.set(errorMessage(e, 'Could not submit your request. Please try again.'));
      return;
    }
    this.lastKey = null;
    let first: string | null = null;
    for (const err of errors) {
      const path = FIELD_PATHS[err.field];
      const ctrl = path ? this.form.get(path) : null;
      if (!ctrl) continue;
      ctrl.setErrors({ ...ctrl.errors, server: err.message });
      ctrl.markAsTouched();
      first ??= err.field;
    }
    if (first) setTimeout(() => this.jumpTo(first!));
    else this.submitError.set(errors[0].message);
  }

  protected startNew() {
    this.form.reset();
    this.uploads.set({});
    this.terms.set(null);
    this.submitted.set(false);
    this.refresh();
  }
}
