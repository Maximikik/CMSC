import { Pipe, PipeTransform, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

/** Only used for the app's own inline SVG icons (see icons.ts). Never pass user content through this. */
@Pipe({ name: 'safeHtml' })
export class SafeHtmlPipe implements PipeTransform {
  private s = inject(DomSanitizer);
  transform(v: string): SafeHtml { return this.s.bypassSecurityTrustHtml(v); }
}
