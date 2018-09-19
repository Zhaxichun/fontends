"use strict";
/**
 * JS 包含两种数量： 数据属性 & 访问器属性
 *
 * **** 数据属性： 包含一个数据值的位置，可以读取和写入值
 * [[Configurable]], [[Enumerable]], [[Writable]], [[Value]]
 * 如果更改默认属性的值， 必须使用ECMAScript5 的 Object.defineProperty()方法
 * Object.defineProperty()的三个参数， 属性所在对象， 属性的名字和一个描述对象
 *
 */

var person = {};

Object.defineProperty(person, "name", {
  writable: false,
  value: "nicholase"
});

console.log(person.name);
// person.name = "clone";
// console.log(person.name);

// var person = {};

// Object.defineProperty(person, "name", {
//   configurable: false,
//   value: "nicholase"
// });

// console.log(person.name);

/********************************************************************** */
// 访问器属性

/********************************************************************** */
// var book = {
//   _year: 2004,
//   edition: 1
// };

// Object.defineProperty(book, "year", {
//   get: function() {
//     return this._year;
//   },
//   set: function(newValue) {
//     if (newValue > 2004) {
//       this._year = newValue;
//       this.edition += newValue - 2004;
//     }
//   }
// });

// book.year = 2005;
// console.log(book.edition);

// 定义多个属性 Object.defineProperties();
// 接受两个参数， 第一个是对象要修改的对象，
// 第二个对象的属性与第一个对象中要添加或修改的属性一一对应.
var book = {};

Object.defineProperties(book, {
  _year: {
    value: 2004
  },

  edition: {
    value: 1
  },

  year: {
    get: function() {
      return this._year;
    },
    set: function(newValue) {
      if (newValue > 2004) {
        this._year = newValue;
        this.edition += newValue - 2004;
      }
    }
  }
});

/**************************************************************************************
 * ************************************************************************************
 *  * ************************************************************************************
 *  * ************************************************************************************
 *  * ************************************************************************************
 *  创建对象.
 */

/*******************
 * 工厂模式
 */
function createPerson(name, age, job) {
  var o = new Object();
  o.name = name;
  o.age = age;
  o.job = job;

  o.sayName = function() {
    console.log(this.name);
  };

  return o;
}

var p1 = createPerson("FRANK", 20, "planner");

p1.sayName();

/**************
 * 构造函数模式
 */

function Person(name, age, job) {
  this.name = name;
  this.age = age;
  this.job = job;
  this.sayName = function() {
    console.log(this.name);
  };
}

var p2 = new Person("frank2", 36, "planner");
p2.sayName();

/***************
 * 原型模式
 *
 *  跟构造函数不同的是，所有的新对象都共享属性和方法
 */

function Person_ProType() {}
Person_ProType.prototype.name = "Nicholas";
Person_ProType.prototype.age = 30;
Person_ProType.prototype.job = "Software En";
Person_ProType.prototype.SayName = function() {
  console.log(this.name);
};
