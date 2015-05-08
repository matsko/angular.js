var A = {
  name: 'value'
};

var B = Object.create(A);

console.log(B.name);
A.name = 'cool';

console.log(B.name);
