import { ChangeDetectorRef, Component, computed, effect, inject, input, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService, errMsg } from '../core/api';
import { FieldDef } from './model';
import { Root, BuilderStore } from './store';
import { ico } from './icons';
import { uid } from './util';
import { SafeHtmlPipe } from './safe-html';

/** One editable field. Lists render their rows with this same component, so nesting just works. */
@Component({
  selector: 'sw-field',
  imports: [SafeHtmlPipe],
  template: `
    @let f = field();
    @let v = val();
    @switch (f.t) {
      @case ('check') {
        <label class="chk"><input type="checkbox" [checked]="!!v" (change)="set($any($event.target).checked)"> {{ f.l }}</label>
      }
      @default {
        <div class="fld" [class.warn]="missing()">
          <label [attr.for]="id">{{ f.l }}</label>
          @switch (f.t) {
            @case ('text') { <input type="text" [id]="id" [value]="v ?? ''" [placeholder]="f.ph ?? ''" (input)="set($any($event.target).value)"> }
            @case ('area') { <textarea [id]="id" [rows]="f.rows ?? 3" [value]="v ?? ''" (input)="set($any($event.target).value)"></textarea> }
            @case ('num') { <input type="number" [id]="id" [value]="v ?? ''" [attr.min]="f.min ?? null" [attr.max]="f.max ?? null" [placeholder]="f.ph ?? ''" (input)="setNum($any($event.target).value)"> }
            @case ('select') {
              <select [id]="id" (change)="set($any($event.target).value)">
                @for (o of f.o ?? []; track o[0]) { <option [value]="o[0]" [selected]="o[0] === (v ?? '') + ''">{{ o[1] }}</option> }
              </select>
            }
            @case ('color') {
              <div class="colr">
                <input type="color" [id]="id" [value]="v || f.def || '#ffffff'" (input)="set($any($event.target).value)">
                <span>{{ v || 'Default' }}</span>
                @if (v && resettable()) { <button type="button" class="btn sm" (click)="set('')">Reset</button> }
              </div>
            }
            @case ('page') {
              <select [id]="id" (change)="set($any($event.target).value)">
                @if (!pageExists(v)) { <option value="" selected>Choose a page…</option> }
                @for (p of store.doc.pages; track p.id) { <option [value]="p.id" [selected]="p.id === v">{{ p.name }}</option> }
              </select>
            }
            @case ('block') {
              <select [id]="id" (change)="set($any($event.target).value)">
                @if (v && !blockExists(v)) { <option [value]="v" selected>Missing element</option> }
                @if (f.blank) { <option value="" [selected]="!v">Whichever is open</option> }
                @else if (!v) { <option value="" selected>Choose an element…</option> }
                @for (o of store.blockOptions(f.only); track o[0]) { <option [value]="o[0]" [selected]="o[0] === v">{{ o[1] }}</option> }
              </select>
              @if (missing()) { <p class="help">Pick an element on this page.</p> }
            }
            @case ('image') {
              <div class="up">
                <input type="text" [id]="id" [value]="isData(v) ? '' : (v ?? '')" [placeholder]="isData(v) ? 'Built-in picture' : 'https://… or upload'" (input)="set($any($event.target).value)">
                <label class="btn sm" [attr.for]="id + 'u'">{{ busy() ? 'Uploading…' : 'Upload' }}</label>
                <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" class="vh" [id]="id + 'u'" (change)="upload($event)">
              </div>
              <div class="row-gap">
                <button type="button" class="btn sm" (click)="library()">Choose from library</button>
                @if (v) { <button type="button" class="btn sm" (click)="set('')">Remove image</button> }
              </div>
            }
            @case ('list') {
              <div class="list">
                @for (it of arr(); track $index; let i = $index; let last = $last) {
                  <div class="li">
                    <div class="li-h">
                      <span class="h">{{ f.l }} {{ i + 1 }}</span>
                      <span>
                        <button type="button" class="ib" [disabled]="i === 0" aria-label="Move up" (click)="store.listMove(root(), dp(), i, -1)" [innerHTML]="ic('up') | safeHtml"></button>
                        <button type="button" class="ib" [disabled]="last" aria-label="Move down" (click)="store.listMove(root(), dp(), i, 1)" [innerHTML]="ic('down') | safeHtml"></button>
                        <button type="button" class="ib" aria-label="Remove" (click)="store.listRemove(root(), dp(), i)" [innerHTML]="ic('trash') | safeHtml"></button>
                      </span>
                    </div>
                    @for (s of f.sub ?? []; track s.k) {
                      @if (!s.when || s.when(it)) { <sw-field [field]="s" [obj]="it" [root]="root()" [path]="dp() + '.' + i" /> }
                    }
                  </div>
                }
                <button type="button" class="btn sm" (click)="store.listAdd(dp(), f.k)"><span [innerHTML]="ic('plus') | safeHtml"></span> Add</button>
              </div>
            }
          }
          @if (f.help) { <p class="help">{{ f.help }}</p> }
        </div>
      }
    }
  `,
})
export class FieldComponent {
  field = input.required<FieldDef>();
  obj = input.required<any>();
  root = input.required<Root>();
  path = input('');
  store = inject(BuilderStore);
  private api = inject(ApiService);
  id = 'f' + uid();
  busy = signal(false);
  private cdr = inject(ChangeDetectorRef);

  constructor() {
    // Fields read plain objects that the store edits in place, so ask to be re-checked whenever the store says something changed.
    effect(() => { this.store.rev(); this.cdr.markForCheck(); });
  }

  dp = computed(() => (this.path() ? this.path() + '.' + this.field().k : this.field().k));
  arr = (): any[] => this.val() ?? [];
  val() { return this.obj()?.[this.field().k]; }
  ic = (n: string) => ico(n, 14);
  isData = (v: any) => typeof v === 'string' && v.startsWith('data:');
  pageExists = (id: any) => this.store.doc.pages.some(p => p.id === id);
  blockExists = (id: any) => this.store.page().blocks.some(b => b.id === id);
  /** Colors can be reset to "default" for blocks, but site theme colors always need a value. */
  resettable = () => this.root() !== 's';
  missing() {
    const f = this.field(), v = this.val();
    if (f.t === 'block') return (v && !this.blockExists(v)) || (!v && !f.blank);
    return false;
  }

  set(v: any) { this.store.setValue(this.root(), this.dp(), v); }
  setNum(raw: string) { this.set(raw === '' ? '' : +raw); }

  library() { this.store.mediaTarget = { root: this.root(), path: this.dp() }; this.store.dialog.set('media'); }
  async upload(e: Event) {
    const inp = e.target as HTMLInputElement, file = inp.files?.[0];
    if (!file) return;
    this.busy.set(true);
    try { this.set((await firstValueFrom(this.api.upload(this.store.siteId, file))).url); }
    catch (err) { this.store.notify(errMsg(err, 'The image could not be uploaded.')); }
    finally { this.busy.set(false); inp.value = ''; }
  }
}
