---
name: techo-wiki
description: techo アプリの Wiki ページを REST API で操作する（ページ作成・更新・削除・階層ツリー管理・日記リンク）。ユーザーが「Wikiに追加して」「Wikiページを作って/更新して/消して」「この資料/調査結果をWikiにまとめて」等と依頼したときに使用する。
---

# techo Wiki 操作スキル

techo アプリ（個人用手帳アプリ）の Wiki を REST API で操作する。
Markdown を直接送信でき、サーバー側で BlockNote JSON に自動変換される。

- ベースURL: `https://techo-app-qci2z4yx2q-an.a.run.app`
- 認証: パスワードログイン → セッションcookie

## 1. ログイン（最初に1回）

```bash
curl -s -c /tmp/techo-cookies.txt -X POST \
  https://techo-app-qci2z4yx2q-an.a.run.app/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"password":"<AUTH_PASSWORD>"}'
# => {"ok":true}
```

以降のリクエストは `-b /tmp/techo-cookies.txt` を付ける。
レスポンスがHTMLやauthエラーになったら再ログインする。

## 2. ページツリーの確認（作成・更新の前に必ず実行）

```bash
curl -s -b /tmp/techo-cookies.txt \
  https://techo-app-qci2z4yx2q-an.a.run.app/api/wiki/pages
# => [{"id":1,"parent_id":null,"title":"...","sort_order":0,"updated_at":"..."}, ...]
```

- `parent_id: null` がルートページ。`parent_id` を辿ると階層構造がわかる
- 新規作成前に、適切な親ページの有無・タイトル重複を確認すること

## 3. ページ本文の読み取り

```bash
curl -s -b /tmp/techo-cookies.txt \
  https://techo-app-qci2z4yx2q-an.a.run.app/api/wiki/pages/<ID>
# => { id, parent_id, title, content(BlockNote JSON文字列), links(日記日付の配列), ... }
```

## 4. ページ作成（Markdown可）

```bash
curl -s -b /tmp/techo-cookies.txt -X POST \
  https://techo-app-qci2z4yx2q-an.a.run.app/api/wiki/pages \
  -H 'Content-Type: application/json' \
  -d '{"title":"ページ名","parent_id":null,"markdown":"# 見出し\n\n本文..."}'
```

- `parent_id`: 親ページの id（ルートに置くなら `null`）
- `markdown`: Markdown文字列。見出し/リスト/太字/コードブロック等が変換される
- 長い Markdown は JSON ファイルに書き出して `-d @/tmp/page.json` で送る（シェルエスケープ事故防止）

ページツリーを一括作成する場合は、親を先に POST してレスポンスの `id` を子の `parent_id` に使う。

## 5. ページ更新

```bash
# 本文差し替え（Markdown）
curl -s -b /tmp/techo-cookies.txt -X PATCH \
  https://techo-app-qci2z4yx2q-an.a.run.app/api/wiki/pages/<ID> \
  -H 'Content-Type: application/json' \
  -d '{"markdown":"# 更新後の本文"}'

# タイトル変更 / ツリー移動
#   -d '{"title":"新タイトル"}'
#   -d '{"parent_id":3}'        ← 別ページの子に移動
#   -d '{"parent_id":null}'     ← ルートに移動
```

注意: `markdown` での更新は**本文全体の差し替え**。追記したい場合は先に GET で既存内容を確認し、全文を組み立て直して送る（content は BlockNote JSON なので、読んで要約→新しい Markdown を作る）。

## 6. ページ削除

```bash
curl -s -b /tmp/techo-cookies.txt -X DELETE \
  https://techo-app-qci2z4yx2q-an.a.run.app/api/wiki/pages/<ID>
```

**子ページも CASCADE 削除される**。削除前にツリーを確認し、子ページがある場合はユーザーに確認する。

## 7. 日記との紐付け

```bash
# リンク追加（その日の日記と相互リンクされる）
curl -s -b /tmp/techo-cookies.txt -X POST \
  https://techo-app-qci2z4yx2q-an.a.run.app/api/wiki/pages/<ID>/links \
  -H 'Content-Type: application/json' -d '{"date":"YYYY-MM-DD"}'

# リンク削除
curl -s -b /tmp/techo-cookies.txt -X DELETE \
  https://techo-app-qci2z4yx2q-an.a.run.app/api/wiki/pages/<ID>/links/YYYY-MM-DD
```

## 運用ガイドライン

1. **作成前に必ずツリーを確認**し、内容に合った親ページ配下に置く（例: 調査資料→「調査」配下。適切な親がなければルートに作成 or 親も新規作成）
2. **タイトル重複を避ける**。同名ページがあれば更新か、別名にするかをユーザーに確認
3. **削除は慎重に**。子ページの有無を確認し、意図しない CASCADE 削除を防ぐ
4. 作成・更新後は「どのページを（どの親の下に）作成/更新したか」をページ名とともに報告する
5. 操作に失敗した場合（401等）は再ログインしてリトライする
