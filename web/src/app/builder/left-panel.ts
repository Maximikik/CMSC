import { Component, inject } from '@angular/core';
import { BuilderStore } from './store';
import { GROUPS, TYPES } from './types';
import { ico } from './icons';
import { SafeHtmlPipe } from './safe-html';

@Component({
  selector: 'sw-left',
  imports: [SafeHtmlPipe],
  template: `
    @let rev = store.rev();
    <div class="stack" [attr.data-rev]="rev">
    <section class="pnl">
      <div class="pnl-h">
        <span class="h">Pages</span>
        <button type="button" class="btn sm" (click)="store.addPage()"><span [innerHTML]="ic('plus', 14) | safeHtml"></span> Page</button>
      </div>
      <ul class="pages">
        @for (p of store.doc.pages; track p.id; let i = $index) {
          <li class="pg" [class.on]="p.id === store.pageId()">
            <button type="button" class="pg-n" (click)="store.switchPage(p.id)">{{ p.name }}@if (i === 0) { <span class="tag">Home</span> }</button>
            <button type="button" class="ib" title="Duplicate page" [attr.aria-label]="'Duplicate page ' + p.name" (click)="store.duplicatePage(p.id)" [innerHTML]="ic('copy', 15) | safeHtml"></button>
            <button type="button" class="ib" title="Delete page" [attr.aria-label]="'Delete page ' + p.name" [disabled]="store.doc.pages.length < 2" (click)="store.deletePage(p.id)" [innerHTML]="ic('trash', 15) | safeHtml"></button>
          </li>
        }
      </ul>
    </section>
    <section class="pnl">
      <div class="pnl-h"><span class="h">Add element</span></div>
      <p class="help">Click to add below the selected element, or drag onto the page.</p>
      @for (g of groups; track g[0]) {
        <div class="grp">
          <span class="h grp-t">{{ g[0] }}</span>
          @for (t of g[1]; track t) {
            <button type="button" class="chip" draggable="true" (click)="add(t)" (dragstart)="drag($event, t)">
              <span [innerHTML]="ic(types[t].icon, 16) | safeHtml"></span><span>{{ types[t].label }}</span>
            </button>
          }
        </div>
      }
    </section>
    </div>
  `,
})
export class LeftPanelComponent {
  store = inject(BuilderStore);
  groups = GROUPS;
  types = TYPES;
  ic = (n: string, s = 16) => ico(n, s);
  add(t: string) { this.store.addBlock(t); this.store.pane.set('canvas'); }
  drag(e: DragEvent, t: string) { e.dataTransfer?.setData('text/plain', 'add:' + t); if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copy'; }
}
