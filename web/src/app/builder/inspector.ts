import { Component, inject } from '@angular/core';
import { BuilderStore } from './store';
import { FieldComponent } from './field';
import { FONTS } from './util';
import { ACT, STYLE_FIELDS, TRIGGERS, TYPES } from './types';
import { FieldDef } from './model';
import { ico } from './icons';
import { SafeHtmlPipe } from './safe-html';

@Component({
  selector: 'sw-inspector',
  imports: [FieldComponent, SafeHtmlPipe],
  template: `
    @let rev = store.rev();
    @let b = store.selected();
    <div class="stack" [attr.data-rev]="rev">
    @if (!b) {
      <div class="ins-h"><span class="h">Page</span></div>
      <div class="ins-b">
        <sw-field [field]="nameF" [obj]="store.page()" root="g" />
        <div class="fld">
          <label for="slug">Address (in the published site: #address)</label>
          <input id="slug" type="text" [value]="store.page().slug" (change)="store.setSlug($any($event.target).value)">
        </div>
        <sw-field [field]="titleF" [obj]="store.page()" root="g" />
        @if (store.doc.pages[0].id !== store.page().id) { <button type="button" class="btn" (click)="store.makeHome()">Make this the home page</button> }
        @else { <p class="help">This is the home page. It opens first.</p> }
      </div>
      <div class="ins-h"><span class="h">Site design</span></div>
      <div class="ins-b">
        <sw-field [field]="fontF" [obj]="store.doc.theme" root="s" path="theme" />
        <sw-field [field]="primaryF" [obj]="store.doc.theme" root="s" path="theme" />
        <sw-field [field]="bgF" [obj]="store.doc.theme" root="s" path="theme" />
        <sw-field [field]="textF" [obj]="store.doc.theme" root="s" path="theme" />
        <sw-field [field]="radiusF" [obj]="store.doc.theme" root="s" path="theme" />
        <p class="help">Click anything on the canvas to edit it. Select a button, then open its Actions tab to make it do something.</p>
      </div>
    } @else {
      @let T = types[b.type];
      <div class="ins-h">
        <span class="h">{{ T.label }}</span>
        <span>
          <button type="button" class="ib" title="Duplicate" aria-label="Duplicate element" (click)="store.duplicateBlock(b.id)" [innerHTML]="ic('copy') | safeHtml"></button>
          <button type="button" class="ib" title="Delete" aria-label="Delete element" (click)="store.deleteBlock(b.id)" [innerHTML]="ic('trash') | safeHtml"></button>
        </span>
      </div>
      <div class="tabs" role="tablist">
        @for (t of tabsFor(T.acts); track t[0]) {
          <button type="button" role="tab" [attr.aria-selected]="tabNow(T.acts) === t[0]" (click)="store.tab.set($any(t[0]))">
            {{ t[1] }}@if (t[0] === 'actions' && b.actions.length) { <span class="badge">{{ b.actions.length }}</span> }
          </button>
        }
      </div>
      <div class="ins-b">
        @switch (tabNow(T.acts)) {
          @case ('content') {
            @for (f of T.fields; track f.k) { <sw-field [field]="f" [obj]="b.p" root="b" path="p" /> }
            @if (!T.fields.length) { <p class="help">Nothing to edit here.</p> }
          }
          @case ('style') {
            @for (f of styleFields; track f.k) { <sw-field [field]="f" [obj]="b.s" root="b" path="s" /> }
            @if (b.type !== 'popup') { <sw-field [field]="hiddenF" [obj]="b" root="b" /> }
          }
          @case ('actions') {
            @if (b.type !== 'form' && b.type !== 'popup') {
              <div class="fld">
                <label for="trg">When</label>
                <select id="trg" (change)="store.setValue('b', 'trigger', $any($event.target).value)">
                  @for (t of triggers; track t[0]) { <option [value]="t[0]" [selected]="t[0] === b.trigger">{{ t[1] }}</option> }
                </select>
              </div>
            }
            <p class="help">{{ b.type === 'form' ? 'When the form is sent, do this in order:' : b.type === 'popup' ? 'When its button is clicked, it closes and also does this:' : 'Then do this, in order:' }}</p>
            @for (a of b.actions; track $index; let i = $index; let last = $last) {
              <div class="act">
                <div class="act-h">
                  <span class="num">{{ i + 1 }}</span>
                  <select [attr.aria-label]="'Action ' + (i + 1)" (change)="store.retypeAction(i, $any($event.target).value)">
                    @for (k of actKeys; track k) { <option [value]="k" [selected]="k === a.type">{{ act[k].l }}</option> }
                  </select>
                  <span>
                    <button type="button" class="ib" [disabled]="i === 0" aria-label="Move up" (click)="store.listMove('b', 'actions', i, -1)" [innerHTML]="ic('up') | safeHtml"></button>
                    <button type="button" class="ib" [disabled]="last" aria-label="Move down" (click)="store.listMove('b', 'actions', i, 1)" [innerHTML]="ic('down') | safeHtml"></button>
                    <button type="button" class="ib" aria-label="Remove action" (click)="store.listRemove('b', 'actions', i)" [innerHTML]="ic('trash') | safeHtml"></button>
                  </span>
                </div>
                @for (f of act[a.type]?.f ?? []; track f.k) { <sw-field [field]="f" [obj]="a" root="b" [path]="'actions.' + i" /> }
              </div>
            } @empty {
              <div class="empty-acts">No actions yet. Add one below, for example "Go to a page" or "Open a popup".</div>
            }
            <div class="fld">
              <select aria-label="Add an action" #add (change)="store.addAction(add.value); add.value = ''">
                <option value="">+ Add an action…</option>
                @for (k of actKeys; track k) { <option [value]="k">{{ act[k].l }}</option> }
              </select>
            </div>
          }
        }
      </div>
    }
    </div>
  `,
})
export class InspectorComponent {
  store = inject(BuilderStore);
  types = TYPES;
  act = ACT;
  actKeys = Object.keys(ACT);
  triggers = TRIGGERS;
  styleFields = STYLE_FIELDS;
  ic = (n: string) => ico(n, 15);

  nameF: FieldDef = { k: 'name', l: 'Page name', t: 'text' };
  titleF: FieldDef = { k: 'title', l: 'Browser tab title', t: 'text', ph: 'Same as the page name' };
  hiddenF: FieldDef = { k: 'hidden', l: 'Hidden until an action shows it', t: 'check' };
  fontF: FieldDef = { k: 'font', l: 'Font', t: 'select', o: Object.keys(FONTS).map(f => [f, f] as [string, string]) };
  primaryF: FieldDef = { k: 'primary', l: 'Accent color (buttons, links)', t: 'color' };
  bgF: FieldDef = { k: 'bg', l: 'Page background', t: 'color' };
  textF: FieldDef = { k: 'text', l: 'Text color', t: 'color' };
  radiusF: FieldDef = { k: 'radius', l: 'Corner roundness (px)', t: 'num', min: 0, max: 40 };

  tabsFor(acts: boolean): [string, string][] {
    const t: [string, string][] = [['content', 'Content'], ['style', 'Style']];
    if (acts) t.push(['actions', 'Actions']);
    return t;
  }
  /** A block type without actions never shows the Actions tab, even if it was open on the previous selection. */
  tabNow(acts: boolean) { const t = this.store.tab(); return t === 'actions' && !acts ? 'content' : t; }
}
