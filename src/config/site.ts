export const SITE = {
  name: 'IRON LOG',
  nameJa: 'アイアンログ',
  tagline: '筋トレを記録して、強くなる。',
  description:
    '筋トレの記録・重量推移のグラフ化ができる無料トレーニングログと、トレーニング知識・器具レビューのコラムを発信するサイトです。',
  locale: 'ja_JP',
  lang: 'ja',
  author: 'IRON LOG編集部',
  contactEmail: 'contact@example.com',
  twitter: '',
} as const;

export const CATEGORIES = {
  training: { label: 'トレーニング', description: '種目別のフォーム解説やプログラムの組み方' },
  nutrition: { label: '栄養・食事', description: 'プロテイン、PFCバランス、減量・増量の食事管理' },
  gear: { label: '器具レビュー', description: 'ダンベル・ベンチ・ベルトなど、トレーニング器具の比較とレビュー' },
  knowledge: { label: '基礎知識', description: '1RM、RPE、ボリュームなど、筋トレの基本用語と理論' },
} as const;

export type CategoryKey = keyof typeof CATEGORIES;

export const ADS = {
  client: import.meta.env.PUBLIC_ADSENSE_CLIENT ?? '',
  // AdSense管理画面で広告ユニットを作成したら、ここにスロットIDを入れる
  slots: {
    'in-article': '',
    'article-bottom': '',
    'list-inline': '',
  },
} as const;

export type AdPosition = keyof typeof ADS.slots;

export const AFFILIATE = {
  amazonTag: import.meta.env.PUBLIC_AMAZON_TAG ?? '',
  rakutenAffiliateId: import.meta.env.PUBLIC_RAKUTEN_AFFILIATE_ID ?? '',
} as const;
