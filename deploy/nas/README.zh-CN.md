# Whitebaka NAS 部署

上游保持在 `main`，NAS 定制放在 `whitebaka/nas-v0` 分支。保留 `upstream` 指向
`https://github.com/markusthiel/lumio.git`，便于后续合并更新。

## 当前配置

- 应用目录：`/mnt/user/appdata/photo-proof-v0/lumio`
- 网站：`http://192.168.1.99:8095`
- S3：`http://192.168.1.99:8096`（私有 bucket，浏览器使用签名 URL）
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

正式域名和 Tunnel 配置确定后，使用两个 hostname：

1. 网站域名 → `http://192.168.1.99:8095`
2. S3 域名 → `http://192.168.1.99:8096`

也可以把 cloudflared 加入本项目网络，分别指向 `http://caddy:80` 和
`http://caddy:81`。不要指向 frontend，否则 API、WebSocket 路由会被绕开。

将 `.env` 的 `PUBLIC_URL` 和 `S3_PUBLIC_URL` 改成对应 HTTPS URL，再执行
`docker compose up -d`。不需要路由器端口转发。

初期使用默认缓存行为，不添加 Cache Everything 或强制图片 Edge TTL。
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

## 后续中文化

前端已有字典框架：`apps/frontend/src/lib/i18n/`，入口为
`apps/frontend/src/lib/i18n.tsx`。后续新增中文词典，并同步语言枚举、检测逻辑、
语言选择器与日期数字格式；邮件有独立语言逻辑。先覆盖模特选片流程，再覆盖后台。
本次仅部署与准备 fork，尚未实现中文翻译。

规划与当前上游有两处功能差异：选片额度会同时计入收藏（liked）与选中（pick），
因此“任意收藏、只限制精修选片”需要调整计数逻辑；CSV 导出目前包含文件名和
选择信息，但不含评论正文，如要直接交给后期使用，需补充评论导出。

## 验收范围

部署后需验证：登录、创建图库、上传 Proof、worker 生成预览、分享访问和选片结果。
300–500 张真实项目、大陆宽带/5G 首次加载和真实用户体验仍需要实际环境验收。
