"use strict";

var date = new Date();

console.log(date);

/*******************************************************
 * 正则表达式详解
 */

// 匹配模式: g, i , m

// var expressions = / pattern /flags;

// 需要转义的操作符 ( { { \ ^ $ | ? * + . } } )

var patt = /at/g;

var p2 = /[bc]at/i;

var p3 = /.at/gi;

var p4 = /\[bc\]at/i;

// RegExp 实例属性

/**
 * global       : bool, 是否设置了g
 * ignoreCast   : bool, 是否设置了i
 * lastIndex    : 整数，标识开始搜索下一个匹配项的字符位置
 * multiline    : bool, 是否这只了m
 * source       : 正则的字符串标识，
 */

// RegExp 的实例方法: exec()
/**
 *
 * exce() 接受一个参数，就是模式的字符串，然后返回包含第一个匹配项信息的数组；或者返回null
 *
 * 返回的虽然是array 的实例，但是包含了两个额外的属相 index, inputl index 标识匹配的字符串位置，input 标识应用正则的字符串
 */

var text = "mom and dad and boby";
var p5 = /mom( and dad( and baby)?)?/gi;

var matches = p5.exec(text);
console.log(matches.index);
console.log(matches.input);
console.log(matches[0]);
console.log(matches[1]);
console.log(matches[2]);
