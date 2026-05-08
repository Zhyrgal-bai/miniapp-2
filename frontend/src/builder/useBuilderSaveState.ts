import { useCallback, useMemo, useState } from "react";

export type BuilderSaveState = {
  isDirty: boolean;
  isSaving: boolean;
  isPublishing: boolean;
  saveError: string | null;
  lastSavedAt: number | null;
  lastPublishedAt: number | null;
};

export function useBuilderSaveState() {
  const [s, setS] = useState<BuilderSaveState>({
    isDirty: false,
    isSaving: false,
    isPublishing: false,
    saveError: null,
    lastSavedAt: null,
    lastPublishedAt: null,
  });

  const markDirty = useCallback(() => {
    setS((p) => ({ ...p, isDirty: true, saveError: null }));
  }, []);

  const startSaving = useCallback(() => {
    setS((p) => ({ ...p, isSaving: true, saveError: null }));
  }, []);

  const savedOk = useCallback(() => {
    setS((p) => ({ ...p, isSaving: false, saveError: null, lastSavedAt: Date.now() }));
  }, []);

  const saveFailed = useCallback((msg: string) => {
    setS((p) => ({ ...p, isSaving: false, saveError: msg || "Save failed" }));
  }, []);

  const startPublishing = useCallback(() => {
    setS((p) => ({ ...p, isPublishing: true, saveError: null }));
  }, []);

  const publishedOk = useCallback(() => {
    setS((p) => ({
      ...p,
      isPublishing: false,
      isDirty: false,
      saveError: null,
      lastPublishedAt: Date.now(),
    }));
  }, []);

  const publishFailed = useCallback((msg: string) => {
    setS((p) => ({ ...p, isPublishing: false, saveError: msg || "Publish failed" }));
  }, []);

  const resetDone = useCallback(() => {
    setS((p) => ({
      ...p,
      isDirty: false,
      isSaving: false,
      saveError: null,
      lastSavedAt: Date.now(),
    }));
  }, []);

  const api = useMemo(
    () => ({
      state: s,
      markDirty,
      startSaving,
      savedOk,
      saveFailed,
      startPublishing,
      publishedOk,
      publishFailed,
      resetDone,
    }),
    [s, markDirty, startSaving, savedOk, saveFailed, startPublishing, publishedOk, publishFailed, resetDone],
  );

  return api;
}

