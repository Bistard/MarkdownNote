<h1 align="center">Nota (开发中)</h1>
<div align="center">
  |
  <a href="README.md">en</a>
  |
  <a href="doc/readme/zh-cn.md">zh-cn</a>
  |
  <a href="doc/readme/zh-tw.md">zh-tw</a>
  |
</div>

<br>

一款开源、提供WYSIWYG和良好的笔记用户体验的笔记软件 / markdown编辑器。(如果你对该项目感兴趣，非常欢迎联系我😀~ 目前开发周期还很长).

## 🚪传送门
- [💖特性](#💖特性)
- [👁‍🗨截图](#👁‍🗨截图-2022116)
- [🏃开始使用！](#🏃-开始使用)
- [📚维基](https://github.com/Bistard/nota/wiki)
- [💭讨论](https://github.com/Bistard/nota/discussions)
- [💎进度](https://github.com/Bistard/nota/discussions/88)


## 💖特性
* [x] 支持 markdown WYSIWYG(所见即所得)
> * 现在我们正在使用 *milkdown* 作为我们的 WYSIWYG 渲染框架. 完成大部分的软件功能后，我们的目标是构建自己的markdown渲染器（更高性能）。
* [ ] 出色的 类笔记式 用户体验
> * *Nota* 有潜力创造一个整洁而强大的笔记本结构，用户可以实现无限的页面嵌套。
> 
> * 对于新用户（无原始md文件），ta们可以创建不同的笔记本，并通过拖放页面来管理他们的笔记（markdown 文件），实现文件分级。
> 
> * 对于已经拥有大量原始 markdown 文件的用户，应用程序可以自动解析目录并构建相应的笔记本结构。
* [ ] 侧面大纲显示
> * 与 Typora 和 marktext 不同, 你无需点击侧边按钮来显示当前文件大纲，我们的软件将大纲渲染在角落里，以便实时查看与跳转.
* [x] 高性能的滚动渲染
> * 对于任何可滚动组件，只有视口内的事物会被渲染。在我们的软件中, 目录显示和 Markdown 所见即所得渲染（在我们未来的版本中）将使用此技术，以此确保视口内同时只有少量事物被渲染。
* [ ] 支持 git 扩展
> * 我们的应用程序将默认支持 git（类似于 vscode）。
* [ ] 支持主题
> * 我们将提供一些默认主题。 此外，用户可以使用插件自定义自己的页面主题。

## 👁‍🗨截图 (2022.1.16)
> * 当前（2022.4.30）的UI设计离GOOD还很远。
> 
> * 因为还能没有为 *Nota* 提供完美的 UI 设计，我们的重心仍在开发应用程序的基础（后端）。 因此，近期软件截图将暂停更新。
> * 如果你擅长软件UI设计，欢迎与我联系！

![screenshot](../../doc/images/2022.1.16.png)

## 🏃 开始使用！
如何从源代码运行应用程序：
```
git clone https://github.com/Bistard/nota.git
cd nota
npm install
npm start
```