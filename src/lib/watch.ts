// キャッチアップで追う「業界を動かす人・メディア」＝検証済みリスト。
// ※AI生成の未確認リストは使わない。ここはWeb検証で実在・肩書きを確認したものだけ。
// /api/brain-watch（画面表示）と /api/cron/catchup（ニュース自動追跡）が共有する。

export interface WatchItem {
  name: string
  role: string
  why: string
  news: string   // Google News検索に使う語（空なら自動ニュース追跡しない＝メディア等）
  kind: 'person' | 'company' | 'org' | 'media' | 'policy'
  links: { label: string; url: string }[]
}

export const WATCH: WatchItem[] = [
  {
    name: '志手一哉', kind: 'person',
    role: '芝浦工業大学 教授 / BIM・建築生産の第一人者（国交省 建築BIM推進会議 学識委員）',
    why: 'BIM＝国策の動向を権威の立場から。"BIM権威"枠の本物はこの人。',
    news: '志手一哉 BIM',
    links: [{ label: 'researchmap', url: 'https://researchmap.jp/shide_SIT' }],
  },
  {
    name: '川島範久', kind: 'person',
    role: '明治大学 准教授・建築家 / 建築×環境×デジタルのDX論者',
    why: '数少ない"建築家側"のDX論者。Renderyユーザー（設計・提案者）の心理に近い視点。',
    news: '川島範久 建築',
    links: [{ label: 'X @nrhs_kawashima', url: 'https://x.com/nrhs_kawashima' }],
  },
  {
    name: 'ANDPAD（稲田武夫 CEO）', kind: 'company',
    role: '株式会社アンドパッド / 建設DXの象徴企業（現場管理SaaS最大手）',
    why: '業界トレンド・競合の定点観測に必須。大手の動き＝中小向け企画のヒント。',
    news: 'ANDPAD アンドパッド',
    links: [{ label: '公式', url: 'https://andpad.co.jp/company/' }],
  },
  {
    name: 'スパイダープラス（伊藤謙自 代表）', kind: 'company',
    role: '建設DX銘柄として国内初の上場（職人出身で自作SaaS）',
    why: '現場発DXの象徴。「現場の人がDXを作る」物語は営業の追い風トークに。',
    news: 'スパイダープラス SPIDERPLUS',
    links: [{ label: '公式', url: 'https://spiderplus.co.jp' }],
  },
  {
    name: '建設DX研究所', kind: 'org',
    role: '建設テック各社の政策提言・勉強会団体',
    why: '建設DXの政策・業界動向の発信元。"国がどう動くか"が先手で出る。',
    news: '建設DX研究所',
    links: [{ label: 'X @kensetsuDX_lab', url: 'https://x.com/kensetsuDX_lab' }, { label: 'note', url: 'https://note.com/kensetsu_dx' }],
  },
  {
    name: 'buildingSMART Japan', kind: 'org',
    role: 'BIM国際標準（IFC）の団体',
    why: 'BIMの共通ルール＝業界の土台を追うなら必須。',
    news: 'buildingSMART BIM',
    links: [{ label: '公式', url: 'https://building-smart.or.jp' }],
  },
  {
    name: '国交省 i-Construction 2.0', kind: 'policy',
    role: '建設現場の省人化（2040年に3割減）を掲げる国家施策',
    why: '政策の地図そのもの。営業で使う"国の追い風"の一次根拠。',
    news: 'i-Construction 建設',
    links: [{ label: '施策PDF', url: 'https://www.mlit.go.jp/tec/constplan/content/001738240.pdf' }],
  },
  {
    name: 'Explaza「project Camelot」', kind: 'company',
    role: '企画特化AI（確定設計の"前"を狙う）／2026年内に段階提供（東京アセットと）',
    why: 'VISIOALの"企画フェーズ空白"に踏み込む新顔。空白が埋まり始めた象徴＝要警戒。',
    news: 'Explaza project Camelot 建築',
    links: [{ label: 'ニュース検索', url: 'https://news.google.com/search?q=Explaza%20project%20Camelot&hl=ja&gl=JP' }],
  },
  {
    name: 'Autodesk「Forma Building Design」', kind: 'company',
    role: '基本設計フェーズ専用AI（早期の合意形成・トレードオフ評価）',
    why: '基盤大手が"企画〜基本設計"に降りてきた＝構造的な脅威。',
    news: 'Autodesk Forma',
    links: [{ label: 'Autodesk Forma', url: 'https://www.autodesk.com/products/forma/' }],
  },
  {
    name: 'DataLabs「Framy」', kind: 'company',
    role: '図面/点群→BIM自動生成クラウド',
    why: 'カスタム（図面のBIM化受託）の直接競合。図面解析の自動化。',
    news: 'DataLabs Framy BIM',
    links: [{ label: 'ニュース検索', url: 'https://news.google.com/search?q=DataLabs%20Framy%20BIM&hl=ja&gl=JP' }],
  },
  {
    name: 'ArchiX「平面図→3D」', kind: 'company',
    role: '建築特化AI（平面図→3D実装＝"縦串"の入口に踏み込む）',
    why: 'パース→3D→提案の縦串はSAMURAIの強み領域。そこに重なってきた。',
    news: 'ArchiX 建築 AI',
    links: [{ label: 'X @ArchiX_ai', url: 'https://x.com/ArchiX_ai' }],
  },
  {
    name: 'BuildApp News', kind: 'media',
    role: '建設DX・BIM専門メディア（野原グループ運営）',
    why: '業界トレンドの一次ソース。毎日更新。',
    news: '',
    links: [{ label: 'サイト', url: 'https://news.build-app.jp' }],
  },
  {
    name: '日経クロステック（建設）', kind: 'media',
    role: '日経の建設テック専門媒体',
    why: 'SpiderPlus/ANDPAD等の一次取材記事が豊富。',
    news: '',
    links: [{ label: 'サイト', url: 'https://xtech.nikkei.com' }],
  },
]
