// crates/wakaclock-ast/src/pool.rs

use std::collections::HashMap;
use tree_sitter::{Language, Parser};

struct ParserPool {
    parsers: HashMap<&'static str, Parser>,
}

impl ParserPool {
    fn new() -> Self {
        Self {
            parsers: HashMap::new(),
        }
    }

    fn get_or_create(
        &mut self,
        lang_name: &'static str,
        language: &Language,
    ) -> Option<&mut Parser> {
        if !self.parsers.contains_key(lang_name) {
            let mut parser = Parser::new();
            if parser.set_language(language).is_err() {
                return None;
            }
            self.parsers.insert(lang_name, parser);
        }
        self.parsers.get_mut(lang_name)
    }
}

thread_local! {
    static POOL: std::cell::RefCell<ParserPool> =
        std::cell::RefCell::new(ParserPool::new());
}

/// Parse source แล้วเรียก callback ด้วย root node ภายใน closure
/// (Tree ต้องใช้งานภายใน scope เดียวกับ parser)
pub fn with_parsed_tree<F, R>(
    lang_name: &'static str,
    language: &Language,
    source: &[u8],
    f: F,
) -> Option<R>
where
    F: FnOnce(tree_sitter::Node) -> R,
{
    POOL.with(|pool| {
        let mut pool = pool.borrow_mut();
        let parser = pool.get_or_create(lang_name, language)?;
        parser.reset();
        let tree = parser.parse(source, None)?;
        Some(f(tree.root_node()))
    })
}

/*fn count_nodes(node: tree_sitter::Node) -> usize {
    let mut count = 1;
    let mut cursor = node.walk();
    if cursor.goto_first_child() {
        loop {
            count += count_nodes(cursor.node());
            if !cursor.goto_next_sibling() {
                break;
            }
        }
    }
    count
}*/

/*fn count_errors(node: tree_sitter::Node) -> usize {
    let mut count = if node.is_error() { 1 } else { 0 };
    let mut cursor = node.walk();
    if cursor.goto_first_child() {
        loop {
            count += count_errors(cursor.node());
            if !cursor.goto_next_sibling() {
                break;
            }
        }
    }
    count
}*/
