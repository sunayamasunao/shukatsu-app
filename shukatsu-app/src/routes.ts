/** 2階層の動的ルートへのリンク（typed routes 対応） */
export const selectionHref = (cid: string, sid: string) =>
  ({ pathname: '/selection/[cid]/[sid]', params: { cid, sid } }) as const;

export const reviewHref = (cid: string, sid: string) =>
  ({ pathname: '/review/[cid]/[sid]', params: { cid, sid } }) as const;
