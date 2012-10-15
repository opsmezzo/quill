function flatten(obj, recursed) {
  var result = {};

  Object.keys(obj).forEach(function (key) {
    var r;
    if (typeof obj[key] === 'object') {
      r = flatten(obj[key], true);
      Object.keys(r).forEach(function (rKey) {
        result[key + '_' + rKey] = r[rKey];
      });
    }
    else {
      result[key] = obj[key];
    }
  });

  if (!recursed) {
    Object.keys(result).forEach(function (key) {
      result['quill_' + key] = result[key];
      delete result[key];
    });
  }

  return result;
}
