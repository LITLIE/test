# 原创建筑表面纹理

六张 1024 × 1024 无损 WebP 由 `src/features/experience/scene/architecturalTextures.ts` 的确定性高度场生成。作者为 AskWay site，生成数据以 CC0 1.0 提供；没有使用照片、外部模型或新增依赖。大小和 SHA-256 见 `sources.json`。

- 壳板：轻微拉丝与低幅起伏；板缝在材质 shader 中按像素导数抗锯齿，并在远景降低对比。
- 铺装：四列模块的细缝与石面起伏；场景中的纹理重复按约 1 米铺装单元校准。
- 沥青：细颗粒、接近漫反射的高粗糙度。

`architecturalPixels(kind, channel, 1024)` 返回 RGBA 字节。用 Pillow 12.3.0 将其按 RGBA 建图，以 `save(path, 'WEBP', lossless=True, method=6)` 保存；法线为 OpenGL 切线空间，粗糙度为 RGB 相同的线性数据，两者均不设 sRGB。颜色由材质的色值承担。运行时另有相同算法的 128px 临时材质，资源失败时仍能显示完整场景。

六张纹理共 746,226 字节，按需随三维场景加载；未压缩的 RGBA 纹理加 mipmap 约增加 32 MiB GPU 内存。移动端需要真实设备验证。生成工具使用项目内临时目录，并以 Python `-B` / `PYTHONDONTWRITEBYTECODE=1` 执行。
