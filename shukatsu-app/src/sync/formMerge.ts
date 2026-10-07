/**
 * 編集フォームの保存時の3方向マージ。
 *
 * フォームは開いた時点の値で初期化されるため、そのまま保存すると
 * 「フォームを開いている間に別の端末で更新された値」を古い値で上書きしてしまう。
 * そこで、フォームで実際に変更した項目だけを最新の値に重ねる。
 *
 *   initial … フォームを開いた時点の値（共通の祖先）
 *   edited  … フォームの値
 *   latest  … 保存直前の最新の値（他端末の変更を取り込み済み）
 */
import { isEqual } from './merge.ts';

export interface FormMergeResult<T, K extends keyof T = keyof T> {
  /** フォームの変更を優先した結果 */
  merged: T;
  /** 両方で別の値に変更された項目 */
  conflicts: K[];
  /** 衝突した項目だけ最新の値に戻した結果 */
  keepLatest: T;
}

export function mergeFormEdit<T extends object, K extends keyof T>(
  initial: T, edited: T, latest: T, keys: readonly K[],
): FormMergeResult<T, K> {
  const merged = { ...latest };
  const keepLatest = { ...latest };
  const conflicts: K[] = [];
  for (const k of keys) {
    const formChanged = !isEqual(edited[k], initial[k]);
    if (!formChanged) continue;
    const remoteChanged = !isEqual(latest[k], initial[k]);
    merged[k] = edited[k];
    if (remoteChanged && !isEqual(latest[k], edited[k])) conflicts.push(k);
    else keepLatest[k] = edited[k];
  }
  return { merged, conflicts, keepLatest };
}
