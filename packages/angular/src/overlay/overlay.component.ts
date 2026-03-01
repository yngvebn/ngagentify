import {
  Component,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  HostListener,
  OnInit,
  ViewChild,
  ElementRef,
  inject,
} from '@angular/core';
import { JsonPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InspectorService } from '../inspector.service';
import { BridgeService } from '../bridge.service';
import type { Annotation, ComponentContext, AnnotationStatus } from '../types';

type OverlayMode = 'hidden' | 'inspect' | 'annotate' | 'thread' | 'preview';

interface HighlightRect {
  top: string;
  left: string;
  width: string;
  height: string;
}

interface AnnotationBadge {
  annotation: Annotation;
  top: string;
  left: string;
  icon: string;
  label: string;
}

@Component({
  selector: 'nga-overlay',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [JsonPipe, FormsModule],
  styles: [`
    :host {
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      pointer-events: none; z-index: 9999;
    }
    .nga-highlight-rect {
      position: fixed; border: 2px solid #3b82f6;
      background: rgba(59,130,246,0.1); pointer-events: none;
      transition: top 0.05s, left 0.05s, width 0.05s, height 0.05s;
    }
    .nga-component-label {
      position: absolute; top: -22px; left: 0; background: #1e293b; color: #f8fafc;
      font-family: monospace; font-size: 11px; padding: 2px 6px;
      border-radius: 3px; white-space: nowrap;
    }
    .nga-annotate-panel, .nga-thread-panel {
      pointer-events: all; position: fixed; right: 16px; top: 50%;
      transform: translateY(-50%); background: #ffffff; border: 1px solid #e2e8f0;
      border-radius: 8px; box-shadow: 0 4px 24px rgba(0,0,0,0.15);
      padding: 16px; min-width: 320px; max-width: 400px;
    }
    .nga-panel-title {
      margin: 0 0 12px; font-size: 14px; font-weight: 600;
      color: #1e293b; font-family: monospace;
    }
    .nga-inputs { margin-bottom: 10px; }
    .nga-input-row {
      display: flex; gap: 8px; font-size: 12px;
      font-family: monospace; margin-bottom: 4px;
    }
    .nga-input-key { color: #64748b; min-width: 80px; }
    .nga-input-val {
      color: #1e293b; overflow: hidden;
      text-overflow: ellipsis; white-space: nowrap;
    }
    .nga-selection {
      font-size: 12px; color: #475569; margin-bottom: 8px; font-style: italic;
    }
    .nga-textarea, .nga-reply-input {
      width: 100%; box-sizing: border-box; border: 1px solid #cbd5e1;
      border-radius: 4px; padding: 8px; font-size: 13px;
      font-family: inherit; resize: vertical; margin-bottom: 10px;
    }
    .nga-textarea:focus, .nga-reply-input:focus {
      outline: none; border-color: #3b82f6;
    }
    .nga-actions { display: flex; gap: 8px; }
    .nga-btn {
      padding: 6px 14px; border-radius: 4px; font-size: 13px;
      cursor: pointer; border: none; transition: opacity 0.15s;
    }
    .nga-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .nga-btn-submit { background: #3b82f6; color: #ffffff; }
    .nga-btn-cancel { background: #f1f5f9; color: #475569; }
    .nga-replies { max-height: 200px; overflow-y: auto; margin-bottom: 10px; }
    .nga-reply { display: flex; gap: 8px; margin-bottom: 8px; font-size: 13px; }
    .nga-reply-author { font-weight: 600; min-width: 48px; }
    .nga-reply-author--agent { color: #7c3aed; }
    .nga-reply-author--user { color: #2563eb; }
    .nga-badge {
      pointer-events: all; position: fixed; width: 18px; height: 18px;
      border-radius: 50%; display: flex; align-items: center;
      justify-content: center; font-size: 10px; cursor: pointer;
      transform: translate(-50%, -50%);
    }
    .nga-badge--pending { background: #3b82f6; color: #ffffff; }
    .nga-badge--acknowledged { background: #f59e0b; color: #ffffff; }
    .nga-badge--diff_proposed { background: #8b5cf6; color: #ffffff; }
    .nga-badge--resolved { background: #22c55e; color: #ffffff; }
    .nga-badge--dismissed { background: #94a3b8; color: #ffffff; }
    .nga-preview-panel {
      pointer-events: all; position: fixed; right: 16px; top: 50%;
      transform: translateY(-50%); background: #ffffff; border: 1px solid #e2e8f0;
      border-radius: 8px; box-shadow: 0 4px 24px rgba(0,0,0,0.15);
      padding: 16px; min-width: 480px; max-width: 600px;
    }
    .nga-preview-subtitle {
      font-size: 12px; color: #475569; margin: 0 0 10px;
    }
    .nga-diff {
      font-family: monospace; font-size: 12px; overflow-x: auto;
      max-height: 380px; overflow-y: auto; border: 1px solid #e2e8f0;
      border-radius: 4px; margin-bottom: 12px;
    }
    .nga-diff-line {
      display: block; padding: 1px 8px; white-space: pre; line-height: 1.5;
    }
    .nga-diff-line--add { background: rgba(34,197,94,0.12); color: #166534; }
    .nga-diff-line--remove { background: rgba(239,68,68,0.12); color: #991b1b; }
    .nga-diff-line--hunk { background: rgba(59,130,246,0.08); color: #1e40af; }
    .nga-btn-approve { background: #22c55e; color: #ffffff; }
    .nga-btn-reject { background: #ef4444; color: #ffffff; }
    .nga-keyboard-hint {
      pointer-events: none; position: fixed; bottom: 16px; right: 16px;
      background: rgba(15,23,42,0.7); color: #f8fafc; font-size: 12px;
      padding: 6px 10px; border-radius: 6px;
    }
    .nga-keyboard-hint kbd {
      background: rgba(255,255,255,0.15); border-radius: 3px;
      padding: 1px 5px; font-family: monospace;
    }
  `],
  template: `
    <!-- Keyboard hint -->
    @if (mode === 'hidden') {
      <div class="nga-keyboard-hint">
        <kbd>Alt+Shift+A</kbd> to annotate
      </div>
    }
    @if (mode === 'inspect') {
      <div class="nga-keyboard-hint">
        Click a component &nbsp; <kbd>Esc</kbd> to cancel
      </div>
    }

    <!-- Inspect highlight rect -->
    @if (mode === 'inspect' && hoveredContext !== null && highlightRect !== null) {
      <div
        class="nga-highlight-rect"
        [style.top]="highlightRect.top"
        [style.left]="highlightRect.left"
        [style.width]="highlightRect.width"
        [style.height]="highlightRect.height"
      >
        <span class="nga-component-label">{{ hoveredContext.componentName }}</span>
      </div>
    }

    <!-- Annotate panel -->
    @if (mode === 'annotate' && selectedContext !== null) {
      <div class="nga-annotate-panel">
        <h3 class="nga-panel-title">{{ selectedContext.componentName }}</h3>

        @if (inputEntries().length > 0) {
          <div class="nga-inputs">
            @for (entry of inputEntries(); track entry.key) {
              <div class="nga-input-row">
                <span class="nga-input-key">{{ entry.key }}:</span>
                <span class="nga-input-val">{{ entry.value | json }}</span>
              </div>
            }
          </div>
        }

        @if (selectionText) {
          <div class="nga-selection">
            <em>"{{ selectionText }}"</em>
          </div>
        }

        <textarea
          #textArea
          class="nga-textarea"
          [(ngModel)]="annotationText"
          placeholder="Describe the change..."
          rows="4"
          (keydown.shift.enter)="$event.preventDefault(); submit()"
        ></textarea>

        <div class="nga-actions">
          <button class="nga-btn nga-btn-submit" (click)="submit()" [disabled]="annotationText.trim() === ''">
            Submit <small style="opacity:0.7;font-size:11px">Shift+Enter</small>
          </button>
          <button class="nga-btn nga-btn-cancel" (click)="cancel()">Cancel</button>
        </div>
      </div>
    }

    <!-- Diff preview panel -->
    @if (mode === 'preview' && diffAnnotation !== null) {
      <div class="nga-preview-panel">
        <h3 class="nga-panel-title">{{ diffAnnotation.componentName }}</h3>
        <p class="nga-preview-subtitle">Review proposed changes — Apply or Reject:</p>

        <div class="nga-diff">
          @for (line of diffLines(); track $index) {
            <span class="nga-diff-line nga-diff-line--{{ line.type }}">{{ line.text }}</span>
          }
        </div>

        <div class="nga-actions">
          <button class="nga-btn nga-btn-approve" (click)="approveDiff()">Apply</button>
          <button class="nga-btn nga-btn-reject" (click)="rejectDiff()">Reject</button>
          <button class="nga-btn nga-btn-cancel" (click)="closePreview()">Close</button>
        </div>
      </div>
    }

    <!-- Thread panel -->
    @if (mode === 'thread' && threadAnnotation !== null) {
      <div class="nga-thread-panel">
        <h3 class="nga-panel-title">{{ threadAnnotation.componentName }}</h3>

        <div class="nga-replies">
          @for (reply of threadAnnotation.replies; track reply.message) {
            <div class="nga-reply">
              <span class="nga-reply-author nga-reply-author--{{ reply.author }}">{{ reply.author }}</span>
              <span class="nga-reply-text">{{ reply.message }}</span>
            </div>
          }
        </div>

        <input
          class="nga-reply-input"
          type="text"
          [(ngModel)]="replyText"
          placeholder="Reply..."
          (keydown.enter)="sendReply()"
        />

        <div class="nga-actions">
          <button class="nga-btn nga-btn-submit" (click)="sendReply()" [disabled]="replyText.trim() === ''">
            Send
          </button>
          <button class="nga-btn nga-btn-cancel" (click)="closeThread()">Close</button>
        </div>
      </div>
    }

    <!-- Annotation badges -->
    @for (badge of badges; track badge.annotation.id) {
      <div
        class="nga-badge nga-badge--{{ badge.annotation.status }}"
        [style.top]="badge.top"
        [style.left]="badge.left"
        (click)="openThread(badge.annotation)"
        [title]="badge.label"
      >
        {{ badge.icon }}
      </div>
    }
  `,
})
export class OverlayComponent implements OnInit {
  @ViewChild('textArea') textArea?: ElementRef<HTMLTextAreaElement>;

