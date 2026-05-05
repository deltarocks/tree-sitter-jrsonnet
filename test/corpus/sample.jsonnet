local greet(name) = "hello " + name;
local block = |||
  multi
    line
  text
|||;
local block2 = |||-
  trimmed
|||;

{
  who: "world",
  greeting: greet(self.who),
  obj: {a: 1} + {b: 2},
  arr: [x*2 for x in [1,2,3] if x > 1],
  conditional: if self.who == "world" then 1 else 2,
  fn: function(x, y=1) x + y,
  m::: "hidden",
  text: block,
}
