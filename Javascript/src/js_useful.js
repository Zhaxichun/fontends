/**
 * Javascript 数组去重实现的不同方式
 * d:\Apps\node-v8.11.3-win-x64\node js_useful.js
 */

// use ES6 Set
function unique(arr) {
  return Array.from(new Set(arr));
}

var arr = [1, 1, "true", "true", true, true, 15, 17, 17];
console.log(unique(arr));

// 利用双for 循环
// .splice() 从数组中删除条目，并返回改条目
function unique_for(arr) {
  for (var i = 0; i < arr.length; i++) {
    for (var j = 0; j < arr.length; j++) {
      if (arr[i] == arr[j]) {
        arr.splice(j, 1);
        j--;
      }
    }
  }
  return arr;
}
var arr = [1, 1, "true", "true", true, true, 15, 17, 17];
console.log(unique(arr));

// 使用 indexOf
//indexOf() 方法可返回某个指定的字符串值在字符串中首次出现的位置。
// arr.indexOf(searchElement[, fromIndex])
//The indexOf() method returns the first index at which a given element can be found in the array,
// or - 1 if it is not present.
function unique_indexOf(arr) {
  if (!Array.isArray(arr)) {
    console.log("type error");
    return;
  }
  var array = [];
  for (let i = 0; i < arr.length; i++) {
    if (array.indexOf(arr[i]) === -1) {
      array.push(arr[i]);
    }
  }
  return array;
}

/**
 * 利用Sort
 * 利用sort()排序方法，然后根据排序后的结果进行遍历，对比相邻的元素.
 */
function unique_sort(arr) {
  if (!Array.isArray(arr)) {
    console.log("type error");
    return;
  }

  arr = arr.sort();
  var array = [arr[0]];
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] !== arr[i - 1]) {
      array.push(arr[i]);
    }
  }
  return array;
}

/**
 * 利用不同对象的属性不能相同的特点进行去重
 */
function unique_property(arr) {
  if (!Array.isArray(arr)) {
    console.log("type error");
    return;
  }

  var array = [];
  var obj = {};
  for (let i = 0; i < arr.length; i++) {
    if (!obj[arr[i]]) {
      array.push(arr[i]);
      obj[arr[i]] = 1;
    } else {
      obj[arr[i]]++;
    }
  }
  return array;
}

/**
 * 第六： use 'includes'
 * The includes() method determines whether an array includes a certain element,
 * returning true or false as appropriate.
 */

function unique_includes(arr) {
  if (Array.isArray(arr)) {
    console.log("type error");
    return;
  }

  var array = [];
  for (let i = 0; i < arr.length; i++) {
    if (!array.includes(arr[i])) {
      array.push(arr[i]);
    }
  }
  return array;
}

/**
 * 第七： hasOwnProperty
 * 判断对象是否存在属性
 */

function unique_hasOwnProperty(arr) {
  var obj = {};
  return arr.filter(function(item, index, arr) {
    return obj.hasOwnProperty(typeof item + item)
      ? false
      : obj[typeof item + item];
  });
}

/**
 * 第八： 利用filter
 */
function unique_filter(arr) {
  return arr.filter(function(item, index, arr) {
    return arr.indexOf(item, 0) === index;
  });
}

/**
 * 第九 利用递归
 */

function unique_fac(arr) {
  var array = arr;
  var len = array.length;

  array.sort(function(a, b) {
    return a - b;
  });

  function loop(index) {
    if (index >= 1) {
      if (array[index] === array[index - 1]) {
        array.splice(index, 1);
      }
      loop(index - 1);
    }
  }
  loop(len - 1);
  return array;
}

/**
 * 第十： 利用map 数据结构去重
 * Map 的使用
 */
function unique_map(arr) {
  let map = new Map();
  let array = new Array();
  for (let i = 0; i < arr.length; i++) {
    if (map.has(arr[i])) {
      map.set(arr[i], true);
    } else {
      map.set(arr[i], false);
      array.push(arr[i]);
    }
  }
  return array;
}

/**
 * 第十： reduce
 *      reduce 的使用
 */
Array.prototype.unique = function() {
  var sortArr = this.sort();
  var array = [];
  sortArr.reduce((s1, s2) => {
    if (s1 !== s2) {
      array.push(s1);
    }
    return s2;
  });

  array.push(sortArr[sortArr.length - 1]);
  return array;
};
