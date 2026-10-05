/**
 * 設定画面「サンプルデータを追加」で入るデモデータ。
 * 振り返り→引き継ぎ、今日やること（準備未登録の警告）、企業カルテ、内定比較が一通り見られるようにしている。
 */
import { Company, Selection, SelectionReview } from './types';
import { toDateStr, uid } from './utils';

function d(offset: number): string {
  const dt = new Date();
  dt.setDate(dt.getDate() + offset);
  return toDateStr(dt);
}

function review(partial: Partial<SelectionReview>): SelectionReview {
  return {
    result: 'passed', date: '', time: '', format: '', interviewerCount: 0, questions: [],
    answerNotes: '', goodPoints: '', stuckPoints: '', positiveReactions: '', improvements: '',
    ratings: {}, updatedAt: new Date().toISOString(),
    ...partial,
  };
}

function sel(partial: Partial<Selection> & Pick<Selection, 'name'>): Selection {
  return { id: uid(), deadline: '', status: 'pending', ...partial };
}

function q(text: string, answer = '') {
  return { id: uid(), text, answer };
}

function base(partial: Partial<Company> & Pick<Company, 'name'>): Company {
  return {
    id: uid(), jobType: '', industry: '', mypageUrl: '', status: 'active', flows: [],
    avgSalary: '', employees: '', location: '', founded: '', benefits: '', business: '',
    notes: '', concerns: '', createdAt: new Date().toISOString(),
    ...partial,
  };
}

