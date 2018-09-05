"use strict";

/**
 * 引用类型 - Object
 */

// 对于存储和传输数据，很好
// 两种构造方式

// 第一种 通过 new 关键字

var person = new Object();
person.name = "Bss";

// 第二种方式 对象字面量表示法

var person_2 = {
  name: "BSS",
  age: 29
};

/**
 * 引用类型 - 数组



方法 	            描述
concat() 	    连接两个或更多的数组，并返回结果。
join() 	        把数组的所有元素放入一个字符串。元素通过指定的分隔符进行分隔。
pop() 	        删除并返回数组的最后一个元素
push() 	        向数组的末尾添加一个或更多元素，并返回新的长度。
reverse() 	    颠倒数组中元素的顺序。
shift() 	    删除并返回数组的第一个元素
slice() 	    从某个已有的数组返回选定的元素
sort() 	        对数组的元素进行排序
splice() 	    删除元素，并向数组添加新元素。
toSource() 	    返回该对象的源代码。
toString() 	    把数组转换为字符串，并返回结果。
toLocaleString() 	把数组转换为本地数组，并返回结果。
unshift() 	    向数组的开头添加一个或更多元素，并返回新的长度。
valueOf() 	    返回数组对象的原始值

操作方法:
splice()


位置方法：
indexOf()
lastIndexOf()

迭代方法：
every()  // 传入的函数必须每一项都返回true
filter()
forEach()
map()
some() // 传入的函数对数组中的某一项返回true, 就返回trye
 */

// 缩小方法

/**
 * reduce()
 * reduceRight()
 */

var list = new Array();
var list_01 = [];
var list_02 = Array(3); // 3 items

// Js 的数组的 length 不是只读的，可以通过修改数组长度，增加或者删除item

var colors = ["red", "green"];
colors[colors.length] = "black"; //增加了一个项目
colors[colors.length] = "brown";

var cl;
for (cl in colors) {
  console.log(colors[cl]);
}

// toString() 方法

// toLocalString() 方法

var names = new Array();
names.push("frank", "daliu");

// 迭代方法

var nums = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];
var everyResults = nums.every(function(item, index, array) {
  return item > 2;
});

var someResults = nums.some(function(item, index, array) {
  return item > 2;
});

var filterResults = nums.filter(function(item, idnex, array) {
  return item > 2;
});

var mapResults = nums.map(function(item, index, array) {
  return item * 2;
});

console.log(
  "Use every to check every items is greater then 2 :" + everyResults
);
console.log(
  "Use some to check whether there is an item greater then 2 :" + someResults
);

console.log(
  "Use filter to filter which there is an item greater then 2 :" + filterResults
);

console.log("Use map to operate items :" + mapResults);

nums.forEach(function(item, index, array) {
  return item * 5;
});

console.log("use forEach to operate array" + nums);

console.log(Array.isArray(colors));

/**
 * 引用类型 - Date
 * d:\Apps\node-v8.11.3-win-x64\node ref_type.js
 */

/**
 * 引用类型 - RegExp
 */

/**
 * 引用类型 - Function
 */
