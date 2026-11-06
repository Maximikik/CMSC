import { Component, HostListener, OnDestroy, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BuilderStore } from '../builder/store';
import { CanvasComponent } from '../builder/canvas';
import { LeftPanelComponent } from '../builder/left-panel';
import { InspectorComponent } from '../builder/inspector';
import { DialogsComponent } from '../builder/dialogs';
import { SafeHtmlPipe } from '../builder/safe-html';
import { ico } from '../builder/icons';

@Component({
  selector: 'sw-editor',
  imports: [RouterLink, CanvasComponent, LeftPanelComponent, InspectorComponent, DialogsComponent, SafeHtmlPipe],
  providers: [BuilderStore],
  template: `
    @if (!store.loaded()) {
      <div class="center-msg">
        @if (store.loadError()) { <p>{{ store.loadError() }}</p><a routerLink="/" class="btn">Back to your sites</a> }
        @else { <p>Loading your site…</p> }
      </div>
    } @else {
      @let rev = store.rev();
      @let m = store.meta()!;
      <div class="app" [attr.data-rev]="rev" [attr.data-pane]="store.pane()" [attr.data-mode]="store.mode()">
        <header class="top">
          <a routerLink="/" class="ib" title="All sites" aria-label="Back to all sites" [innerHTML]="ic('back', 18) | safeHtml"></a>
          <div class="logo"><span class="site-name">{{ m.name }}</span></div>
          <span class="sp"></span>
          @switch (store.save()) {
            @case ('saved') { <span class="mute" role="status">All changes saved</span> }
            @case ('error') { <button type="button" class="btn sm warn-btn" [title]="store.saveMsg()" (click)="store.retrySave()">Not saved. Retry</button> }
            @case ('conflict') { <span class="mute" role="status">Not saved</span> }
            @default { <span class="mute" role="status">Saving…</span> }
          }
          <button type="button" class="ib" title="Undo (Ctrl+Z)" aria-label="Undo" [disabled]="!store.canUndo()" (click)="store.undo()" [innerHTML]="ic('undo') | safeHtml"></button>
          <button type="button" class="ib" title="Redo" aria-label="Redo" [disabled]="!store.canRedo()" (click)="store.redo()" [innerHTML]="ic('redo') | safeHtml"></button>
          <div class="seg dev">
            @for (d of devices; track d) {
              <button type="button" [attr.aria-pressed]="store.device() === d" [attr.aria-label]="d + ' width'" [title]="d + ' width'" (click)="store.device.set(d)" [innerHTML]="ic(d) | safeHtml"></button>
            }
          </div>
          <div class="seg">
            <button type="button" [attr.aria-pressed]="store.mode() === 'edit'" (click)="setMode('edit')"><span [innerHTML]="ic('edit', 14) | safeHtml"></span>Edit</button>
            <button type="button" [attr.aria-pressed]="store.mode() === 'preview'" (click)="setMode('preview')"><span [innerHTML]="ic('play', 14) | safeHtml"></span>Preview</button>
          </div>
          <div class="menu">
            <button type="button" class="btn" aria-haspopup="menu" [attr.aria-expanded]="menu()" (click)="menu.set(!menu())">More</button>
            @if (menu()) {
              <div class="menu-pop" role="menu" (click)="menu.set(false)">
                <button type="button" role="menuitem" (click)="open('templates')">Templates</button>
                <button type="button" role="menuitem" (click)="open('versions')">Version history</button>
                <button type="button" role="menuitem" (click)="open('members')">People with access</button>
                <button type="button" role="menuitem" (click)="open('export')">Export and import</button>
                <button type="button" role="menuitem" (click)="open('settings')">Site settings</button>
              </div>
            }
          </div>
          <button type="button" class="btn pri" (click)="open('publish')">{{ !m.published ? 'Publish' : m.unpublishedChanges ? 'Publish changes' : 'Published' }}</button>
        </header>

        @if (store.save() === 'conflict') {
          <div class="banner" role="alert">{{ store.saveMsg() }} <button type="button" class="btn sm" (click)="reload()">Reload</button></div>
        }

        <aside class="left"><sw-left /></aside>
        <main class="stage" [class.pv]="store.mode() === 'preview'"><sw-canvas /></main>
        <aside class="right"><sw-inspector /></aside>

        <nav class="panes">
          <button type="button" [attr.aria-pressed]="store.pane() === 'left'" (click)="store.pane.set('left')">Pages and elements</button>
          <button type="button" [attr.aria-pressed]="store.pane() === 'canvas'" (click)="store.pane.set('canvas')">Canvas</button>
          <button type="button" [attr.aria-pressed]="store.pane() === 'right'" (click)="store.pane.set('right')">Settings</button>
        </nav>
      </div>
      @if (store.toastMsg()) { <div class="toast" role="status">{{ store.toastMsg() }}</div> }
      <sw-dialogs />
    }
  `,
})
export class EditorPage implements OnDestroy {
  store = inject(BuilderStore);
  menu = signal(false);
  devices: ('desktop' | 'tablet' | 'mobile')[] = ['desktop', 'tablet', 'mobile'];
  ic = (n: string, s = 16) => ico(n, s);

  constructor() {
    const id = inject(ActivatedRoute).snapshot.paramMap.get('id')!;
    this.store.load(id);
  }
  ngOnDestroy() { /* store lives and dies with this page */ }

  setMode(m: 'edit' | 'preview') { this.store.sel.set(null); this.store.mode.set(m); }
  open(k: string) { this.store.dialog.set(k); }
  async reload() { try { await this.store.reloadFromServer(); } catch { location.reload(); } }

  @HostListener('window:beforeunload', ['$event'])
  warnUnsaved(e: BeforeUnloadEvent) { if (this.store.hasUnsaved()) e.preventDefault(); }

  @HostListener('document:keydown', ['$event'])
  keys(e: KeyboardEvent) {
    const a = document.activeElement as HTMLElement | null;
    const typing = !!a && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName));
    const mod = e.metaKey || e.ctrlKey, s = this.store;
    if (e.key === 'Escape') { this.menu.set(false); if (s.sel() && !s.dialog() && !s.confirmState()) s.select(null); return; }
    if (s.mode() !== 'edit' || typing || s.dialog() || s.confirmState()) return;
    const k = e.key.toLowerCase();
    if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? s.redo() : s.undo(); }
    else if (mod && k === 'y') { e.preventDefault(); s.redo(); }
    else if (mod && k === 'd' && s.sel()) { e.preventDefault(); s.duplicateBlock(s.sel()!); }
    else if ((e.key === 'Delete' || e.key === 'Backspace') && s.sel()) { e.preventDefault(); s.deleteBlock(s.sel()!); }
  }
}
