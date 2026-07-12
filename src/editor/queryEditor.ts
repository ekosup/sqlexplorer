// FR-03: CodeMirror 6 — syntax highlight SQLite + autocomplete dari schema DB dimuat.
import { EditorState, Compartment, Prec } from '@codemirror/state';
import { EditorView, keymap, placeholder } from '@codemirror/view';
import { sql, SQLite, type SQLNamespace } from '@codemirror/lang-sql';
import { basicSetup } from 'codemirror';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import type { TableSchema } from '../db/types';

export type EditorApi = {
  getValue: () => string;
  setValue: (sql: string) => void;
  focus: () => void;
  updateSchema: (schema: TableSchema[]) => void;
};

const toNs = (schema: TableSchema[]): SQLNamespace => {
  const ns: Record<string, string[]> = {};
  for (const t of schema) ns[t.name] = t.columns.map((c) => c.name);
  return ns;
};

const makeLang = (schema?: TableSchema[]) =>
  sql({ dialect: SQLite, upperCaseKeywords: true, schema: schema?.length ? toNs(schema) : undefined });

const sqlHighlightStyle = HighlightStyle.define([
  { tag: t.keyword, color: 'var(--syntax-keyword)' },
  { tag: t.operator, color: 'var(--syntax-operator)' },
  { tag: t.string, color: 'var(--syntax-string)' },
  { tag: t.number, color: 'var(--syntax-number)' },
  { tag: t.comment, color: 'var(--syntax-comment)', fontStyle: 'italic' },
  { tag: t.punctuation, color: 'var(--syntax-punctuation)' },
  { tag: t.variableName, color: 'var(--syntax-variable)' },
  { tag: t.typeName, color: 'var(--syntax-type)' },
  { tag: t.atom, color: 'var(--syntax-builtin)' },
  { tag: t.special(t.variableName), color: 'var(--syntax-builtin)' },
]);

export const mountQueryEditor = (
  parent: HTMLElement,
  opts: { onRun: () => void; onChange?: (sql: string) => void; schema?: TableSchema[] },
): EditorApi => {
  const lang = new Compartment();
  const theme = EditorView.theme({
    '&': { height: '100%', backgroundColor: 'var(--editor-bg)', color: 'var(--editor-text)' },
    '.cm-scroller': {
      overflow: 'auto',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      fontSize: '13px',
      lineHeight: '1.5',
    },
    '.cm-gutters': {
      backgroundColor: 'var(--panel-header)',
      color: 'var(--muted)',
      borderRight: '1px solid var(--border)'
    },
    '.cm-activeLine': { backgroundColor: 'var(--editor-active-line)' },
    '.cm-activeLineGutter': { backgroundColor: 'var(--editor-active-line)', color: 'var(--text)' },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--editor-text)' },
    '.cm-selectionBackground, ::selection': { backgroundColor: 'var(--editor-selection)' },
    '&.cm-focused': { outline: '0' },
  });

  const view = new EditorView({
    state: EditorState.create({
      doc: '',
      extensions: [
        basicSetup,
        placeholder('Tulis query SELECT di sini… (Ctrl/Cmd+Enter = Run)'),
        lang.of(makeLang(opts.schema)),
        Prec.highest(keymap.of([{ key: 'Mod-Enter', preventDefault: true, run: () => { opts.onRun(); return true; } }])),
        EditorView.lineWrapping,
        syntaxHighlighting(sqlHighlightStyle),
        theme,
        EditorView.updateListener.of((update) => {
          if (update.docChanged && opts.onChange) {
            opts.onChange(update.state.doc.toString());
          }
        }),
      ],
    }),
    parent,
  });

  return {
    getValue: () => view.state.doc.toString(),
    setValue: (sql) =>
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: sql }, selection: { anchor: sql.length } }),
    focus: () => view.focus(),
    updateSchema: (schema) => view.dispatch({ effects: lang.reconfigure(makeLang(schema)) }),
  };
};
