import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { basicSetup } from "codemirror";
import { EditorView, keymap } from "@codemirror/view";
import { EditorState, Prec } from "@codemirror/state";
import { sql, MySQL } from "@codemirror/lang-sql";
import { T } from "../theme";

export interface SqlEditorHandle {
  /** Selected text if any, otherwise the whole document. */
  runText: () => string;
}

function selectionOrAll(v: EditorView): string {
  const sel = v.state.selection.main;
  if (!sel.empty) return v.state.sliceDoc(sel.from, sel.to);
  return v.state.doc.toString();
}

export const SqlEditor = forwardRef<
  SqlEditorHandle,
  {
    value: string;
    onChange: (v: string) => void;
    onRun: (text: string) => void;
    onCancel: () => void;
    running: boolean;
  }
>(function SqlEditor({ value, onChange, onRun, onCancel, running }, ref) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  // keep latest callbacks reachable from the long-lived editor instance
  const cbs = useRef({ onChange, onRun, onCancel, running });
  cbs.current = { onChange, onRun, onCancel, running };

  useImperativeHandle(ref, () => ({
    runText: () => (view.current ? selectionOrAll(view.current) : ""),
  }));

  useEffect(() => {
    if (!host.current) return;
    const runKeys = Prec.highest(
      keymap.of([
        {
          key: "Mod-Enter",
          run: (v) => { cbs.current.onRun(selectionOrAll(v)); return true; },
        },
        {
          key: "Escape",
          run: () => { if (cbs.current.running) { cbs.current.onCancel(); return true; } return false; },
        },
      ])
    );
    const state = EditorState.create({
      doc: value,
      extensions: [
        basicSetup,
        sql({ dialect: MySQL, upperCaseKeywords: true }),
        runKeys,
        EditorView.updateListener.of((u) => { if (u.docChanged) cbs.current.onChange(u.state.doc.toString()); }),
        EditorView.theme({
          "&": { height: "100%", fontSize: "13px", background: T.card },
          ".cm-scroller": { fontFamily: T.mono, lineHeight: "1.6" },
          ".cm-gutters": { background: "#fbfbfa", border: "none", color: T.faint },
          "&.cm-focused": { outline: "none" },
          ".cm-content": { padding: "10px 0" },
        }),
      ],
    });
    const v = new EditorView({ state, parent: host.current });
    view.current = v;
    return () => v.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // sync external value changes (e.g. restoring from history) without disturbing typing
  useEffect(() => {
    const v = view.current;
    if (!v) return;
    const cur = v.state.doc.toString();
    if (value !== cur) {
      v.dispatch({ changes: { from: 0, to: cur.length, insert: value } });
    }
  }, [value]);

  return <div ref={host} style={{ height: "100%", overflow: "hidden" }} />;
});
