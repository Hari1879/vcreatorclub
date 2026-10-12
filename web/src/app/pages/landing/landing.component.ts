import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { VccLogoComponent } from '../../shared/ui.components';
import { I } from '../../shared/icons';
import { DISCLAIMER } from '../../core/constants';

@Component({
  selector: 'vcc-landing',
  standalone: true,
  imports: [VccLogoComponent, LucideAngularModule, RouterLink],
  template: `
    <!-- Sticky top bar: logo + single JOIN VCC button (no nav links) -->
    <header class="fixed inset-x-0 top-0 z-30 transition-colors"
            [class.bg-vcc-navy-deep]="scrolled()" [class.shadow-lg]="scrolled()">
      <div class="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <vcc-logo [width]="180" />
        <a href="#join" class="btn-primary px-5 text-sm">Join VCC</a>
      </div>
    </header>

    <!-- 1. Hero -->
    <section class="bg-hero relative flex min-h-[100svh] items-center overflow-hidden px-4 pb-16 pt-24 text-center">
      <div class="pointer-events-none absolute inset-0" aria-hidden="true">
        <div class="animate-drift absolute left-1/2 top-[18%] h-72 w-72 -translate-x-1/2 rounded-full bg-vcc-blue/30 blur-3xl"></div>
        <div class="animate-drift absolute bottom-[10%] left-[8%] h-56 w-56 rounded-full bg-vcc-blue-dark/30 blur-3xl [animation-delay:-3s]"></div>
        <div class="animate-drift absolute right-[6%] top-[30%] h-48 w-48 rounded-full bg-vcc-blue-light/20 blur-3xl [animation-delay:-6s]"></div>
        <div class="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(#42A5F5_1px,transparent_1px),linear-gradient(90deg,#42A5F5_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]"></div>
      </div>
      <div class="relative mx-auto max-w-4xl">
        <vcc-logo [width]="360" class="mx-auto block w-fit" />
        <p class="heading mt-4 text-3xl font-bold tracking-[0.2em] text-white">VCC</p>
        <h1 class="text-gradient-blue mt-2 text-5xl font-bold leading-none xs:text-6xl sm:text-7xl md:text-8xl">
          V Creater Club
        </h1>
        <p class="mt-5 text-lg text-white sm:text-xl">Tamil Nadu's Creator Ecosystem · By Invitation Only</p>
        <a href="#join" class="btn-primary mt-9 px-10 py-4 text-lg shadow-lg shadow-vcc-blue/40">
          Join VCC <lucide-icon [img]="I.ArrowRight" [size]="20" />
        </a>
      </div>
      <a href="#about" class="absolute bottom-6 left-1/2 -translate-x-1/2 text-[11px] uppercase tracking-[0.3em] text-vcc-gray-light/70">
        Scroll to explore
      </a>
    </section>

    <!-- 2. What is VCC -->
    <section id="about" class="bg-white px-4 py-20 sm:px-6">
      <div class="mx-auto max-w-6xl">
        <h2 class="text-center text-4xl font-bold text-vcc-navy sm:text-5xl">What is VCC</h2>
        <div class="mx-auto mt-3 h-1 w-14 rounded bg-vcc-blue"></div>
        <div class="mt-12 grid gap-5 md:grid-cols-3">
          @for (c of whatIs; track c.title) {
            <div class="card-light p-7 text-center">
              <lucide-icon [img]="c.icon" [size]="44" class="mx-auto block w-fit text-vcc-blue" />
              <h3 class="mt-4 text-xl font-bold text-vcc-navy">{{ c.title }}</h3>
              <p class="mt-2 text-gray-600">{{ c.text }}</p>
            </div>
          }
        </div>
      </div>
    </section>

    <!-- 3. Creator Benefits -->
    <section class="bg-vcc-navy px-4 py-20 sm:px-6">
      <div class="mx-auto max-w-6xl">
        <h2 class="text-center text-4xl font-bold text-white sm:text-5xl">Creator Benefits</h2>
        <div class="mx-auto mt-3 h-1 w-14 rounded bg-vcc-blue"></div>
        <div class="mt-12 grid gap-5 md:grid-cols-2">
          @for (b of benefits; track b.title) {
            <div class="card-dark flex gap-5 p-6">
              <span class="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-vcc-blue/15 text-vcc-blue-light">
                <lucide-icon [img]="b.icon" [size]="30" />
              </span>
              <div>
                <h3 class="text-xl font-bold text-white">{{ b.title }}</h3>
                <p class="mt-1 text-vcc-gray-light">{{ b.text }}</p>
              </div>
            </div>
          }
        </div>
        <p class="mx-auto mt-8 max-w-3xl text-center text-xs text-vcc-gray-light/80">{{ disclaimer }}</p>
      </div>
    </section>

    <!-- 4. Who can join -->
    <section id="join" class="scroll-mt-16 bg-white px-4 py-20 sm:px-6">
      <div class="mx-auto max-w-4xl text-center">
        <h2 class="text-4xl font-bold text-vcc-navy sm:text-5xl">Who Can Join</h2>
        <div class="mx-auto mt-3 h-1 w-14 rounded bg-vcc-blue"></div>
        <ul class="mt-10 grid gap-3 text-left sm:grid-cols-2">
          @for (e of eligibility; track e) {
            <li class="card-light flex items-center gap-3 px-5 py-4">
              <span class="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-vcc-blue/10 text-vcc-blue">
                <lucide-icon [img]="I.Check" [size]="18" />
              </span>
              <span class="font-medium text-gray-800">{{ e }}</span>
            </li>
          }
        </ul>
        <div class="mt-8 flex items-start gap-3 rounded-xl border border-vcc-blue/30 bg-vcc-blue/5 p-5 text-left">
          <lucide-icon [img]="I.QrCode" [size]="28" class="shrink-0 text-vcc-blue" />
          <p class="text-gray-700">
            VCC enrollment is by invitation only. You will need a personal QR code to access the enrollment form.
          </p>
        </div>
        <p class="mt-8 text-sm text-gray-500">
          Already enrolled?
          <a routerLink="/dashboard" class="font-semibold text-vcc-blue hover:underline">Sign in to your dashboard</a>
        </p>
      </div>
    </section>

    <!-- Footer: VCC logo + FTPL text only. No social links, no Vivo logo. -->
    <footer class="bg-vcc-navy-deep px-4 py-10 text-center">
      <vcc-logo [width]="180" class="mx-auto block w-fit" />
      <p class="mt-5 text-sm text-white">A Creator Initiative by FTPL · Tamil Nadu</p>
      <p class="mt-1 text-xs text-vcc-gray-light">
        Powered by Fangs Technology Pvt Ltd — Authorised Vivo India Super Stockist, Tamil Nadu
      </p>
    </footer>
  `,
  host: { '(window:scroll)': 'scrolled.set(windowScrollY() > 40)' },
})
export class LandingComponent {
  protected readonly I = I;
  protected readonly disclaimer = DISCLAIMER;
  protected scrolled = signal(false);
  protected windowScrollY = () => window.scrollY;

  protected whatIs = [
    {
      icon: I.Users,
      title: 'A Creator Community',
      text: 'A curated community of passionate content creators across Tamil Nadu.',
    },
    {
      icon: I.Gem,
      title: 'Exclusive Experiences',
      text: 'Priority access to Vivo product launches, creator events, and special programs.',
    },
    {
      icon: I.Handshake,
      title: 'Grow Together',
      text: 'Collaborate with Vivo and FTPL on campaigns, products, and content opportunities.',
    },
  ];

  protected benefits = [
    { icon: I.Package, title: 'Product Access', text: 'Priority consideration for early access to new Vivo devices' },
    {
      icon: I.TrendingUp,
      title: 'Business Opportunity',
      text: 'Priority consideration for Vivo campaign collaborations and creator projects',
    },
    { icon: I.Users, title: 'Creator Support', text: 'Dedicated support from the VCC team for your content journey' },
    {
      icon: I.Megaphone,
      title: 'Brand Amplification',
      text: 'Priority consideration for your content to be amplified across Vivo and FTPL channels',
    },
  ];

  protected eligibility = [
    'Tamil Nadu based',
    'Active content creator',
    'Instagram or YouTube presence',
    'Minimum 5,000 followers',
  ];
}
