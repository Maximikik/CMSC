export interface Theme { primary: string; bg: string; text: string; font: string; radius: number }
export interface ActionDef { type: string; [k: string]: any }
export interface Block {
  id: string;
  type: string;
  p: Record<string, any>;
  s: Record<string, any>;
  hidden: boolean;
  trigger: string;
  actions: ActionDef[];
}
export interface Page { id: string; name: string; slug: string; title: string; blocks: Block[] }
export interface SiteDoc { name: string; theme: Theme; pages: Page[] }
export interface RenderCtx { edit: boolean; doc: SiteDoc }

export type FieldKind = 'text' | 'area' | 'num' | 'select' | 'check' | 'color' | 'image' | 'page' | 'block' | 'list';
export interface FieldDef {
  k: string;
  l: string;
  t: FieldKind;
  o?: [string, string][];
  ph?: string;
  help?: string;
  rows?: number;
  min?: number;
  max?: number;
  def?: string;
  only?: string;
  blank?: boolean;
  sub?: FieldDef[];
  make?: (doc: SiteDoc) => any;
  when?: (item: any) => boolean;
}
