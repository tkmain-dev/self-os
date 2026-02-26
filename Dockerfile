# Stage 1: Build frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Production server
FROM node:20-alpine AS runner
WORKDIR /app

# better-sqlite3 のネイティブモジュールビルドに必要
RUN apk add --no-cache python3 make g++

COPY package*.json ./
# devDependencies も含めてインストール (tsx, better-sqlite3 ビルドのため)
RUN npm ci

# better-sqlite3 をリビルド
RUN npm rebuild better-sqlite3

# ビルド済みフロントエンドをコピー
COPY --from=frontend-builder /app/dist ./dist

# サーバーコードをコピー
COPY server ./server
COPY tsconfig.json ./

# data ディレクトリ作成（ローカル開発用フォールバック）
RUN mkdir -p data

EXPOSE 3001
ENV NODE_ENV=production

CMD ["npx", "tsx", "server/index.ts"]
