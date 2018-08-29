// 第一， 基本要求

// 区分大小写
// 标识符要求： 第一个字符必须是 字母， 下划线，或者美元符号 $
// 建议藏用 驼峰 命名原则
// 注释的两种方式： 当行注释， 块级注释
// 严格模式，再代码底部添加 use strict
"use strict"; // 启用严格模式，

function doSomething() {
  "use strict"; // 函数启用严格模式
}

//语句

/**
 * 第一，语句结尾的 分号可以省略，但是不推荐
 * 第二，建议始终使用{}，分割代码块，尽管有时不必这么做。
 */

/**************************** 保留字*******************************************
 * 需要注意的使用严格模式，要多几个关键字
 *
 * let,  yield,public, static, package, interface, implements.eval, arguments.
 *
 ****************************************************************************/

/** 变量****************************************************
 *
 *  定义变量是，使用 var 操作符
 *
 *********************************************************/

var message = "hi"; // 局部变量，如果再函数中定义，推出函数，变量被销毁。

function test(param) {
  var messageInFunctionAsBlockVar = "hi";
  // messageInFunctionAsGlobalVar = "hello"; // 在严格模式，报错
}
test();
// console.log(messageInFunction); // 会报错

// console.log(messageInFunctionAsGlobalVar); // 不会报错

/** 数据类型
 *
 *  提供5中最简单的数据类型：
 *      Undifined, Null, Boolean, Number, String.
 *
 * 还有一个钟复杂类型
 *      Object.
 *
 * 重要的函数 typeof()
 *
 *  正对 Object 类型， 每个实例都又这些属性和方法
 *      - Constructor
 *      - hasOwnProperty(propertyName)
 *      - isPrototypeOf(object)
 *      - propertyIsEnumerable(property_name)
 *      - toLocalString()
 *      - toString()
 *      - valueOf()
 *
 */

var o = new Object();
var o1 = new Object(); // 有效，不推荐省略圆括号

///////////////////////////////////////////////////////////////////

///////////////////////////////////////////////////////////////////
// 一元操作符的 加 和 减 的 数值转换

var s1 = "01";
var s2 = "1.1";
var s3 = "z";
var b = false;
var f = 1.1;
var o = {
  valueOf: function() {
    return -1;
  }
};
