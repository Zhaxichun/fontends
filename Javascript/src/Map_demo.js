/**
 * The Map object holds key-value pairs. Any value (both objects and primitive values) may be used as either a key or a value.
 *  Syntax:
 *      new Map([iterable])
 *
            iterable
                An Array or other iterable object whose elements are key-value pairs 
                (arrays with two elements, e.g. [[ 1, 'one' ],[ 2, 'two' ]]). 
                Each key-value pair is added to the new Map; null values are treated as undefined.
 *  Description:
 *      A Map object iterates its elements in insertion order — a for...of loop returns an array of [key, value] for each iteration.
 * 
 *  键的相等(Key equality)
 *      NaN 是与 NaN 相等的
 *      根据 === 运算符的结果判断是否相等
 *  Objects 和 maps 的比较
 *      一个Object的键只能是字符串或者 Symbols，但一个 Map 的键可以是任意值，包括函数、对象、基本类型。
 *      Map 中的键值是有序的，而添加到对象中的键则不是。因此，当对它进行遍历时，Map 对象是按插入的顺序返回键值。
 *      你可以通过 size 属性直接获取一个 Map 的键值对个数，而 Object 的键值对个数只能手动计算。
 *      Map 可直接进行迭代，而 Object 的迭代需要先获取它的键数组，然后再进行迭代。
 *      Object 都有自己的原型，原型链上的键名有可能和你自己在对象上的设置的键名产生冲突。
 *          虽然 ES5 开始可以用 map = Object.create(null) 来创建一个没有原型的对象，但是这种用法不太常见。
 *      Map 在涉及频繁增删键值对的场景下会有些性能优势。
 * 
 *  属性
 *  方法
 *      - clear()
 *      - delete()
 *      - entries()
 *      - forEach()
 *      - get(key)
 *      - has(key)
 *      - keys()
 *      - set(key, value)
 *      - values()
 */

// 使用 Map 对象
var myMap = new Map();

var keyObj = {},
  keyFunc = function() {},
  keyString = "a string";

// 添加键
myMap.set(keyString, "和键'a string'关联的值");
myMap.set(keyObj, "和键keyObj关联的值");
myMap.set(keyFunc, "和键keyFunc关联的值");

myMap.size; // 3

// 读取值
myMap.get(keyString); // "和键'a string'关联的值"
myMap.get(keyObj); // "和键keyObj关联的值"
myMap.get(keyFunc); // "和键keyFunc关联的值"

myMap.get("a string"); // "和键'a string'关联的值"
// 因为keyString === 'a string'
myMap.get({}); // undefined, 因为keyObj !== {}
myMap.get(function() {}); // undefined, 因为keyFunc !== function () {}

// 将 NaN 作为 Map 的键
var myMap = new Map();
myMap.set(NaN, "not a number");

myMap.get(NaN); // "not a number"

var otherNaN = Number("foo");
myMap.get(otherNaN); // "not a number"

// 使用 for..of 方法迭代 Map

var myMap = new Map();
myMap.set(0, "zero");
myMap.set(1, "one");
for (var [key, value] of myMap) {
  console.log(key + " = " + value);
}
// 将会显示两个log。一个是"0 = zero"另一个是"1 = one"

for (var key of myMap.keys()) {
  console.log(key);
}
// 将会显示两个log。 一个是 "0" 另一个是 "1"

for (var value of myMap.values()) {
  console.log(value);
}
// 将会显示两个log。 一个是 "zero" 另一个是 "one"

for (var [key, value] of myMap.entries()) {
  console.log(key + " = " + value);
}
// 将会显示两个log。 一个是 "0 = zero" 另一个是 "1 = one"

//使用 forEach() 方法迭代 Map

myMap.forEach(function(value, key) {
  console.log(key + " = " + value);
}, myMap);
// 将会显示两个logs。 一个是 "0 = zero" 另一个是 "1 = one"

// Map 与数组的关系
var kvArray = [["key1", "value1"], ["key2", "value2"]];

// 使用常规的Map构造函数可以将一个二维键值对数组转换成一个Map对象
var myMap = new Map(kvArray);

myMap.get("key1"); // 返回值为 "value1"

// 使用Array.from函数可以将一个Map对象转换成一个二维键值对数组
console.log(Array.from(myMap)); // 输出和kvArray相同的数组

// 或者在键或者值的迭代器上使用Array.from，进而得到只含有键或者值的数组
console.log(Array.from(myMap.keys())); // 输出 ["key1", "key2"]

// 复制或合并 Maps
var original = new Map([[1, "one"]]);

var clone = new Map(original);

console.log(clone.get(1)); // one
console.log(original === clone); // false. Useful for shallow comparison

//
var first = new Map([[1, "one"], [2, "two"], [3, "three"]]);

var second = new Map([[1, "uno"], [2, "dos"]]);

// 合并两个Map对象时，如果有重复的键值，则后面的会覆盖前面的。
// 展开运算符本质上是将Map对象转换成数组。
var merged = new Map([...first, ...second]);

console.log(merged.get(1)); // uno
console.log(merged.get(2)); // dos
console.log(merged.get(3)); // three
