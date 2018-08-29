# Javascript

```
重要知识点：

- 函数: 语法，参数，变量作用域，闭包
- 对象: 常用对象
- 常用库
- 严格模式的语法和行为改变
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
~~~ javascript
 if (condition) statement1 else statement2
 // condition 可以是任意表达式，而且结果可以不是布尔值， ECMAScript 会自动调用 Boolean() 转换函数转换为布尔值。
~~~

- do-while

~~~ javascript
do{
    statement;
} while (expression);
// 在对条件表达式求值之前，循环体内的代码至少会被执行一次.
~~~

- while

~~~ javascript
var i = 0;
while(i<10){
    i += 2;
}
// 先计算条件，然后判断是否进入循环；
~~~

- for

~~~ javascript
// 前测试循环语句， 它具有在执行循环之前，初始化变量，定义循环执行代码的能力
var count = 10;
for (var i = 0; i < count; i++){
    alert(i);
}

for(;;) // 无限循环
~~~

- for-in

~~~ javascript
// 是一种精准的迭代语句，用来枚举对象的属性
for (property in expression) statement

for (var propName in window){
    document.write(propName);
}
~~~

- lable

- break & continue

~~~ javascript
// break 语句会立刻退出循环， 强制继续执行循环后面的语句
// continue 语句 也是立刻推出循环，但是退出后会从循环的顶部继续执行.
~~~

- with

- switch

## 函数

---

### 函数基础

### 函数表达式

- 递归
- 闭包
- 私有变量

## 变量，作用域 & 内存问题

---

## 引用类型

---

- Object
- Array
- Date
- RegExp
- Function

# 面向对象编程

---

## 理解对象

## 创建对象

## 继承
