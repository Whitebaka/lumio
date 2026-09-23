# Whitebaka NAS 部署

上游保持在 `main`，NAS 定制放在 `whitebaka/nas-v0` 分支。保留 `upstream` 指向
`https://github.com/markusthiel/lumio.git`，便于后续合并更新。

## 当前配置

- 应用目录：`/mnt/user/appdata/photo-proof-v0/lumio`
- 网站：`http://192.168.1.99:8095`
- S3：与网站同源，`/lumio/*` 转发至私有 bucket，浏览器使用签名 URL。
  `http://192.168.1.99:8096` 保留为局域网独立 S3 入口。
- PostgreSQL、Redis、MinIO：位于应用目录的同级目录，持久化在 NAS。
- 数据库、队列、MinIO 控制台和应用内部端口不映射到宿主机。
- 不挂载摄影素材目录；仅通过网页上传已缩放、清理 EXIF 的 Proof。
- `.env` 保存随机密钥，权限 600；不要提交 Git。

`.env` 设置 `COMPOSE_FILE=docker-compose.yml:docker-compose.nas.yml` 和
`COMPOSE_PROJECT_NAME=photo-proof-v0` 后，在应用目录执行：

```sh
docker compose up -d --build
docker compose ps
docker compose logs --tail=100 api worker
```

需要 Docker Compose >= 2.24.4（配置使用 `!override`）。NAS 当前使用 2.29.2。
构建若需要代理，使用 `docker compose build --build-arg HTTP_PROXY=... --build-arg HTTPS_PROXY=...`。

## 接 Cloudflare Tunnel

正式域名：`lumio.whitebaka.com`。网站与 S3 使用同一个域名；Caddy 保留
`/lumio/*` 给当前名为 `lumio` 的 bucket。更改 bucket 名称时须同步此路由。

Tunnel 运行令牌保存在仓库外 `../cloudflared/.env`，内容为 `TUNNEL_TOKEN=...`。
将 `COMPOSE_FILE` 扩展为
`docker-compose.yml:docker-compose.nas.yml:docker-compose.tunnel.yml`。

在 Cloudflare 此 Tunnel 的 Published application routes 中添加：

- Hostname：`lumio.whitebaka.com`
- Service：HTTP，`caddy:80`
- Path：留空

不要指向 frontend，否则 API、WebSocket、S3 路由会被绕开。连接器运行令牌
只能运行 Tunnel，不能创建 DNS 或公开路由，需要在 Cloudflare 控制台配置。

路由和 DNS 生效后，将 `.env` 的 `PUBLIC_URL` 和 `S3_PUBLIC_URL` 都改成
`https://lumio.whitebaka.com`，再执行 `docker compose up -d`。
不需要路由器端口转发。Caddy 信任 Docker 内网代理的转发协议头，HTTPS 在
Cloudflare 终止。

初期仅保留 Next.js 静态资源的缓存，其余同域路由设置 `no-store`，
不添加 Cache Everything 或强制图片 Edge TTL。
图片是带签名的私有资源，缓存策略必须验证签名过期、撤销和访问隔离后再设计；
规划里的 `/proof/` 是示例，并非当前实际路由。HTML、API 和登录不能强制缓存。

## 备份与升级

备份 `.env`（含密钥）、部署配置、数据库逻辑备份和 MinIO 数据。
不要仅热复制 PostgreSQL 数据目录作为唯一数据库备份。

```sh
umask 077
mkdir -p ../backups
docker compose exec -T postgres pg_dump -U lumio -d lumio -Fc > "../backups/lumio-$(date +%F-%H%M%S).dump"
```

升级前备份数据库，记录 `git rev-parse HEAD` 和容器镜像 ID。数据库迁移可能
导致旧版本不能直接回退。不要使用 `docker compose down -v` 清理持久卷。

## 简体中文（第一批）

中文词典：`apps/frontend/src/lib/i18n/zh.ts`。已覆盖模特端相册解锁、
浏览/筛选、选片额度、评论、图片/视频标注、提交选片、下载及无权限/过期提示，
同时翻译访客上传和照片商店页面，以及通用按钮和登录页。

中文浏览器自动使用简体中文，相册底部可手动选择“简体中文”；手动选择保存
在 `lumio_locale` Cookie 中，优先于浏览器语言。若此前手动选了英文，需手动
切换一次。中文日期、数字格式使用 `zh-CN`。邮件语言不随中文界面切换。

后台未翻译的词条明确回退到英文；摄影师自填的相册标题、说明、标签、商品名称
等不自动翻译。后续沿用现有词典逐步覆盖后台，勿批量修改业务内容。

验证命令（在 `apps/frontend` 中）：

```sh
npm run type-check
npm run check:i18n
npm run check:zh
```

中文检查覆盖访客词条完整性、插值变量、语言优先级和日期/数字格式。
手机评论面板使用整宽，关闭顶部“评论”后返回照片，避免挤压选片按钮。

规划与当前上游有两处功能差异：选片额度会同时计入收藏（liked）与选中（pick），
因此“任意收藏、只限制精修选片”需要调整计数逻辑；CSV 导出目前包含文件名和
选择信息，但不含评论正文，如要直接交给后期使用，需补充评论导出。

## 验收范围

部署后需验证：登录、创建图库、上传 Proof、worker 生成预览、分享访问和选片结果。
300–500 张真实项目、大陆宽带/5G 首次加载和真实用户体验仍需要实际环境验收。
