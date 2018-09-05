# Javascript

```
重要知识点：

- 函数: 语法，参数，变量作用域，闭包
- 对象: 常用对象
- 常用库
- 严格模式的语法和行为改变

d:\Apps\node-v8.11.3-win-x64\node.exe
```

## 严格模式的行为改变

>

- 全局变量显示声明
- 禁止`this` 关键字只想全局对象
- 禁止删除变量
- 对象不能有重名的属性
- 函数不能有重名的参数
- ...

## 数据类型

---

## 操作符

```javascript
// 操作符 - 重点理解

/** 一元,
 *
 * 递增，递减
 *
 * */

++a;
--a;
a--;
a++;

// 一元，+ - 操作, 如果不是非数值时，会被转型
// false, true 被转成0，1
// 字符串会被按照一组特殊的规则进行解析
// 对象是先条用 valueof()和 toString()方法，再转换得到值
a = +num;
a = -num;
```

```javascript
/* 位操作符 */
```

---

## 语句

---

- if 语句
  >

```javascript
 if (condition) statement1 else statement2
 // condition 可以是任意表达式，而且结果可以不是布尔值， ECMAScript 会自动调用 Boolean() 转换函数转换为布尔值。
```

- do-while

```javascript
do {
  statement;
} while (expression);
// 在对条件表达式求值之前，循环体内的代码至少会被执行一次.
```

- while

```javascript
var i = 0;
while (i < 10) {
  i += 2;
}
// 先计算条件，然后判断是否进入循环；
```

- for

```javascript
// 前测试循环语句， 它具有在执行循环之前，初始化变量，定义循环执行代码的能力
var count = 10;
for (var i = 0; i < count; i++){
    alert(i);
}

for(;;) // 无限循环
```

- for-in

```javascript
// 是一种精准的迭代语句，用来枚举对象的属性
for (property in expression) statement;

for (var propName in window) {
  document.write(propName);
}
```

- lable

- break & continue

```javascript
// break 语句会立刻退出循环， 强制继续执行循环后面的语句
// continue 语句 也是立刻推出循环，但是退出后会从循环的顶部继续执行.
```

- with

- switch

## 函数

---

### 函数基础

```javascript
1. 如果有 `return` 语句， 在执行完 `return` 后，会立即停止并立刻退出， 位于return之后的语句的任何代码，都不会执行.

2. `return` 也可以不返回值， 函数也会直接推出，其实是返回了一个 `undedfined`

3. 关于函数参数
    函数的类型，个数对函数来说，没有限制
    其实再函数内部，所有的参数都会形成一个数组，传给函数， 再函数体内，可以通过 `arguments` 获得这个数组
4. 函数没有重载： 如果定义了同名函数，后一个会覆盖前一个的功能.
```

### 函数表达式

- 递归
- 闭包
- 私有变量

## 变量，作用域 & 内存问题

---

### 基本类型和引用类型的值

    值类型： Undefined, Null, Boolean, Number, String 都是值类型

    引用类型： Object, Array, Data, RegExp, Function

    需要注意的：
    1 .可以添加属性，方法，也可以改变和删除其属性和方法.
    2. 复制变量值
    3. 作为参数， ECMAScript 中所有的参数都是按值传递的，就是说函数外部的值复制给函数内部的参数，就可以值从一个变量复制到另一个变量一样。
    4. *访问变量有按照值和引用两种方式， 而参数只能按照值.

    5. typeof(var), instanceof(ObjectType):

### 执行环境及作用域

```javascript
    1. 代码执行时，会创建变量对象的一个 `作用域链`(scrope chain),其用途保证对执行环境有权访问的所有变量和函数有序访问.
```

当 js 代码执行的时候，会进度不同的执行环境，这些不同的执行环境构成了执行环境栈，

Javascript 中主要存在三种执行环境

- 全局执行环境
  ```
  Javascript 默认的执行环境， 通常被默认位 windows 对象，所有的全局变量和函数都作为 windows 对象的属性和方法;
  ds
  ```
- 函数执行环境

      每个执行环境都有一个与之关联的变量对象（variable object, VO），执行环境中定义的所有变量和函数都会保存在这个对象中，解析器在处理数据的时候就会访问这个内部对象。

- eval() 执行环境

Javascript 的 变量对象



#### 作用域

- 局部作用域:局部变量的优先级高于全局变量。

      1. 函数体内用var声明的变量具有局部作用域，成为局部变量
      2. 函数的参数也具有局部作用域

**JavaScript是函数作用域（function scope），没有块级作用域。无论函数体内的变量在什么地方声明，对整个函数都是可见的，即JavaScript函数里声明的所有变量都被提前到函数体的顶部，只是提前变量声明，变量的赋值还是保留在原位置。**







# 面向对象编程

## 理解对象

## 创建对象

## 继承
