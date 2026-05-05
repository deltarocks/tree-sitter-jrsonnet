#include "tree_sitter/parser.h"

enum TokenType {
  STRING_BLOCK,
  SB_ERR_UNEXPECTED_END,
  SB_ERR_MISSING_NEWLINE,
  SB_ERR_MISSING_TERMINATION,
  SB_ERR_MISSING_INDENT,
};

void *tree_sitter_jsonnet_external_scanner_create(void) { return 0; }
void  tree_sitter_jsonnet_external_scanner_destroy(void *p) { (void)p; }
unsigned tree_sitter_jsonnet_external_scanner_serialize(void *p, char *b) { (void)p; (void)b; return 0; }
void tree_sitter_jsonnet_external_scanner_deserialize(void *p, const char *b, unsigned n) { (void)p; (void)b; (void)n; }

static inline void adv(TSLexer *l) { l->advance(l, false); }

static bool emit(TSLexer *l, const bool *valid, enum TokenType tok) {
  if (!valid[tok]) return false;
  l->result_symbol = tok;
  l->mark_end(l);
  return true;
}

static void skip_to_close(TSLexer *l) {
  int bars = 0;
  while (l->lookahead != 0) {
    if (l->lookahead == '|') { bars++; adv(l); if (bars == 3) return; }
    else { bars = 0; adv(l); }
  }
}

bool tree_sitter_jsonnet_external_scanner_scan(void *payload, TSLexer *lexer, const bool *valid) {
  (void)payload;
  if (!(valid[STRING_BLOCK] || valid[SB_ERR_UNEXPECTED_END]
     || valid[SB_ERR_MISSING_NEWLINE] || valid[SB_ERR_MISSING_TERMINATION]
     || valid[SB_ERR_MISSING_INDENT])) return false;

  while (lexer->lookahead == ' ' || lexer->lookahead == '\t'
      || lexer->lookahead == '\r' || lexer->lookahead == '\n') {
    lexer->advance(lexer, true);
  }

  if (lexer->lookahead != '|') return false;
  adv(lexer);
  if (lexer->lookahead != '|') return false;
  adv(lexer);
  if (lexer->lookahead != '|') return false;
  adv(lexer);

  if (lexer->lookahead == '-') adv(lexer);

  while (lexer->lookahead == ' ' || lexer->lookahead == '\t' || lexer->lookahead == '\r')
    adv(lexer);

  if (lexer->lookahead == 0) { skip_to_close(lexer); return emit(lexer, valid, SB_ERR_UNEXPECTED_END); }
  if (lexer->lookahead != '\n') { skip_to_close(lexer); return emit(lexer, valid, SB_ERR_MISSING_NEWLINE); }
  adv(lexer);

  while (lexer->lookahead == '\n') adv(lexer);

  char indent[256];
  int  ilen = 0;
  while (lexer->lookahead == ' ' || lexer->lookahead == '\t') {
    if (ilen == (int)sizeof(indent)) { skip_to_close(lexer); return emit(lexer, valid, SB_ERR_MISSING_INDENT); }
    indent[ilen++] = (char)lexer->lookahead;
    adv(lexer);
  }
  if (ilen == 0) { skip_to_close(lexer); return emit(lexer, valid, SB_ERR_MISSING_INDENT); }

  for (;;) {
    while (lexer->lookahead != '\n' && lexer->lookahead != 0) adv(lexer);
    if (lexer->lookahead == 0) { return emit(lexer, valid, SB_ERR_UNEXPECTED_END); }
    adv(lexer);

    while (lexer->lookahead == '\n') adv(lexer);

    int matched = 0;
    while (matched < ilen
           && (lexer->lookahead == ' ' || lexer->lookahead == '\t')
           && lexer->lookahead == (unsigned char)indent[matched]) {
      adv(lexer);
      matched++;
    }
    if (matched == ilen) continue;

    while (lexer->lookahead == ' ' || lexer->lookahead == '\t') adv(lexer);

    if (lexer->lookahead != '|') {
      if (lexer->lookahead == 0) return emit(lexer, valid, SB_ERR_UNEXPECTED_END);
      skip_to_close(lexer);
      return emit(lexer, valid, SB_ERR_MISSING_TERMINATION);
    }
    adv(lexer);
    if (lexer->lookahead != '|') { skip_to_close(lexer); return emit(lexer, valid, SB_ERR_MISSING_TERMINATION); }
    adv(lexer);
    if (lexer->lookahead != '|') { skip_to_close(lexer); return emit(lexer, valid, SB_ERR_MISSING_TERMINATION); }
    adv(lexer);

    return emit(lexer, valid, STRING_BLOCK);
  }
}
