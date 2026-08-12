# techo-wiki スキル

Claude（Claude Code / claude.ai Cowork / モバイルアプリ）から techo アプリの Wiki を操作するためのスキル。

## セットアップ

`SKILL.md` 内の `<AUTH_PASSWORD>` を実際のパスワードに置き換えてから配置する。
**パスワード入りの SKILL.md をこのリポジトリにコミットしないこと**（public リポジトリのため）。

### Claude Code

```bash
mkdir -p ~/.claude/skills/techo-wiki
sed 's/<AUTH_PASSWORD>/実際のパスワード/' skills/techo-wiki/SKILL.md > ~/.claude/skills/techo-wiki/SKILL.md
```

ユーザーレベルスキルとして全セッションで利用可能になる（「Wikiに追加して」等の依頼で自動発動）。

### claude.ai（Cowork / モバイルアプリ）

1. パスワード置換済みの `SKILL.md` を `techo-wiki/SKILL.md` の構造で ZIP 化
2. claude.ai → Settings → Capabilities → Skills でアップロード
3. コード実行（ネットワークアクセス）が有効な環境で動作
