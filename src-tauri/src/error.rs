use serde::{ser::SerializeStruct, Serialize, Serializer};

/// Error unificado que viaja al frontend como `{ kind, message }`.
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("{0}")]
    InvalidRequest(String),
    #[error("{0}")]
    Network(String),
    #[error("La solicitud superó el tiempo límite")]
    Timeout,
    #[error("Solicitud cancelada")]
    Cancelled,
    #[error("{0}")]
    Io(String),
    #[error("{0}")]
    Storage(String),
}

impl AppError {
    fn kind(&self) -> &'static str {
        match self {
            Self::InvalidRequest(_) => "invalidRequest",
            Self::Network(_) => "network",
            Self::Timeout => "timeout",
            Self::Cancelled => "cancelled",
            Self::Io(_) => "io",
            Self::Storage(_) => "storage",
        }
    }
}

impl Serialize for AppError {
    fn serialize<S: Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        let mut st = s.serialize_struct("AppError", 2)?;
        st.serialize_field("kind", self.kind())?;
        st.serialize_field("message", &self.to_string())?;
        st.end()
    }
}

impl From<std::io::Error> for AppError {
    fn from(e: std::io::Error) -> Self {
        Self::Io(e.to_string())
    }
}

pub type AppResult<T> = Result<T, AppError>;
