// 原生JavaScript实现字符串长度截取
// 原生JavaScript获取域名主机
// 原生JavaScript清除空格
// 原生JavaScript替换全部
// 原生JavaScript转义html标签
// 原生JavaScript还原html标签
// 原生JavaScript时间日期格式转换
// 原生JavaScript判断是否为数字类型
// 原生JavaScript设置cookie值
// 原生JavaScript获取cookie值
// 原生JavaScript加入收藏夹
// 原生JavaScript设为首页
// 原生JavaScript判断IE6
// 原生JavaScript加载样式文件
// 原生JavaScript返回脚本内容
// 原生JavaScript清除脚本内容
// 原生JavaScript动态加载脚本文件
// 原生JavaScript返回按ID检索的元素对象
// 原生JavaScript返回浏览器版本内容
// 原生JavaScript元素显示的通用方法
// 原生JavaScript中有insertBefore方法, 可惜却没有insertAfter方法 ? 用如下函数实现
// 原生JavaScript中兼容浏览器绑定元素事件
// 原生JavaScript光标停在文字的后面，文本框获得焦点时调用
// 原生JavaScript检验URL链接是否有效
// 原生JavaScript格式化CSS样式代码
// 原生JavaScript压缩CSS样式代码
// 原生JavaScript获取当前路径
// 原生JavaScriptIP转成整型
// 原生JavaScript整型解析为IP地址
// 原生JavaScript实现checkbox全选与全不选
// 原生JavaScript判断是否移动设备
// 原生JavaScript判断是否移动设备访问
// 原生JavaScript判断是否苹果移动设备访问
// 原生JavaScript判断是否安卓移动设备访问
// 原生JavaScript判断是否Touch屏幕
// 原生JavaScript判断是否在安卓上的谷歌浏览器
// 原生JavaScript判断是否打开视窗
// 原生JavaScript获取移动设备初始化大小
// 原生JavaScript获取移动设备最大化大小
// 原生JavaScript获取移动设备屏幕宽度
// 原生JavaScript完美判断是否为网址
// 原生JavaScript根据样式名称检索元素对象
// 原生JavaScript判断是否以某个字符串开头
// 原生JavaScript判断是否以某个字符串结束
// 原生JavaScript返回IE浏览器的版本号
// 原生JavaScript获取页面高度
// 原生JavaScript获取页面scrollLeft
// 原生JavaScript获取页面可视宽度
// 原生JavaScript获取页面宽度
// 原生JavaScript获取页面scrollTop
// 原生JavaScript获取页面可视高度
// 原生JavaScript跨浏览器添加事件
// 原生JavaScript跨浏览器删除事件
// 原生JavaScript去掉url前缀
// 原生JavaScript随机数时间戳
// 原生JavaScript全角半角转换, iCase: 0全到半，1半到全，其他不转化
// 原生JavaScript确认是否键盘有效输入值
// 原生JavaScript获取网页被卷去的位置
// 原生JavaScript另一种正则日期格式化函数 + 调用方法
// 原生JavaScript时间个性化输出功能
// 原生JavaScript解决offsetX兼容性问题
// 原生JavaScript常用的正则表达式
// 原生JavaScript实现返回顶部的通用方法
// 原生JavaScript获得URL中GET参数值
// 原生JavaScript实现全选通用方法
// 原生JavaScript实现全部取消选择通用方法
// 原生JavaScript实现打开一个窗体通用方法
// 原生JavaScript判断是否为客户端设备
// 原生JavaScript获取单选按钮的值
// 原生JavaScript获取复选框的值
// 原生JavaScript判断是否为邮箱
// 原生JavaScript判断是否有列表中的危险字符
// 原生JavaScript判断字符串是否大于规定的长度
// 原生JavaScript判断字符串是为网址不区分大小写
// 原生JavaScript判断字符串是否为小数
// 原生JavaScript判断字符串是否为整数
// 原生JavaScript判断字符串是否为浮点数
// 原生JavaScript判断字符是否为A - Za - z英文字母
// 原生JavaScript判断字符串是否邮政编码
// 原生JavaScript判断字符是否空NULL
// 原生JavaScript用正则表达式提取页面代码中所有网址
// 原生JavaScript用正则表达式清除相同的数组(低效率)
// 原生JavaScript用正则表达式清除相同的数组(高效率)
// 原生JavaScript用正则表达式按字母排序，对每行进行数组排序
// 原生JavaScript字符串反序
// 原生JavaScript用正则表达式清除html代码中的脚本
// 原生JavaScript动态执行JavaScript脚本
// 原生JavaScript动态执行VBScript脚本
// 原生JavaScript实现金额大写转换函数
// 原生JavaScript常用的正则表达式大收集
// 原生JavaScript实现窗体改变事件resize的操作（兼容所以的浏览器）
// 原生JavaScript用正则清除空格分左右
// 原生JavaScript判断变量是否空值
// 原生JavaScript实现base64码
// 原生JavaScript实现utf8解码
// 原生JavaScript获取窗体可见范围的宽与高
// 原生JavaScript判断IE版本号（既简洁、又向后兼容！）
// 原生JavaScript获取浏览器版本号
// 原生JavaScript半角转换为全角函数
// 原生JavaScript全角转换为半角函数

/**
 * 原生JavaScript实现字符串长度截取
 */
function cutstr(str, len) {
  var temp;
  var icount = 0;
  var patrn = /[^\x00-\xff]/;
  var strre = "";
  for (let i = 0; i < str.length; i++) {
    if (icount < len - 1) {
      temp = str.substr(i, 1);
    } else {
    }
  }
}
