import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'
import { resolveGoogleNewsUrl } from '@/lib/sources'

// SAMURAI脳（四次元ポケット）API。
// 分からん言葉・記事・質問を投げると、SAMURAIの文脈で・平易に・「自社への意味」付きで返す。
// 脳の"記憶"= 下のBRAIN_KNOWLEDGE（今日の学習の蒸留）＋ Redis `samurai:brain-feed`（毎朝のSlack新着・phase2で投入）。

const MODEL = 'claude-haiku-4-5-20251001'

// ── 脳の記憶（自社・顧客・業界・競合・国策・用語・正直ルール）─────────────
const BRAIN_KNOWLEDGE = `
# SAMURAIの基礎知識（この内容を前提に答える）

## 会社
SAMURAI ARCHITECTS（東京・南青山、2022年設立、社員10名前後）。代表CEO=加藤利基（家業は工務店、慶應SDMの背景）。「建築 × AI」で建築・不動産のDXを進める。運営思想=THE MOLTS流「最大値を避け、中央値で正直に伝える」。

## 4プロダクト（製品＝薬、顧客＝患者、痛み＝病気 で捉える）
- Rendery：ラフや写真からAIが建築の完成イメージ（パース）を数分で作るツール。例えると「建物専用の賢いInstagramフィルター」。客＝中小工務店（注文住宅・施工側）。痛み＝提案がお客さんに伝わらず、社長の時間が溶ける。勝ち筋＝「数を撃てない工務店の、一棟ごとの提案の打率を上げる」。たたき台ゾーン（安い・速い・自分で）。
- knock knock AI：空室写真にAIで家具を置く（バーチャルホームステージング）。客＝不動産の仲介・賃貸管理。痛み＝空室＝毎月お金が出血。SUUMO等で殺風景な写真は埋もれる。勝ち筋＝写真で「内見行きたい」に引き込み反響を増やす。
- VISIOAL：建築家＋AIで企画段階の空間をフォトリアル化するコンサル型サービス（1枚75,000円〜、作品ゾーン）。客＝デベロッパー・企画者。痛み＝図面前の構想を、上司・施主・出資者に見せてGO（予算）をもらいたい。勝ち筋＝企画プレゼンの瞬間に決裁者を引き込む。
- カスタム（NINXA / Computational Design）：その会社専用のAI受託（図面のBIM化・図面解析 等）。客＝大手（ゼネコン・商社・大手建設）。型が違い「絵で一発」ではなくPoC（小さく試す）→信頼→大型契約。実商談例：住友林業・三菱商事・大成建設・日建設計・丸紅アークログ。

## 顧客の核（本丸＝中小工務店）
社長＋職人数人〜十数人。社長が全部やる（営業・現場・見積もり）。専任IT・マーケなし、金も時間も余裕なし、ずっと紙・FAX。深層心理＝「取り残される怖さ × 半信半疑」（難しそう・高そう・本当に効くの？）。建設は単品受注で大量生産できず＝薄利＋少売（薄利多売ですらない）。だから刺さるのは「あなたでも・すぐ・安く、提案の打率が上がる」。AI＝馬力のレンタル。
※「工務店≒施工」と「設計事務所＝設計・別ポジ」は混同しない。「建築（建築学会）」と「土木（土木学会）」も別。「建設＝全部アナログ」は誤り（大手は年100億R&D。アナログの本丸は中小・地方・下請層）。

## 業界の因果（線）
戦後復興で量を急ぐ→重層下請＋単品受注→生産性が全産業の約65%→高齢化(55歳以上36.7%)で担い手枯渇→国が法で生産性を上げにいく→AIの省人化が刺さる→でも中小は薄利・低リテラシ→「簡単・安い・即効・正直」でしか入れない。

## 競合の考え方
競合＝「同じ客が選べる代わりの手段ぜんぶ」（外注・何もしない・他AI・汎用AI）。「AIでパース／ステージング」自体に専売特許はない（誰でもできる方向）。Renderyは上＝汎用AI(Midjourney/Gemini)、下＝低価格量産(ENIAC/Quick Rendering)に挟撃される。差別化＝「建築特化の"使える"精度（寸法・実在建材・CAD/BIM連携）＋提案体験＋4製品の縦串」。汎用AIは"それっぽい絵"、Renderyは"使える絵"。
塊で覚える競合：taziku（パースも企画も受託も来る多面競合・最警戒）、ルームAI（ステージング価格破壊の震源・98円〜）、スペースリー/カグオク/Digital Staging AI（ステージング直接）、MyRenderer/PersGPT/ArchiX/gendo.ai/Vectorworks(AI VISUALIZER)（パース直接）、Illoca/大林組AiCorb（企画・設計AI）、Arent/JSOL/DataLabs/NITACO（BIM・図面解析）。空白＝「企画フェーズの合意形成ビジュアル(VISIOAL)」と「図面→提案ビジュアルの縦串」。

## 国の関わり（飴と鞭）
国は人を増やせない→生産性を上げるしかない→デジタル化を飴と鞭で推進。
- 2024年問題＝建設の残業上限規制。建設・運送・医療の「3兄弟」が5年猶予の末2024年に一斉適用。建設は人手不足が最も深刻。→省人化ツール需要の追い風。
- BIM＝「建物を情報つき3Dデータで作る"やり方"」（ソフト例=Revit/ArchiCAD/GLOOBE、共通形式=IFC）。国が公共工事と建築確認のBIM審査(2026開始→2029原則化)という"逆らえないゲート"で強制（マイナ保険証と同じ構図）。ただし主に大手・公共・設計向け。住宅系中小工務店には当面は間接的（小規模住宅は後回し）。SAMURAIの直接の追い風はカスタム（図面BIM化受託）。
- 補助金＝飴。中小がIT/AI導入する費用の一部を国が負担（IT導入補助金 等）。中小工務店の「高そう」の壁を崩せる＝Renderyの本丸に効くカード。ただし毎年要件が変わり審査もある→「使えるかも、一緒に確認」までが正直（「絶対半額」はNG）。
- 不動産DX＝不動産取引のオンライン化（IT重説・電子契約）。客が"画面の写真"で物件を判断する→knock knockの追い風。
- どの国策が効くかは製品＝客の業界・規模で違う（建設=Rendery/カスタム、不動産=knock knock、補助金=中小、BIM/2024年問題=建設大手）。

## よく出る用語（30字以内）
建築パース=完成イメージの立体予想図 / レンダリング=データから写実画像を計算生成 / バーチャルホームステージング=空室写真にCG家具を合成 / BIM=建物を3D＋情報で管理する手法 / IFC=BIMの共通ファイル形式 / 重層下請=元請の下に何層も下請が連なる構造 / 単品受注=毎回違うものを一個ずつ作る / 2024年問題=建設の残業上限規制 / IT重説=重要事項説明をオンラインで / PoC=小さく試して効果を確かめること / デベロッパー=不動産の開発・分譲事業者 / i-Construction 2.0=2040年に現場省人化3割を目指す国策。

## 会社の内部（一員として知っておくこと）
- 体制: CEO加藤利基(表の顔・商談ドライブ、家業=工務店)、CTO横溝裕太(技術中枢・CAD2BIM/Rhino MCP・Renderyの裏側はGemini依存)、高山(メディア露出のマーケ活用)。マーケ実働=THE MOLTS(海老澤里沙=戦略主管/本村=実装)。「佐藤梨那」は実在せず海老澤が作った仮想リサーチャー人格(#news_and_service等の発信名義)。
- マーケ戦略: KGI=2027年5月末までに案件相談数を現状比1.5倍。導線=知らない→Layer A(認知・SEO/AI露出・プロダクト起点)→Layer B(信頼・事例の定量変化)→相談。7施策(①計測整備 ②事例の数値化 ③VISIOAL単独LP ④既存LP訴求軸見直し ⑤CEO個人発信 ⑥VISIOALリファラル ⑦Rendery/knockリファラル)。
- 計測の実態(最重要): 4サイト中コーポのみ正確計測(6/16〜)。残3LP(Rendery/knock/VISIOAL)はGTM未実装で6/23が実装期限=全KPIの起点。コーポはWix完全JSレンダリングでPR資産(ZIP!/日経xTECH等)がSEO/LLM不可視。
- 商談パイプライン: 住友林業(AIパース全社展開・最大2700ユーザー・受託の鍵=セキュリティ)、三菱商事/大成建設(MATERIAL CLUB)/日建設計/丸紅アークログ(大型受託)/プログレッション/POD(VISIOAL関心)等。
- 社内の暗黙知: 計測がほぼ全滅だった/カスタム案件が"超属人"だった/メディア露出が資産化されてない(クリッピングのアーカイブ化が初手)。
- 道具・チャンネル: ダッシュボード samurai-dashboard.vercel.app(本番=mainブランチ)、SAMURAI脳 /brain、Slack #news_and_service(毎日12:00)/#trend-research(15:00)/#新規カスタム案件、CRM=Pipedrive、社内マーケAI体制(marke-orchestrator＋ceo-voice等)。

## 業界の追うべき人・メディア（検証済み・実在確認した本物だけ）
- BIM/建築生産の権威=志手一哉(芝浦工大教授・建築BIM推進会議の学識委員)。建築家側のDX論者=川島範久(明治大准教授・建築家、X @nrhs_kawashima)。
- 建設DXの象徴企業=ANDPAD(稲田武夫CEO・現場管理SaaS最大手)、スパイダープラス(伊藤謙自・建設DX国内初の上場、職人出身)。
- 団体/政策=建設DX研究所(@kensetsuDX_lab)、buildingSMART Japan(BIM国際標準IFC)、国交省 i-Construction 2.0。
- メディア=BuildApp News(建設DX専門・野原グループ)、日経クロステック建設。
※人名・肩書きは"確実に知っている範囲"以外は絶対に創作しない。知らない人物・役職を聞かれたら「それは確認できていない（要・一次情報確認）」と正直に言う。それっぽい肩書きをでっち上げない（過去に架空のインフルエンサーを大量に捏造した失敗がある）。

## 正直ルール（必ず守る）
約束していいのは「道具が実際にやること」。ダメなのは「その結果どうなるか（儲かる・勝てる）」。他社や海外データを自社の効果のように混ぜない。最大値でなく中央値で。知らない/不確かなことはでっち上げず「ここは確認が要る（要確認）」と正直に言う。
`

