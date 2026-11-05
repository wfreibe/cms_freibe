-- Existing HTML, image settings and accordions remain untouched.
-- NULL means the original page content is rendered as one legacy block.
ALTER TABLE sections ADD COLUMN content_blocks TEXT DEFAULT NULL
    CHECK(content_blocks IS NULL OR length(content_blocks) <= 500000);