export function buildSampleCompanies(): Company[] {
  return [
    // 振り返り → 次回選考への引き継ぎ、準備未登録の警告
    base({
      name: 'グローバル商事株式会社', industry: '商社', status: 'active',
      avgSalary: '650万円', employees: '8,000名', location: '東京都千代田区', founded: '1960年',
      benefits: '住宅手当・海外赴任手当', business: '総合商社・海外展開',
      notes: '安定感あり。海外事業が魅力', concerns: '転勤が多い',
      flows: [
        sel({ name: 'ES', kind: 'ES', deadline: d(-25), status: 'passed' }),
        sel({ name: 'Webテスト', kind: 'Webテスト', deadline: d(-15), status: 'passed' }),
        sel({
          name: '1次面接', kind: '1次面接', date: d(-5), time: '10:00', online: true, status: 'passed',
          review: review({
            result: 'passed', date: d(-5), time: '10:00', format: 'オンライン', interviewerCount: 2,
            questions: [
              q('ガクチカ', 'USJでのアルバイトで、待ち時間の案内を改善した話'),
              q('志望動機', '海外と日本をつなぐ仕事がしたい'),
              q('なぜ商社なのか'),
              q('最近気になったニュース'),
            ],
            goodPoints: 'ガクチカは具体的な数字を入れて話せた',
            stuckPoints: '最近気になったニュース',
            positiveReactions: 'USJでの接客経験',
            improvements: '商社を志望する理由をもっと具体化\n他の商社との違いを説明できるようにする',
            ratings: { overall: 3, answers: 3, understanding: 2, motivation: 2, communication: 4 },
          }),
        }),
        sel({ name: '2次面接', kind: '2次面接', date: d(2), time: '14:00', online: false, location: '本社 12F' }),
        sel({ name: '最終面接', kind: '最終面接' }),
      ],
      evaluation: { work: 4, salary: 5, benefits: 4, culture: 3, growth: 4, location: 3, wlb: 2, motivation: 4 },
      motivationHistory: [
        { id: uid(), date: d(-35), value: 60 },
        { id: uid(), date: d(-20), value: 70 },
        { id: uid(), date: d(-5), value: 80 },
      ],
    }),

    // 準備タスクのある締切（今日やること）
    base({
      name: '株式会社テックコーポ', industry: 'IT・Web', status: 'active',
      mypageUrl: 'https://example.com',
      avgSalary: '500万円', employees: '2,500名', location: '東京都港区', founded: '2005年',
      benefits: '完全週休2日・リモートワーク可・社員食堂', business: 'クラウドサービスの開発・運営',
      notes: '成長中の企業で風通しが良さそう', concerns: '残業が多いとの口コミあり',
      flows: [
        sel({
          name: 'ES', kind: 'ES', deadline: d(1),
          tasks: [
            { id: uid(), text: '自己PRを推敲', done: true },
            { id: uid(), text: '志望動機を作成', done: false },
            { id: uid(), text: '誤字脱字チェック', done: false },
          ],
        }),
        sel({ name: 'Webテスト', kind: 'Webテスト', deadline: d(9) }),
        sel({ name: '1次面接', kind: '1次面接', date: d(16), time: '11:00', online: true, location: 'Zoom' }),
      ],
      evaluation: { work: 5, salary: 3, culture: 4, growth: 5 },
      motivationHistory: [{ id: uid(), date: d(-10), value: 70 }],
    }),

    // 振り返り忘れ
    base({
      name: '株式会社サンライズ広告', industry: '広告・マスコミ', status: 'active',
      avgSalary: '580万円', employees: '1,200名', location: '大阪府大阪市',
      flows: [
        sel({ name: 'ES', kind: 'ES', deadline: d(-14), status: 'passed' }),
        sel({ name: '1次面接', kind: '1次面接', date: d(-2), time: '15:00', online: false, location: '大阪本社' }),
        sel({ name: '2次面接', kind: '2次面接' }),
      ],
    }),

    // 内定比較
    base({
      name: 'スタートアップAI株式会社', industry: 'IT・Web', status: 'offer',
      avgSalary: '600万円', employees: '120名', location: '東京都渋谷区', founded: '2018年',
      benefits: 'フルリモート・ストックオプション', business: 'AI-SaaSの開発',
      notes: '若いチームでやりがいありそう', concerns: '小規模なのでリスクあり',
      flows: [
        sel({ name: '書類選考', kind: 'ES', deadline: d(-40), status: 'passed' }),
        sel({
          name: '技術面接', kind: '1次面接', date: d(-28), status: 'passed',
          review: review({
            result: 'passed', format: 'オンライン', interviewerCount: 1,
            questions: [q('ガクチカ'), q('志望動機'), q('チーム開発で困ったこと')],
            positiveReactions: '個人開発アプリの話',
            improvements: '事業の収益構造を理解しておく',
            ratings: { overall: 4, answers: 4, understanding: 2, motivation: 4, communication: 4 },
          }),
        }),
        sel({
          name: '最終面接', kind: '最終面接', date: d(-14), status: 'passed',
          review: review({
            result: 'passed', format: '対面', interviewerCount: 2,
            questions: [q('志望動機'), q('入社後にやりたいこと'), q('逆質問')],
            goodPoints: '前回の反省を活かして事業の収益構造を説明できた',
            ratings: { overall: 5, answers: 4, understanding: 4, motivation: 5, communication: 4 },
          }),
        }),
      ],
      evaluation: { work: 5, salary: 4, benefits: 3, culture: 5, growth: 5, location: 4, wlb: 3, motivation: 5 },
      motivationHistory: [
        { id: uid(), date: d(-40), value: 50 },
        { id: uid(), date: d(-28), value: 65 },
        { id: uid(), date: d(-14), value: 80 },
        { id: uid(), date: d(-3), value: 90 },
      ],
      decision: {
        reason: '裁量が大きく、早くから成長できる環境',
        hesitation: '会社の規模が小さく、将来の安定性が気になる',
        expectation: '',
      },
    }),
    base({
      name: '株式会社ネクストメーカー', industry: 'メーカー', status: 'offer',
      avgSalary: '620万円', employees: '15,000名', location: '愛知県名古屋市', founded: '1950年',
      benefits: '社宅・家族手当・退職金制度', business: '自動車部品の製造・開発',
      notes: '福利厚生が手厚く安定している', concerns: '配属先が選べない',
      flows: [
        sel({ name: 'ES', kind: 'ES', deadline: d(-45), status: 'passed' }),
        sel({ name: '1次面接', kind: '1次面接', date: d(-30), status: 'passed' }),
        sel({ name: '最終面接', kind: '最終面接', date: d(-18), status: 'passed' }),
      ],
      evaluation: { work: 3, salary: 4, benefits: 5, culture: 4, growth: 3, location: 3, wlb: 5, motivation: 4 },
      motivationHistory: [
        { id: uid(), date: d(-45), value: 70 },
        { id: uid(), date: d(-30), value: 65 },
        { id: uid(), date: d(-18), value: 75 },
      ],
    }),
  ];
}