// ── 喋り方・出力ルール（今日の対話のトーン）────────────────────────
const SYSTEM = `あなたはSAMURAI ARCHITECTSの自社マーケ担当者にとっての「なんでも知ってるお兄さん（兄さん）」です。相手は建築もマーケも背景ゼロ。下の【基礎知識】を土台に、頼れる兄ちゃんとして答えてください。

# 兄さんの性格・喋り方
- 聞かれたら何でも、わかりやすく教える。でも押し付けない（聞かれてないのに長々説教しない）。
- 専門用語は日常語に言い換え（「要するに○○」）＋できればたとえ話を1つ。1個ずつ・短く・フランクに。
- 距離感は相手に合わせる：サクッと聞かれたらサクッと、「ちゃんと分かりたい」風なら今日の続きのようにじっくり。会話の流れ（これまでのやりとり）を踏まえ、前の話の上に積む。
- じっくり教えるときは、時々「これどう思う？」と当てさせ、相手が答えたら拾って褒める／そっと直す。脱線にも付き合う。区切りで「ここまで腹落ちしたね」と軽く整理。
- どんな話題でも、自然に「で、SAMURAIにどう効くか」を一言添える。
- 中央値で正直に。誇張・最大値・他社データの自社化はしない。知らない/不確かは「要確認」と正直に言う。
- ユーザーがURLを貼ると、システムが裏でそのページの中身を取って渡す。中身があればそれを読んで答え、取れなかった時は正直に「そのページは読めなかった（本文をコピペしてくれたら読めるよ）」と言う。想像で中身をでっち上げない。

# ニュース・記事・一覧を貼られたら（判定モード）
各項目に：・一言（中学生にも分かる）／・SAMURAIに：🔴競合 / ⚠️脅威 / 🟢追い風 / 🎓研究(まだ遠い) / ⚪無関係 のどれか＋理由／・だから（マーケ営業でどう効くか。効かないなら「今は気にしなくてOK」）。

【基礎知識】
${BRAIN_KNOWLEDGE}`

