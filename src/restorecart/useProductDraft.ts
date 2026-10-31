import { useEffect, useRef, useState } from "react";
export function useProductDraft(
  key: string,
  initial: any,
  fingerprint: string,
  onDirty?: (key: string, dirty: boolean) => void,
) {
  const original = useRef(fingerprint);
  const [state, setState] = useState(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(key) || "null");
      if (saved && saved.at > Date.now() - 86400000) {
        original.current = saved.fingerprint;
        return { fields: saved.fields, dirty: true };
      }
    } catch {}
    return { fields: initial, dirty: false };
  });
  useEffect(() => {
    if (!state.dirty) {
      original.current = fingerprint;
      setState({ fields: initial, dirty: false });
    }
  }, [fingerprint]);
  useEffect(() => {
    onDirty?.(key, state.dirty);
    try {
      if (state.dirty)
        sessionStorage.setItem(
          key,
          JSON.stringify({
            at: Date.now(),
            fields: state.fields,
            fingerprint: original.current,
          }),
        );
      else sessionStorage.removeItem(key);
    } catch {}
    return () => onDirty?.(key, false);
  }, [key, state]);
  return {
    fields: state.fields,
    dirty: state.dirty,
    conflict: state.dirty && original.current !== fingerprint,
    change: (field: string, value: any) =>
      setState((s) => ({
        fields: { ...s.fields, [field]: value },
        dirty: true,
      })),
    clear: () => {
      try {
        sessionStorage.removeItem(key);
      } catch {}
      original.current = fingerprint;
      setState((s) => ({ ...s, dirty: false }));
    },
    discard: () => {
      original.current = fingerprint;
      setState({ fields: initial, dirty: false });
    },
  };
}