  mode: OverlayMode = 'hidden';
  hoveredContext: ComponentContext | null = null;
  highlightRect: HighlightRect | null = null;
  selectedContext: ComponentContext | null = null;
  annotationText = '';
  selectionText = '';
  threadAnnotation: Annotation | null = null;
  diffAnnotation: Annotation | null = null;
  replyText = '';
  badges: AnnotationBadge[] = [];

  private readonly inspector = inject(InspectorService);
  private readonly bridge = inject(BridgeService);
  private readonly cdr = inject(ChangeDetectorRef);

  ngOnInit(): void {
    this.bridge.annotations$.subscribe((annotations) => {
      this.updateBadges(annotations);

      if (this.threadAnnotation) {
        const threadId = this.threadAnnotation.id;
        const updated = annotations.find((a) => a.id === threadId);
        if (updated) {
          this.threadAnnotation = updated;
          if (updated.status === 'diff_proposed' && updated.diff && this.mode === 'thread') {
            this.diffAnnotation = updated;
            this.mode = 'preview';
          }
        }
      }

      if (this.diffAnnotation) {
        const diffId = this.diffAnnotation.id;
        const updated = annotations.find((a) => a.id === diffId);
        if (updated) this.diffAnnotation = updated;
      }

      this.cdr.markForCheck();
    });
  }

