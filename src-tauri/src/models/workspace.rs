use serde::Serialize;

/// Nodo del árbol de colecciones. Las rutas son relativas a `collections/` y usan `/`.
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum TreeNode {
    Folder { name: String, path: String, children: Vec<TreeNode> },
    Request { name: String, path: String, method: String },
}
