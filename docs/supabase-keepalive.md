# Supabase 免费项目保活

Supabase 免费项目如果持续低活跃，可能会被自动暂停。这个项目继续用 GitHub Actions 做轻量保活：每天读取一次公开表，成功后自动提交仓库保活记录。不写入数据库，也不影响住户页面。

## 已实装内容

- 工作流：`.github/workflows/supabase-keepalive.yml`
- 脚本：`scripts/supabase-keepalive.mjs`
- 频率：每天香港时间 08:17（UTC 00:17），GitHub 调度可能延迟；也可以在 GitHub Actions 页面手动运行 `main` 分支
- 保活记录：`.github/keepalive/last-success.txt`，只保留最近一次成功的 UTC 时间、运行链接和查询结果
- 查询内容：
    - `vote_counts`
    - `shop_comments`
    - `free_notes`

## 自动提交仓库活动

三个数据库查询全部成功后，工作流使用 GitHub 自带的 `GITHUB_TOKEN`，以 `github-actions[bot]` 身份提交保活记录到 `main`。仅该任务授予 `contents: write`，不需要个人访问令牌或外部定时服务账号。

自动提交用于维持仓库活动，降低定时工作流因 60 天无仓库活动而被停用的风险。自动提交包含 `[skip ci]`；`GITHUB_TOKEN` 产生的推送不会递归触发普通 push 工作流，避免每日重复构建和部署。

查询失败时不更新成功记录；推送失败时任务会报错，并保留上一次成功记录。如果以后启用分支保护并禁止机器人直接推送，需要重新调整方案。工作流已暂停、权限变化或平台策略变化时，不能保证自动恢复，也不能保证 Supabase 永不暂停。

排障时先检查 Actions 的失败通知、最近运行和记录日期。若出现停用提示，点击 `Continue running workflow` 或 `Enable workflow`，然后手动运行。数据库状态在 Supabase Dashboard 检查；若为 Paused，需恢复项目后重试。

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
5. 运行结果里看到三行 `ok (200)`，并确认 `Commit successful keepalive record` 步骤成功。
6. 在 `main` 分支确认出现机器人提交，且 `.github/keepalive/last-success.txt` 指向本次运行。

## 本地 dry run

只检查脚本和地址拼接，不真的访问 Supabase：

```powershell
$env:SUPABASE_URL="https://example.supabase.co"
$env:SUPABASE_ANON_KEY="test-anon-key"
$env:SUPABASE_KEEPALIVE_DRY_RUN="1"
npm run supabase:keepalive
```
