"use client";

import { useActionState, useEffect, useRef, startTransition, type FormEvent } from "react";
import { toast } from "sonner";

type State<T> = { ok: boolean; message?: string; fieldErrors?: Record<string, string>; data?: T; at?: number } | null;

/**
 * Wraps a server action for a form:
 *  - submits without React's automatic form reset (so values survive validation errors),
 *  - shows a toast for every result,
 *  - exposes field errors & pending state.
 */
export function useFormAction<T>(
  action: (prev: State<T>, fd: FormData) => Promise<State<T>>,
  opts: { onSuccess?: (state: NonNullable<State<T>>) => void; successToast?: boolean } = {},
) {
  const [state, dispatch, pending] = useActionState(action, null);
  const last = useRef<number | undefined>(undefined);
  const onSuccess = useRef(opts.onSuccess);
  useEffect(() => {
    onSuccess.current = opts.onSuccess;
  });

  useEffect(() => {
    if (!state?.at || state.at === last.current) return;
    last.current = state.at;
    if (state.ok) {
      if (opts.successToast !== false && state.message) toast.success(state.message);
      onSuccess.current?.(state);
    } else if (state.message) {
      toast.error(state.message);
    }
  }, [state, opts.successToast]);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => dispatch(fd));
  };

  const errorFor = (name: string) => (state && !state.ok ? state.fieldErrors?.[name] : undefined);
  return { state, pending, onSubmit, errorFor };
}
