-- Stable canonical URLs and their former addresses, shared by page translations.
-- No existing sections, contents or legacy paths are rewritten.
CREATE TABLE page_urls (
    path TEXT PRIMARY KEY COLLATE NOCASE,
    section_id TEXT NOT NULL,
    is_current INTEGER NOT NULL CHECK(is_current IN (0,1))
);
CREATE UNIQUE INDEX page_urls_current ON page_urls(section_id) WHERE is_current=1;
CREATE INDEX page_urls_section ON page_urls(section_id);
