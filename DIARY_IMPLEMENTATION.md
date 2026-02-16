# Diary コンポーネント - BlockNote 実装ドキュメント

## 概要
Diaryコンポーネントを従来のtextareaベースからBlockNoteを使用したNotionライクなMarkdownエディタに実装しました。

## インストールしたパッケージ

```json
{
  "@blocknote/core": "^0.46.2",
  "@blocknote/react": "^0.46.2",
  "@blocknote/mantine": "^0.46.2",
  "@mantine/core": "^8.3.15",
  "@mantine/hooks": "^8.3.15"
}
```

合計204パッケージが追加されました（依存関係含む）。

## 実装したファイル

### 1. `/home/tkmain/workspace/techo-app/src/components/Diary.tsx`
- BlockNoteエディタの統合
- 既存の日付ナビゲーション機能を維持
- API連携（GET/PUT）を維持
- 自動保存機能を追加（5秒後に自動保存）
- 変更検知と保存状態の表示

### 2. `/home/tkmain/workspace/techo-app/src/index.css`
- BlockNote専用のカスタムCSSを追加
- techo-appのデザイン（amber/stone系カラー）に統一
- エディタ、ツールバー、メニュー、コードブロック等のスタイリング

## 主な機能

### 1. Notionライクなブロック編集
- **スラッシュコマンド**: `/` を入力してブロックタイプを選択
- **Markdownショートカット**:
  - `#` + スペース → 見出し1
  - `##` + スペース → 見出し2
  - `###` + スペース → 見出し3
  - `-` + スペース → 箇条書きリスト
  - `1.` + スペース → 番号付きリスト
  - `` ` `` + テキスト + `` ` `` → インラインコード
  - `>` + スペース → 引用

### 2. リッチテキスト編集
- **太字**: `Cmd/Ctrl + B` または選択してツールバーから
- **斜体**: `Cmd/Ctrl + I` または選択してツールバーから
- **下線**: `Cmd/Ctrl + U` または選択してツールバーから
- **取り消し線**: ツールバーから選択
- **リンク**: テキストを選択してツールバーからリンクを追加

### 3. 日付ナビゲーション（既存機能を維持）
- 前日ボタン（←）
- 翌日ボタン（→）
- 今日ボタン
- 日付表示（例: 2026年2月16日（日））

### 4. データ永続化
- **保存形式**: JSON形式でBlockNoteのドキュメント構造を保存
- **API連携**:
  - GET `/api/diary/${date}` - 日記データの読み込み
  - PUT `/api/diary/${date}` - 日記データの保存

### 5. 自動保存機能
- 編集から5秒後に自動保存
- 保存ボタンは変更がある場合のみ有効
- 保存状態のフィードバック表示
  - 「保存しました」（保存成功時）
  - 「未保存の変更があります」（変更検知時）

### 6. エラーハンドリング
- ロード中の状態表示
- JSONパースエラーのハンドリング
- 保存エラー時のアラート表示
- 日付変更時の状態リセット

## コンポーネントの状態管理

```typescript
const [date, setDate] = useState<string>          // 現在の日付
const [saved, setSaved] = useState<boolean>       // 保存完了フラグ
const [loading, setLoading] = useState<boolean>   // ローディング状態
const [initialContent, setInitialContent] = useState<PartialBlock[] | undefined>  // 初期コンテンツ
const [hasChanges, setHasChanges] = useState<boolean>  // 変更検知フラグ
```

## データフロー

1. **読み込み時**:
   ```
   ユーザーが日付を選択
   → API GET /api/diary/${date}
   → レスポンスをJSON.parse()
   → BlockNoteのPartialBlock[]に変換
   → エディタに表示
   ```

2. **保存時**:
   ```
   ユーザーが編集
   → 変更検知（hasChanges = true）
   → 5秒後に自動保存 or 手動保存ボタン
   → editor.documentをJSON.stringify()
   → API PUT /api/diary/${date}
   → 保存完了フィードバック
   ```

