/**
 * @file Jsonnet grammar for tree-sitter, ported from jrsonnet-rowan-parser.
 */

const PREC = {
  application: 22,
  unary: 21,
  mul: 20,
  add: 18,
  shift: 16,
  cmp: 14,
  eq: 12,
  band: 10,
  bxor: 8,
  bor: 6,
  and: 4,
  or: 2,
};

export default grammar({
  name: "jsonnet",

  word: ($) => $.ident,

  externals: ($) => [
    $.string_block,
    $._sb_err_unexpected_end,
    $._sb_err_missing_newline,
    $._sb_err_missing_termination,
    $._sb_err_missing_indent,
  ],

  extras: ($) => [
    /[ \t\r\n]+/,
    $.line_comment,
    $.block_comment,
  ],

  conflicts: ($) => [
    [$.bind, $._destruct],
    [$.field, $.function_expr],
  ],

  rules: {
    source_file: ($) => $._expr,

    line_comment: (_) =>
      token(choice(
        seq("//", /[^\r\n]*/),
        seq("#", /[^\r\n]*/),
      )),
    block_comment: (_) => token(seq("/*", /([^*]|\*+[^*/])*\**/, "*/")),

    _expr: ($) => $._binop_expr,

    local_expr: ($) => seq("local", commaSep1($.bind), ";", $._expr),
    assert_expr: ($) => seq($.assertion, ";", $._expr),
    assertion: ($) => seq("assert", $._expr, optional(seq(":", $._expr))),

    _binop_expr: ($) =>
      choice(
        $.binary_expr,
        $._unary_expr,
      ),

    binary_expr: ($) => {
      const table = [
        [PREC.mul, choice("*", "/", "%")],
        [PREC.add, choice("+", "-")],
        [PREC.shift, choice("<<", ">>")],
        [PREC.cmp, choice("<", ">", "<=", ">=", "in")],
        [PREC.eq, choice("==", "!=")],
        [PREC.band, "&"],
        [PREC.bxor, "^"],
        [PREC.bor, "|"],
        [PREC.and, "&&"],
        [PREC.or, choice("||", "??")],
      ];
      return choice(
        ...table.map(([p, op]) =>
          prec.left(
            p,
            seq(
              field("lhs", $._binop_expr),
              field("op", op),
              field("rhs", $._binop_expr),
            ),
          )
        ),
      );
    },

    _unary_expr: ($) =>
      choice(
        prec(PREC.unary, seq(choice("-", "+", "!", "~"), $._unary_expr)),
        $._suffixed,
        $._full_expr,
      ),

    _suffixed: ($) => prec.left(seq($._atom, repeat($._suffix))),

    _full_expr: ($) =>
      choice(
        $.if_then_else,
        $.function_expr,
        $.error_expr,
        $.import_expr,
        $.local_expr,
        $.assert_expr,
      ),

    _suffix: ($) =>
      choice(
        $.suffix_index,
        $.suffix_index_expr,
        $.suffix_slice,
        $.suffix_apply,
        $.suffix_object_apply,
      ),
    suffix_index: ($) => seq(optional("?"), ".", $.ident),
    suffix_index_expr: ($) => seq("[", $._expr, "]"),
    suffix_slice: ($) =>
      seq(
        "[",
        optional($._expr),
        ":",
        optional($._expr),
        optional(seq(":", optional($._expr))),
        "]",
      ),
    suffix_apply: ($) => seq("(", commaSep($.arg), ")", optional("tailstrict")),
    suffix_object_apply: ($) => $.object,
    arg: ($) => choice(seq($.ident, "=", $._expr), $._expr),

    _atom: ($) =>
      choice(
        $.literal,
        $.number,
        $.string,
        $.verbatim_string,
        $.string_block,
        $.ident_ref,
        $.array,
        $.object,
        $.parened,
        $.dollar,
      ),

    dollar: (_) => "$",
    literal: (_) => choice("null", "true", "false", "self", "super"),
    ident_ref: ($) => $.ident,

    if_then_else: ($) =>
      choice(
        prec.right(2, seq("if", $._expr, "then", $._expr, "else", $._expr)),
        prec.right(1, seq("if", $._expr, "then", $._expr)),
      ),

    array: ($) =>
      seq(
        "[",
        optional(seq(
          commaSep1($._expr),
          optional(seq(repeat1($._compspec), optional(","))),
        )),
        "]",
      ),

    object: ($) =>
      seq(
        "{",
        optional(seq(
          commaSep1($.member),
          optional(seq(repeat1($._compspec), optional(","))),
        )),
        "}",
      ),

    member: ($) => choice($.member_local, $.member_assert, $.field),
    member_local: ($) => seq("local", $.bind),
    member_assert: ($) => $.assertion,
    field: ($) =>
      seq(
        $.field_name,
        optional("+"),
        choice(
          seq($.params, $.visibility, $._expr),
          prec.dynamic(2, seq($.visibility, "function", $.params, $._expr)),
          prec.dynamic(1, seq($.visibility, $._expr)),
        ),
      ),
    field_name: ($) =>
      choice(
        $.ident,
        $.string,
        $.verbatim_string,
        $.string_block,
        seq("[", $._expr, "]"),
      ),
    visibility: (_) => choice(":", "::", ":::"),

    _compspec: ($) => choice($.for_spec, $.if_spec),
    for_spec: ($) => seq("for", $._destruct, "in", $._expr),
    if_spec: ($) => seq("if", $._expr),

    function_expr: ($) => seq("function", $.params, $._expr),
    params: ($) => seq("(", commaSep($.param), ")"),
    param: ($) => seq($._destruct, optional(seq("=", $._expr))),

    error_expr: ($) => seq("error", $._expr),
    import_expr: ($) =>
      seq(
        choice("import", "importstr", "importbin"),
        choice($.string, $.verbatim_string, $.string_block),
      ),
    parened: ($) => seq("(", $._expr, ")"),

    bind: ($) =>
      choice(
        prec.dynamic(2, seq($.ident, $.params, "=", $._expr)),
        prec.dynamic(2, seq($.ident, "=", "function", $.params, $._expr)),
        prec.dynamic(1, seq($._destruct, "=", $._expr)),
      ),
    _destruct: ($) =>
      choice(
        $.ident,
        "?",
        seq("[", commaSep(choice($._destruct, $.destruct_rest)), "]"),
        seq("{", commaSep(choice($.destruct_field, $.destruct_rest)), "}"),
      ),
    destruct_rest: ($) => seq("...", optional($.ident)),
    destruct_field: ($) =>
      seq(
        $.ident,
        optional(seq(":", $._destruct)),
        optional(seq("=", $._expr)),
      ),

    string: (_) =>
      token(choice(
        seq('"', repeat(choice(/[^"\\]/, /\\(.|\n)/)), '"'),
        seq("'", repeat(choice(/[^'\\]/, /\\(.|\n)/)), "'"),
      )),
    verbatim_string: (_) =>
      token(choice(
        seq('@"', repeat(choice(/[^"]/, '""')), '"'),
        seq("@'", repeat(choice(/[^']/, "''")), "'"),
      )),
    number: (_) =>
      token(
        /(?:0|[1-9][0-9]*(?:_[0-9]+)*)(?:\.[0-9]+(?:_[0-9]+)*)?(?:[eE][+-]?[0-9]+(?:_[0-9]+)*)?/,
      ),
    ident: (_) => /[_a-zA-Z][_a-zA-Z0-9]*/,
  },
});

function commaSep1(rule) {
  return seq(rule, repeat(seq(",", rule)), optional(","));
}
function commaSep(rule) {
  return optional(commaSep1(rule));
}
