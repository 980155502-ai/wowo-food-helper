# Supabase 免费项目保活

Supabase 免费项目如果 7 天内数据库活动太少，可能会被自动暂停。这个项目用 GitHub Actions 做轻量保活：每 12 小时读取一次公开表，不写入数据，也不影响住户页面。

## 已实装内容

- 工作流：`.github/workflows/supabase-keepalive.yml`
- 脚本：`scripts/supabase-keepalive.mjs`
- 频率：每 12 小时一次，也可以在 GitHub Actions 页面手动运行
- 查询内容：
    - `vote_counts`
    - `shop_comments`
    - `free_notes`

## 需要在 GitHub 配好的 Secrets

这个工作流复用前端发布已经需要的两项密钥：

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

位置：

1. 打开 GitHub 仓库。
2. 进入 `Settings`。
3. 进入 `Secrets and variables`。
4. 进入 `Actions`。
5. 确认 `Repository secrets` 里有上面两项。

如果之前 H5 的投票和留言已经能同步到 Supabase，通常说明这两项已经配好了。

## 手动验证

1. 打开 GitHub 仓库。
2. 进入 `Actions`。
3. 左侧选择 `Supabase Keepalive`。
4. 点击 `Run workflow`。
5. 运行结果里看到三行 `ok` 就说明保活查询成功。

## 本地 dry run

只检查脚本和地址拼接，不真的访问 Supabase：

```powershell
$env:SUPABASE_URL="https://example.supabase.co"
$env:SUPABASE_ANON_KEY="test-anon-key"
$env:SUPABASE_KEEPALIVE_DRY_RUN="1"
npm run supabase:keepalive
```