const redis = (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
  ? new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN })
  : null

// 兄さんが「URLを読める」ように：ページ本文をテキスト抽出（/api/scrape と同じ方式）
async function fetchPageText(url: string): Promise<string> {
  try {
    // 実ブラウザのUAで取りに行く（"bot"入りUAは多くのサイト/データセンターIPで弾かれるため）
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(12000),
    })
    if (!r.ok) return ''
    const html = await r.text()
    // メタ情報(og:title/og:description/title/description)を先に拾う＝JSレンダリングや本文が薄いページでも要点は渡せる
    const metaContent = (key: string, attr: 'property' | 'name') => {
      const tag = html.match(new RegExp(`<meta[^>]*\\b${attr}=["']${key}["'][^>]*>`, 'i'))?.[0] || ''
      return tag.match(/\bcontent=["']([^"']*)["']/i)?.[1]?.trim() || ''
    }
    const title = metaContent('og:title', 'property') || (html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim() || '')
    const desc = metaContent('og:description', 'property') || metaContent('description', 'name')
    const body = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    const head = [title && `タイトル: ${title}`, desc && `概要: ${desc}`].filter(Boolean).join('\n')
    return ((head ? head + '\n\n' : '') + body).slice(0, 6000).trim()
  } catch { return '' }
}

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 })

  try {
    const body0 = await request.json()
    const incoming = Array.isArray(body0.messages) ? body0.messages : null
    const single = body0.input
    if (!incoming && (!single || !String(single).trim())) {
      return NextResponse.json({ error: '入力が空です' }, { status: 400 })
    }
    // 会話の記憶（兄さんが前の話を踏まえられるよう、直近のやりとりを渡す）
    const messages = incoming
      ? incoming.slice(-16)
          .map((m: any) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content || '').slice(0, 12000) }))
          .filter((m: any) => m.content.trim())
      : [{ role: 'user', content: String(single).slice(0, 12000) }]

    // 直近のユーザー発言にURLがあれば、そのページの中身を取りに行って兄さんに渡す（兄さんが"読める"ように）
    let sources: string[] = []
    const lastUser = [...messages].reverse().find((m: any) => m.role === 'user')
    if (lastUser) {
      const rawUrls = (lastUser.content.match(/https?:\/\/[^\s）)」』】、,]+/g) || []).slice(0, 2)
      // Google News の中継URLは実記事URLに変換してから取りに行く（でないと本文が読めない）
      const urls = await Promise.all(rawUrls.map((u: string) => resolveGoogleNewsUrl(u)))
      if (urls.length) {
        sources = urls
        const pages = await Promise.all(urls.map(async (u: string) => {
          const t = await fetchPageText(u)
          return t ? `■ ${u} の中身（抜粋）:\n${t}` : `■ ${u} は読めませんでした（ログイン必須/取得失敗の可能性）`
        }))
        lastUser.content = `${lastUser.content}\n\n----\n[システム補足：ユーザーが貼ったページを取得しました。下の"中身"を読んで答えてください。読めなかったものは正直にそう伝えて]\n${pages.join('\n\n')}`
      }
    }

    // 現在のマーケ・ブリーフ（別セッションCCが生成した最新の自社・戦況）。あれば最優先の前提に。
    let briefBlock = ''
    try {
      const brief = redis ? await redis.get<any>('samurai:brain-brief') : null
      if (brief && brief.text) {
        briefBlock = `\n\n# 【最重要】現在のマーケ・ブリーフ（最新の自社・市場の状況。これを最優先の前提に答える）\n更新: ${brief.updatedAt || ''}\n${String(brief.text).slice(0, 10000)}`
      }
    } catch { /* briefは任意 */ }

    // 毎朝のSlack新着（phase2）。あれば"最近の動き"として記憶に足す。
    let feedBlock = ''
    try {
      const feed = redis ? await redis.get<any[]>('samurai:brain-feed') : null
      if (Array.isArray(feed) && feed.length) {
        feedBlock = `\n\n# 最近Slackで流れた新着（参考・直近${feed.length}件）\n` +
          feed.slice(0, 40).map((f: any) => `- ${typeof f === 'string' ? f : (f.text || f.title || JSON.stringify(f))}`).join('\n')
      }
    } catch { /* feedは任意。失敗しても無視 */ }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2000,
        system: SYSTEM + briefBlock + feedBlock,
        messages,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      return NextResponse.json({ error: `Anthropic error ${res.status}`, detail: data }, { status: 500 })
    }
    const answer = data.content?.[0]?.text || '（回答を取得できませんでした）'
    return NextResponse.json({ answer, sources })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
