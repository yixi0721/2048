# 2048 与扫雷 v1.3

本地运行的 2048 与扫雷网页游戏。2048 支持 4×4 与 5×5 棋盘、普通模式与纯净模式、主题皮肤、道具和本地存档；扫雷支持三档难度、插旗、棋盘缩放和按难度保存的最佳用时。无需安装第三方网页依赖。

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

## v1.3 下载

- [网页版 ZIP](release-assets/v1.3/2048-web-v1.3.zip)
- [Android 普通版 APK](release-assets/v1.3/2048-android-v1.3.apk)
- [Android 全皮肤版 APK](release-assets/v1.3/2048-android-all-skins-v1.3.apk)

## 数据与玩法

- 普通模式和纯净模式分别保存 4×4、5×5 棋局、最高分、合成统计和成就；纯净模式不提供道具。
- 奶油、薄荷、蜜桃、月夜初始可用；挑战皮肤在首次合成 128、256、512、1024 时依次解锁。
- 每种道具最多存 50 个；道具获取方式和效果见道具抽屉。
- 主题、棋局、分数和设置保存在本机浏览器存储中。

## 更新日志

详见 [CHANGELOG.md](CHANGELOG.md)。

