use std::fs::File;
use std::io::{self, BufRead, BufReader, Seek, SeekFrom};
use std::path::Path;

/// Shared incremental JSONL reader for the per-agent parsers (`codex.rs`, `claude.rs`).
/// Resumes from a byte offset rather than re-parsing the whole file on every cycle, and
/// never fails the whole read on one oversized line (plan.md 8.4: "Cap individual
/// record size and batch work").
pub(super) struct JsonlCursorReader {
    reader: BufReader<File>,
    offset: u64,
}

pub(super) struct LineRead {
    /// Empty when `too_large` is true — the caller should emit a warning and skip it
    /// rather than attempt to parse a truncated/oversized line as JSON.
    pub text: String,
    pub too_large: bool,
    pub offset_after: u64,
}

impl JsonlCursorReader {
    pub(super) fn open(path: &Path, start_offset: u64) -> io::Result<Self> {
        let mut file = File::open(path)?;
        file.seek(SeekFrom::Start(start_offset))?;
        Ok(Self {
            reader: BufReader::new(file),
            offset: start_offset,
        })
    }

    /// Reads one `\n`-terminated line. Returns `Ok(None)` at EOF, including a trailing
    /// partial line with no newline yet (a writer mid-append) — the offset is left
    /// pointing before that partial line so the next call re-reads it once complete.
    pub(super) fn next_line(&mut self, max_bytes: usize) -> io::Result<Option<LineRead>> {
        let start_offset = self.offset;
        let mut buf = Vec::new();
        let read = self.reader.read_until(b'\n', &mut buf)?;
        if read == 0 {
            return Ok(None);
        }
        if buf.last() != Some(&b'\n') {
            // Partial line with no trailing newline yet: rewind so the next call (once
            // the writer finishes the line) reads it from the start rather than
            // treating this as a valid record.
            self.reader.seek_relative(-(read as i64))?;
            return Ok(None);
        }
        self.offset = start_offset + read as u64;
        buf.pop();
        let too_large = buf.len() > max_bytes;
        let text = if too_large {
            String::new()
        } else {
            String::from_utf8_lossy(&buf).into_owned()
        };
        Ok(Some(LineRead {
            text,
            too_large,
            offset_after: self.offset,
        }))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn unique_temp_path(name: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "wakaclock-core-jsonl-test-{}-{name}",
            std::process::id()
        ));
        std::fs::create_dir_all(&dir).expect("create temp dir");
        dir.join(format!("{name}.jsonl"))
    }

    #[test]
    fn reads_lines_and_advances_offset() {
        let path = unique_temp_path("basic");
        std::fs::write(&path, "one\ntwo\nthree\n").unwrap();

        let mut reader = JsonlCursorReader::open(&path, 0).unwrap();
        let first = reader.next_line(1024).unwrap().unwrap();
        assert_eq!(first.text, "one");
        let second = reader.next_line(1024).unwrap().unwrap();
        assert_eq!(second.text, "two");

        let mut resumed = JsonlCursorReader::open(&path, second.offset_after).unwrap();
        let third = resumed.next_line(1024).unwrap().unwrap();
        assert_eq!(third.text, "three");
        assert!(resumed.next_line(1024).unwrap().is_none());
    }

    #[test]
    fn skips_oversized_lines_without_returning_their_text() {
        let path = unique_temp_path("oversized");
        std::fs::write(&path, "short\nthis-line-is-too-long\nok\n").unwrap();

        let mut reader = JsonlCursorReader::open(&path, 0).unwrap();
        let first = reader.next_line(1024).unwrap().unwrap();
        assert_eq!(first.text, "short");
        let second = reader.next_line(5).unwrap().unwrap();
        assert!(second.too_large);
        assert!(second.text.is_empty());
        let third = reader.next_line(1024).unwrap().unwrap();
        assert_eq!(third.text, "ok");
    }

    #[test]
    fn does_not_consume_a_trailing_line_with_no_newline_yet() {
        let path = unique_temp_path("partial");
        std::fs::write(&path, "complete\nincomplete-no-newline").unwrap();

        let mut reader = JsonlCursorReader::open(&path, 0).unwrap();
        let first = reader.next_line(1024).unwrap().unwrap();
        assert_eq!(first.text, "complete");
        assert!(reader.next_line(1024).unwrap().is_none());

        // Simulate the writer finishing the line later.
        let mut file = std::fs::OpenOptions::new()
            .append(true)
            .open(&path)
            .unwrap();
        writeln!(file).unwrap();
        let mut resumed = JsonlCursorReader::open(&path, first.offset_after).unwrap();
        let second = resumed.next_line(1024).unwrap().unwrap();
        assert_eq!(second.text, "incomplete-no-newline");
    }
}