## デザイン統合

BlockNoteのスタイルをtecho-appの既存デザインに統合：

- **カラーパレット**:
  - プライマリ: `#c8956c` (amber)
  - テキスト: `#2d2a26` (stone-800)
  - 背景: `#f5f0e8` (stone-50)
  - ボーダー: `#d4cdc2` (stone-300)

- **フォント**: 'Techo'フォント（Hiragino Sans等のフォールバック）

- **UI要素**:
  - ツールバー: 紙のような背景色
  - ボタン: hover時にamber系の色
  - 選択範囲: amber系の半透明背景

## 今後の改善提案

### 1. パフォーマンス最適化
- 大量のブロックがある場合の仮想スクロール対応
- デバウンス処理の調整（現在5秒 → カスタマイズ可能に）

### 2. 機能拡張
- **画像アップロード**: BlockNoteの画像ブロックを有効化
- **テーブル**: 表組みブロックの追加
- **チェックリスト**: To-Doリスト形式のブロック
- **カラー**: テキストカラーと背景カラーの設定
- **埋め込み**: YouTube、Twitter等の埋め込み対応

### 3. UX改善
- **キーボードショートカット**: Cmd/Ctrl + S での保存
- **保存確認ダイアログ**: 未保存の変更がある状態で日付変更時に確認
- **エクスポート機能**: Markdown、PDF、HTMLへのエクスポート
- **検索機能**: 日記全体からの検索

### 4. データ移行
- 既存のプレーンテキストデータがある場合、BlockNote形式への移行スクリプト
- Markdownからの一括インポート機能

### 5. モバイル対応
- タッチデバイスでの操作性向上
- レスポンシブデザインの最適化

## 使用上の注意点

### 1. データ形式の変更
- 旧形式: プレーンテキスト（string）
- 新形式: JSON形式のBlockNote構造
- **注意**: 既存のプレーンテキストデータは新形式で上書きされます

### 2. ブラウザ互換性
- モダンブラウザ（Chrome、Firefox、Safari、Edge）推奨
- Internet Explorerは非対応

### 3. パフォーマンス
- 非常に長い日記（数千ブロック）の場合、パフォーマンスが低下する可能性があります
- 推奨: 1日あたり100ブロック以内

### 4. TypeScript型安全性
- BlockNoteの型定義を活用し、コンパイル時の型チェックを実施
- `PartialBlock`型を使用してデータ構造の整合性を保証

## トラブルシューティング

### 問題: エディタが表示されない
- **原因**: CSSが正しく読み込まれていない
- **解決**: `@blocknote/mantine/style.css` と `@blocknote/core/fonts/inter.css` のインポートを確認

### 問題: 日付変更時に前の内容が残る
- **原因**: エディタのコンテンツ更新が適切に行われていない
- **解決**: `editor.replaceBlocks()` の呼び出しを確認

### 問題: 保存ボタンが効かない
- **原因**: `hasChanges` 状態が正しく更新されていない
- **解決**: `editor.onChange()` のリスナー登録を確認

### 問題: 自動保存が頻繁すぎる/遅すぎる
- **原因**: タイマーの設定値
- **解決**: 97行目の `setTimeout` の値（現在5000ms）を調整

## 関連リソース

- [BlockNote公式ドキュメント](https://www.blocknotejs.org/)
- [BlockNote GitHub](https://github.com/TypeCellOS/BlockNote)
- [Mantine UI](https://mantine.dev/)
- [React 19 ドキュメント](https://react.dev/)

## まとめ

BlockNoteを使用したNotionライクなエディタの実装により、以下を達成しました:

✅ リッチテキスト編集機能
✅ Markdownショートカットサポート
✅ 既存API構造の維持
✅ 日付ナビゲーション機能の保持
✅ 自動保存機能の追加
✅ techo-appデザインとの統合
✅ TypeScript型安全性の維持
✅ React 19の最新パターン使用

実装は完了し、すぐに使用可能な状態です。
