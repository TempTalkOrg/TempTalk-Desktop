// eslint-disable-next-line strict
function watermark() {
  //默认设置
  var defaultSettings = {
    watermark_txt: 'text',
    watermark_x: 10, //水印起始位置x轴坐标
    watermark_y: 20, //水印起始位置Y轴坐标
    watermark_rows: 100, //水印行数
    watermark_cols: 100, //水印列数
    watermark_x_space: 0, //水印x轴间隔
    watermark_y_space: 0, //水印y轴间隔
    watermark_color: '#ff0000', //水印字体颜色
    watermark_alpha: 0.205, //水印透明度
    watermark_fontsize: '16px', //水印字体大小
    // watermark_font:'微软雅黑',//水印字体
    watermark_width: 108, //水印宽度
    watermark_height: 24, //水印高度
  };

  //采用配置项替换默认值，作用类似jquery.extend
  if (arguments.length === 1 && typeof arguments[0] === 'object') {
    var src = arguments[0] || {};
    for (const key in src) {
      if (src[key] && defaultSettings[key] && src[key] === defaultSettings[key])
        continue;
      else if (src[key]) defaultSettings[key] = src[key];
    }
  }

  var oTemp = document.createDocumentFragment();

  //获取页面最大宽度
  var page_width = Math.max(
    document.body.scrollWidth,
    document.body.clientWidth
  );
  //获取页面最大长度
  var page_height = Math.max(
    document.body.scrollHeight,
    document.body.clientHeight
  );

  //如果将水印列数设置为0，或水印列数设置过大，超过页面最大宽度，则重新计算水印列数和水印x轴间隔
  if (
    defaultSettings.watermark_cols === 0 ||
    parseInt(
      defaultSettings.watermark_x +
        defaultSettings.watermark_width * defaultSettings.watermark_cols +
        defaultSettings.watermark_x_space * (defaultSettings.watermark_cols - 1)
    ) > page_width
  ) {
    defaultSettings.watermark_cols = parseInt(
      (page_width -
        defaultSettings.watermark_x +
        defaultSettings.watermark_x_space) /
        (defaultSettings.watermark_width + defaultSettings.watermark_x_space)
    );
    defaultSettings.watermark_x_space = parseInt(
      (page_width -
        defaultSettings.watermark_x -
        defaultSettings.watermark_width * defaultSettings.watermark_cols) /
        (defaultSettings.watermark_cols - 1)
    );
  }
  //如果将水印行数设置为0，或水印行数设置过大，超过页面最大长度，则重新计算水印行数和水印y轴间隔
  if (
    defaultSettings.watermark_rows === 0 ||
    parseInt(
      defaultSettings.watermark_y +
        defaultSettings.watermark_height * defaultSettings.watermark_rows +
        defaultSettings.watermark_y_space * (defaultSettings.watermark_rows - 1)
    ) > page_height
  ) {
    defaultSettings.watermark_rows = parseInt(
      (defaultSettings.watermark_y_space +
        page_height -
        defaultSettings.watermark_y) /
        (defaultSettings.watermark_height + defaultSettings.watermark_y_space)
    );
    defaultSettings.watermark_y_space = parseInt(
      (page_height -
        defaultSettings.watermark_y -
        defaultSettings.watermark_height * defaultSettings.watermark_rows) /
        (defaultSettings.watermark_rows - 1)
    );
  }
  var x;
  var y;
  for (var i = 0; i < defaultSettings.watermark_rows - 1; i++) {
    y =
      defaultSettings.watermark_y +
      (defaultSettings.watermark_y_space + defaultSettings.watermark_height) *
        i;
    for (var j = 0; j < defaultSettings.watermark_cols; j++) {
      x =
        defaultSettings.watermark_x +
        (defaultSettings.watermark_width + defaultSettings.watermark_x_space) *
          j;

      var mask_div = document.createElement('div');
      mask_div.className = 'simple_blind_watermark';
      mask_div.appendChild(
        document.createTextNode(defaultSettings.watermark_txt)
      );

      mask_div.style.left = x + 'px';
      mask_div.style.top = y + 'px';
      oTemp.appendChild(mask_div);
    }
  }
  document.body.appendChild(oTemp);
}