  @HostListener('document:keydown.alt.shift.a', ['$event'])
  toggleInspect(event?: Event): void {
    event?.preventDefault();
    if (this.mode === 'hidden') this.mode = 'inspect';
    else if (this.mode === 'inspect') this.mode = 'hidden';
    else if (this.mode === 'annotate') this.mode = 'inspect';
    this.cdr.markForCheck();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.mode === 'annotate') this.mode = 'inspect';
    else if (this.mode === 'inspect') this.mode = 'hidden';
    else if (this.mode === 'thread') this.mode = 'hidden';
    else if (this.mode === 'preview') this.mode = 'hidden';
    this.cdr.markForCheck();
  }

  @HostListener('window:scroll')
  @HostListener('window:resize')
  onScrollOrResize(): void {
    if (this.badges.length > 0) {
      this.refreshBadgePositions();
      this.cdr.markForCheck();
    }
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    if (this.mode !== 'inspect') return;
    const target = event.target as Element;
    if (target.closest('nga-overlay')) return;
    const context = this.inspector.getComponentContext(target);
    this.hoveredContext = context;
    if (context) {
      const rect = target.getBoundingClientRect();
      this.highlightRect = {
        top: `${rect.top.toString()}px`,
        left: `${rect.left.toString()}px`,
        width: `${rect.width.toString()}px`,
        height: `${rect.height.toString()}px`,
      };
    } else {
      this.highlightRect = null;
    }
    this.cdr.markForCheck();
  }

  @HostListener('document:click', ['$event'])
  onClick(event: MouseEvent): void {
    if (this.mode !== 'inspect') return;
    const target = event.target as Element;
    if (target.closest('nga-overlay')) return;
    const context = this.inspector.getComponentContext(target);
    if (!context) return;

    event.preventDefault();
    event.stopPropagation();

    this.selectedContext = context;
    this.annotationText = '';
    this.selectionText = window.getSelection()?.toString() ?? '';
    this.mode = 'annotate';
    this.cdr.markForCheck();

    setTimeout(() => { this.textArea?.nativeElement.focus(); }, 0);
  }

  submit(): void {
    if (!this.selectedContext || !this.annotationText.trim()) return;
    this.bridge.createAnnotation({
      ...this.selectedContext,
      annotationText: this.annotationText.trim(),
      selectionText: this.selectionText || undefined,
    });
    this.selectedContext = null;
    this.annotationText = '';
    this.mode = 'inspect';
    this.cdr.markForCheck();
  }

  cancel(): void {
    this.mode = 'inspect';
    this.cdr.markForCheck();
  }

  openThread(annotation: Annotation): void {
    if (annotation.status === 'diff_proposed' && annotation.diff) {
      this.diffAnnotation = annotation;
      this.mode = 'preview';
    } else {
      this.threadAnnotation = annotation;
      this.mode = 'thread';
    }
    this.cdr.markForCheck();
  }

  closeThread(): void {
    this.threadAnnotation = null;
    this.mode = 'hidden';
    this.cdr.markForCheck();
  }

  approveDiff(): void {
    if (!this.diffAnnotation) return;
    this.bridge.approveDiff(this.diffAnnotation.id);
    this.diffAnnotation = null;
    this.mode = 'hidden';
    this.cdr.markForCheck();
  }

  rejectDiff(): void {
    if (!this.diffAnnotation) return;
    this.bridge.rejectDiff(this.diffAnnotation.id);
    this.diffAnnotation = null;
    this.mode = 'hidden';
    this.cdr.markForCheck();
  }

  closePreview(): void {
    this.diffAnnotation = null;
    this.mode = 'hidden';
    this.cdr.markForCheck();
  }

  sendReply(): void {
    if (!this.threadAnnotation || !this.replyText.trim()) return;
    this.bridge.replyToAnnotation(this.threadAnnotation.id, this.replyText.trim());
    this.replyText = '';
    this.cdr.markForCheck();
  }

  diffLines(): { type: string; text: string }[] {
    if (!this.diffAnnotation?.diff) return [];
    return this.diffAnnotation.diff.split('\n').map((text) => {
      if (text.startsWith('@@')) return { type: 'hunk', text };
      if (text.startsWith('+')) return { type: 'add', text };
      if (text.startsWith('-')) return { type: 'remove', text };
      return { type: 'context', text };
    });
  }

  inputEntries(): { key: string; value: unknown }[] {
    if (!this.selectedContext) return [];
    return Object.entries(this.selectedContext.inputs)
      .slice(0, 5)
      .map(([key, value]) => ({ key, value }));
  }

  private updateBadges(annotations: Annotation[]): void {
    this.badges = annotations
      .map((annotation) => {
        const el = this.findComponentElement(annotation.componentName, annotation.selector);
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        return {
          annotation,
          top: `${rect.top.toString()}px`,
          left: `${(rect.left + rect.width - 12).toString()}px`,
          icon: this.badgeIcon(annotation.status),
          label: `${annotation.componentName}: ${annotation.annotationText.slice(0, 40)}`,
        };
      })
      .filter((b): b is AnnotationBadge => b !== null);
  }

  private refreshBadgePositions(): void {
    this.badges = this.badges.map((badge) => {
      const el = this.findComponentElement(badge.annotation.componentName, badge.annotation.selector);
      if (!el) return badge;
      const rect = el.getBoundingClientRect();
      return {
        ...badge,
        top: `${rect.top.toString()}px`,
        left: `${(rect.left + rect.width - 12).toString()}px`,
      };
    });
  }

  private findComponentElement(componentName: string, selector: string): Element | null {
    const bySelector = document.querySelector(selector);
    if (bySelector) return bySelector;

    const all = document.querySelectorAll('*');
    for (const el of Array.from(all)) {
      try {
        const comp = (window as unknown as { ng?: { getComponent: (el: Element) => { constructor: { name: string } } | null } })
          .ng;
        if (comp?.getComponent(el)?.constructor.name === componentName) return el;
      } catch {
        // ignore
      }
    }
    return null;
  }

  private badgeIcon(status: AnnotationStatus): string {
    const icons: Record<AnnotationStatus, string> = {
      pending: '●',
      acknowledged: '◐',
      diff_proposed: '◈',
      resolved: '✓',
      dismissed: '✕',
    };
    return icons[status];
  }
}
