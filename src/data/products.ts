import type { Shop } from '@/lib/affiliate';

export interface Product {
  name: string;
  /** 検索リンクの生成に使うキーワード(ASINやASPリンクが無い場合のフォールバック) */
  keyword: string;
  asin?: string;
  /** もしもアフィリエイト・バリューコマース等で発行したリンクを貼る場合はここに。自動生成より優先される */
  links?: Partial<Record<Shop, string>>;
  shops?: Shop[];
  /** public/ 配下の画像パス(例: /images/products/xxx.webp)。Amazonの画像直リンクは規約上避ける */
  image?: string;
  price?: string;
  points?: string[];
}

/**
 * 記事内では <ProductCard id="adjustable-dumbbell" /> のようにIDで参照する。
 * リンクの差し替えはこのファイルだけで全記事に反映される。
 */
export const PRODUCTS = {
  'adjustable-dumbbell': {
    name: '可変式ダンベル 24kg(2個セット)',
    keyword: '可変式ダンベル 24kg',
    price: '2〜4万円前後',
    points: ['ダイヤル式で数秒で重量変更', '1台で複数本分のスペースを節約', '自宅トレの最初の1台に最適'],
  },
  'flat-bench': {
    name: 'フラットベンチ(耐荷重300kg)',
    keyword: 'フラットベンチ 耐荷重300kg',
    price: '5千〜1万円前後',
    points: ['ダンベルプレス・ロウなど種目が一気に増える', '折りたたみ式なら収納も楽'],
  },
  'incline-bench': {
    name: 'インクラインベンチ(角度調整付き)',
    keyword: 'インクラインベンチ 角度調整',
    price: '1〜2万円前後',
    points: ['インクラインプレスで大胸筋上部を狙える', 'シートの角度も調整できるものがおすすめ'],
  },
  'lifting-belt': {
    name: 'トレーニングベルト(レバーアクション)',
    keyword: 'トレーニングベルト レバーアクション',
    price: '5千〜2万円前後',
    points: ['腹圧を高めて高重量を安定させる', 'スクワット・デッドリフトの必需品'],
  },
  'whey-protein': {
    name: 'ホエイプロテイン 1kg',
    keyword: 'ホエイプロテイン 1kg',
    price: '3〜5千円前後',
    points: ['トレーニング後のタンパク質補給に', '1食あたり約20gのタンパク質'],
  },
} satisfies Record<string, Product>;

export type ProductId = keyof typeof PRODUCTS;
