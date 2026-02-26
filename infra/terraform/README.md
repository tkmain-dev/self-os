# Techo App - Terraform インフラ構成

GCP 上に Cloud Run + IAP 認証付きロードバランサーでアプリケーションをデプロイするための Terraform 構成です。

## アーキテクチャ

```
Internet (ユーザー)
  → Google OAuth → IAP
  → Application Load Balancer (静的グローバルIP + SSL)
  → Cloud Run v2 (asia-northeast1)
  → Cloud Storage FUSE マウント (/data/techo.db)
```

## 前提条件

- **Terraform** >= 1.6
- **gcloud CLI** がインストール・認証済み
- **GCP Billing Account** が有効

### Billing Account ID の確認方法

```bash
gcloud billing accounts list
```

表示される `ACCOUNT_ID` (例: `XXXXXX-XXXXXX-XXXXXX`) を控えてください。

### gcloud 認証

```bash
gcloud auth login
gcloud auth application-default login
```

## セットアップ手順

### 1. terraform.tfvars の作成

`terraform.tfvars` ファイルを作成し、必要な変数を設定します。

```hcl
billing_account = "XXXXXX-XXXXXX-XXXXXX"  # あなたの Billing Account ID
owner_email     = "your-email@gmail.com"   # IAP アクセス用の Gmail アドレス

# 以下はオプション（デフォルト値あり）
# region      = "asia-northeast1"
# github_repo = "tkmain-dev/self-os"
# image_tag   = "latest"
```

### 2. Terraform の初期化と適用

```bash
terraform init
terraform plan    # 変更内容を確認
terraform apply   # リソースを作成（確認プロンプトで yes を入力）
```

適用完了後、以下の情報が出力されます:

- `project_id` - 作成された GCP プロジェクト ID
- `lb_ip` - ロードバランサーの IP アドレス
- `app_url` - アプリケーションの URL
- `artifact_registry_repo` - Docker イメージの push 先
- `workload_identity_provider` - GitHub Actions の WIF プロバイダ名
- `github_actions_sa_email` - GitHub Actions 用サービスアカウント

### 3. 初回デプロイ

Terraform 適用後、Cloud Run にはまだコンテナイメージがないため、初回は手動でイメージをビルド・プッシュする必要があります。

```bash
# 出力値を変数に格納
PROJECT_ID=$(terraform output -raw project_id)
REGION=$(terraform output -raw region)
REPO=$(terraform output -raw artifact_registry_repo)

# Docker 認証設定
gcloud auth configure-docker ${REGION}-docker.pkg.dev

# イメージをビルドしてプッシュ（リポジトリのルートで実行）
docker build -t ${REPO}/techo-app:latest ../../..
docker push ${REPO}/techo-app:latest

# Cloud Run サービスを更新（初回のみ）
gcloud run services update techo-app \
  --project=${PROJECT_ID} \
  --region=${REGION} \
  --image=${REPO}/techo-app:latest
```

以降のデプロイは GitHub Actions が自動で行います。

### 4. アクセス確認

```bash
# アプリ URL を確認
terraform output app_url
```

1. 出力された URL にブラウザでアクセスしてください
2. Google OAuth 認証画面が表示されます
3. `owner_email` で指定した Gmail アカウントでログインしてください
4. IAP 認証が完了するとアプリケーションが表示されます

**注意**: SSL 証明書のプロビジョニングには最大 15-20 分かかる場合があります。証明書が有効になるまで HTTPS アクセスでエラーが出ることがあります。

## GitHub Actions の設定

リポジトリの Settings > Secrets and variables > Actions で以下の変数を設定してください:

| 変数名 | 値 | 取得方法 |
|--------|------|----------|
| `GCP_PROJECT_ID` | プロジェクト ID | `terraform output project_id` |
| `GCP_REGION` | リージョン | `terraform output region` |
| `WIF_PROVIDER` | WIF プロバイダ | `terraform output workload_identity_provider` |
| `SA_EMAIL` | SA メール | `terraform output github_actions_sa_email` |

## リソースの削除

全リソースを削除するには:

```bash
terraform destroy
```

`deletion_policy = "DELETE"` が設定されているため、GCP プロジェクトごと削除されます。

## 注意事項

- `google_iap_brand` は GCP プロジェクトにつき 1 つしか作成できません。既にブランドが存在するプロジェクトでは作成に失敗します。
- Cloud Run の ingress は `INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER` に設定されており、ロードバランサー経由でのみアクセス可能です。
- SQLite の永続化には Cloud Storage FUSE を使用しています。同時書き込みが発生する場合は別のデータベースへの移行を検討してください。
