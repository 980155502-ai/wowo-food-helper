# 窝窝吃饭小助手 GitHub Pages + Supabase 落地步骤

这条路线的分工很简单：

- GitHub Pages：放 H5 页面本身。
- Supabase：保存住户投票、餐馆留言、大家随口推荐。
- 47 家店铺主数据：仍然放在前端代码里，修改店铺名单时重新发版。

## 1. 创建 Supabase 项目

1. 打开 Supabase 官网并登录。
2. 点击 `New project`。
3. 项目名建议填 `wowo-food-helper`。
4. Region 选择离国内较近的区域即可，优先 `Singapore` 或 `Tokyo`。
5. 记住数据库密码，后面一般不用频繁输入。
6. 等项目创建完成。

## 2. 建表

1. 进入 Supabase 项目。
2. 左侧点击 `SQL Editor`。
3. 新建一个 Query。
4. 复制 [supabase/wowo_schema.sql](../supabase/wowo_schema.sql) 的全部内容进去。
5. 点击 `Run`。

执行后会得到：

- `restaurant_votes`：记录投票，靠 `restaurant_id + device_id` 防止同设备重复投票。
- `vote_counts`：公开读取的投票统计视图。
- `shop_comments`：单个餐馆留言，最多 36 字。
- `free_notes`：大家随口推荐，店名最多 12 字，推荐最多 28 字。

注意：不要把 `service_role key` 放进前端。前端只使用 `anon public key`。

## 3. 复制 Supabase 前端密钥

1. 左侧点击 `Project Settings`。
2. 点击 `API`。
3. 复制 `Project URL`。
4. 复制 `anon public` key。

本地测试时，在项目根目录新建 `.env.local`：

```env
VITE_SUPABASE_URL=你的 Project URL
VITE_SUPABASE_ANON_KEY=你的 anon public key
```

## 4. 本地构建测试

安装依赖后运行：

```bash
npm install
npm run build:demo
```

如果要构建给自定义子域名使用，运行：

```bash
GITHUB_PAGES_DOMAIN=food.xxx.com npm run build:github-pages
```

Windows PowerShell 写法：

```powershell
$env:GITHUB_PAGES_DOMAIN="food.xxx.com"
npm run build:github-pages
```

构建成功后，`demo-dist` 里会出现静态页面。如果设置了 `GITHUB_PAGES_DOMAIN`，还会自动生成 `demo-dist/CNAME`。

## 5. GitHub Pages 设置

1. 打开仓库 `guokaigdg/animal-island-ui`。
2. 进入 `Settings`。
3. 点击 `Pages`。
4. Source 选择 `Deploy from a branch`。
5. Branch 选择 `gh-pages`，目录选择 `/root`。
6. Custom domain 填你的子域名，例如 `food.xxx.com`。
7. 等 GitHub 检查 DNS。
8. 可以勾选 `Enforce HTTPS` 时就勾上。

## 6. 域名 DNS 设置

进入你购买域名的平台，添加一条解析：

```text
主机记录：food
记录类型：CNAME
记录值：guokaigdg.github.io
```

保存后等待 DNS 生效，通常几分钟到数小时不等。

## 7. 发布到 GitHub Pages

第一次发布前，确保本地已经设置 Supabase 环境变量和域名：

```powershell
$env:VITE_SUPABASE_URL="你的 Project URL"
$env:VITE_SUPABASE_ANON_KEY="你的 anon public key"
$env:GITHUB_PAGES_DOMAIN="food.xxx.com"
npm run deploy:github-pages
```

发布完成后，访问：

```text
https://food.xxx.com
```

## 8. 上线后测试清单

1. 手机浏览器打开 `https://food.xxx.com`，页面能正常加载。
2. 随机餐馆、筛选、查看全部餐馆都能看到 47 家核准店铺。
3. 点击餐馆的 `查看店铺位置`，能打开对应高德店铺位置。
4. 给一家店投票，刷新后票数仍保留。
5. 同一台手机对同一家店重复投票，不会重复增加。
6. 给一家店留言，换浏览器也能看到。
7. 发一条“大家随口推荐”，刷新后仍保留。

## 9. 后续什么时候需要升级

第一版免费方案够做验证，但它不是最强防刷方案。出现下面情况再升级：

- 有人恶意刷留言或投票。
- 需要人工审核后台。
- 需要店铺名单在线编辑。
- 需要国内访问速度更稳定。

到那时再加 Supabase Edge Function、验证码、管理后台或迁移到国内云服务。
