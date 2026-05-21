local
	{a, ...bobj, c} = {a: 1, b: 2, c: 3, d: 4},
	{arr: [a, ...barr, c]} = {arr: [1, 2, 3, 4]},
	d = [
		k + v
		for [k]: v in b
		for v in barr
	],
;

true
