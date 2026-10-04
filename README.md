# workout-tracker(仮称: IRON LOG)

筋トレ記録Webサイト(アフィリエイト・広告収益化目的)

## 技術スタック

| 領域 | 採用技術 |
|---|---|
| フレームワーク | Astro 7 + React(必要な箇所のみ)+ TypeScript |
| ホスティング | Cloudflare Workers(`@astrojs/cloudflare`) |
| DB・認証 | Supabase(Postgres + Auth、RLSでユーザーごとにデータを分離) |
| 記事 | MDX(`src/content/articles/`) |
| グラフ | Chart.js(フェーズ3で導入) |

## 開発

```sh
npm install
npm run dev      # http://localhost:4321
npm run check    # 型チェック
npm run build    # 本番ビルド(dist/)
npm run preview  # ビルド結果をCloudflareのランタイム(workerd)で確認
```

Supabase の接続先(URL と publishable key)は `wrangler.jsonc` の `vars` に設定済みです。publishable key は公開しても安全なキーです。**service_role / secret キーは絶対にリポジトリに入れないでください。**

広告・アフィリエイト用の環境変数は `.env.example` を `.env` にコピーして設定します。未設定でも動作します(開発時は広告枠がプレースホルダ表示、本番では非表示)。

## ディレクトリ構成

```
src/
├─ config/site.ts          サイト名・カテゴリ・広告スロットIDなどの設定(サイト名の変更はここ)
├─ data/products.ts        アフィリエイト商品の一覧(リンク差し替えはここだけで全記事に反映)
├─ content/articles/*.mdx  記事
├─ components/
│   ├─ ads/AdSlot.astro           AdSense広告枠(遅延読み込み・高さ確保済み)
│   └─ affiliate/                 ProductCard / AffiliateLink / PrNotice
├─ layouts/                BaseLayout(SEO共通)/ PageLayout(固定ページ)
├─ lib/                    記事取得・構造化データ・アフィリエイトURL生成・1RM計算・Supabase接続
├─ middleware.ts           ログイン判定(/app と /api はログイン必須)
└─ pages/
    ├─ app/                マイログ(ダッシュボード・記録・履歴・体重・設定)
    ├─ api/                トレーニング保存などのAPI
    └─ login / signup / forgot-password / auth/
supabase/migrations/       DBスキーマ(SQL)
```

## 記事の書き方

`src/content/articles/` に `.mdx` ファイルを追加します。ファイル名がURLになります(例: `bench-press-form.mdx` → `/articles/bench-press-form`)。

```mdx
---
title: 記事タイトル(60文字以内)
description: 検索結果に表示される説明文(160文字以内)
pubDate: 2026-10-01
updatedDate: 2026-10-15      # 任意
category: gear               # training / nutrition / gear / knowledge
tags: [ダンベル, 自宅トレ]
sponsored: true              # アフィリエイトリンクを含む場合は必ず true(冒頭にPR表記)
draft: false                 # true なら本番では非公開
---

本文...

<ProductCard id="adjustable-dumbbell" />   {/* 商品カード(src/data/products.ts のID) */}
<AffiliateLink id="whey-protein">このプロテイン</AffiliateLink>  {/* 文中リンク */}
<AdSlot />                                  {/* 任意の位置に広告枠 */}
```

記事ページでは、目次の下と記事末尾に広告枠が自動で入ります。

## Supabase の初期設定(最初に1回だけ)

1. ダッシュボードの **SQL Editor** を開き、`supabase/migrations/20261004000000_init.sql` の中身を貼り付けて **Run**
   - テーブル・アクセス制御(RLS)・保存用の関数・プリセット種目が作成されます
2. **Authentication → URL Configuration**
   - **Site URL**: 本番のURL(公開前は `http://localhost:4321`)
   - **Redirect URLs** に追加: `http://localhost:4321/**` と、本番URLの `https://(ドメイン)/**`
3. **Authentication → Emails → SMTP Settings**(公開前に必須)
   - Supabase 標準のメール送信は、プロジェクトのメンバー宛てにしか送れず、送信数の上限も低いです。一般の人に登録してもらう前に、[Resend](https://resend.com) などの SMTP を設定してください(無料枠あり)

スキーマを変更するときは `supabase/migrations/` に新しいSQLファイルを追加し、`src/lib/database.types.ts` も合わせて更新します。

## 収益化の設定

1. **AdSense**: 審査に通ったら `PUBLIC_ADSENSE_CLIENT` を設定し、管理画面で作成した広告ユニットのIDを `src/config/site.ts` の `ADS.slots` に入れる。`/ads.txt` は自動生成されます。EU圏向けの同意管理は、AdSense管理画面の「プライバシーとメッセージ」で設定します
2. **Amazonアソシエイト**: `PUBLIC_AMAZON_TAG` を設定すると、全商品リンクにタグが付きます。商品ページに直接飛ばす場合は `products.ts` に `asin` を追加します
3. **楽天アフィリエイト**: `PUBLIC_RAKUTEN_AFFILIATE_ID` を設定すると、楽天リンクがアフィリエイトリンクになります
4. **もしもアフィリエイト等のASP**: 発行されたリンクを `products.ts` の `links` に貼ると、自動生成リンクより優先されます

## デプロイ(Cloudflare Workers)

1. Cloudflareのダッシュボードで「Workers & Pages」→「作成」→ GitHubリポジトリを連携
2. ビルドコマンド: `npm run build` / デプロイコマンド: `npx wrangler deploy`
3. 環境変数(ビルド時)に `PUBLIC_SITE_URL` などを設定
4. 独自ドメインを取得したら Workers の「カスタムドメイン」に追加

## ロードマップ

- [x] フェーズ1: 土台、ブログ、広告・アフィリエイト部品、法務ページ、1RM計算ツール
- [x] フェーズ2: Supabase認証、トレーニングログの登録・編集・削除、体重記録
- [ ] フェーズ3: グラフ・ダッシュボード(最大重量・推定1RM・ボリューム・体重)
- [ ] フェーズ4: PWA対応、CSV出力、メニューのテンプレート
