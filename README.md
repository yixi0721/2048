# 2048 v1.1

本地运行的 2048 网页游戏，支持手机触控和电脑方向键、4×4 与 5×5 棋盘、普通模式与纯净模式、主题皮肤、道具、成就和本地存档。无需安装第三方网页依赖。

## 启动

需要 Node.js。进入项目目录运行：

```sh
npm start
```

然后打开 <http://localhost:8080/>。也可以运行 `node server.js`。请通过本地服务访问页面，直接双击 HTML 无法加载 ES modules。

## 构建与测试

```sh
npm run build
npm test
```

构建产物位于 `dist/`。Android 安装包请从 GitHub Releases 下载。

## 数据与玩法

- 普通模式和纯净模式分别保存 4×4、5×5 棋局、最高分、合成统计和成就；纯净模式不提供道具。
- 奶油、薄荷、蜜桃、月夜初始可用；挑战皮肤在首次合成 128、256、512、1024 时依次解锁。
- 每种道具最多存 50 个；道具获取方式和效果见道具抽屉。
- 主题、棋局、分数和设置保存在本机浏览器存储中。

## 1.1 更新

详见 [CHANGELOG.md](CHANGELOG.md)。

## 下载 v1.1

- [网页端 ZIP](https://raw.githubusercontent.com/yixi0721/2048/main/release-assets/v1.1/2048-%E7%BD%91%E9%A1%B5%E7%AB%AF-1.1.zip)
- [Android 普通版 APK](https://raw.githubusercontent.com/yixi0721/2048/main/release-assets/v1.1/2048-%E6%99%AE%E9%80%9A%E7%89%88-1.1.apk)
- [Android 全皮肤解锁版 APK](https://raw.githubusercontent.com/yixi0721/2048/main/release-assets/v1.1/2048-%E5%85%A8%E7%9A%AE%E8%82%A4%E8%A7%A3%E9%94%81%E7%89%88-1.1.apk)
